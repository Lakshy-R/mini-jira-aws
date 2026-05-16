const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const sharp = require("sharp");
const path = require("path");

const s3 = new S3Client({ region: process.env.AWS_REGION });
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));

const RESIZED_BUCKET = process.env.S3_RESIZED_BUCKET;
const TASKS_TABLE = process.env.DYNAMODB_TASKS_TABLE;
const THUMBNAIL_WIDTH = parseInt(process.env.THUMBNAIL_WIDTH || "400", 10);
const THUMBNAIL_HEIGHT = parseInt(process.env.THUMBNAIL_HEIGHT || "400", 10);

/**
 * Streams an S3 object body into a Buffer.
 */
const streamToBuffer = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

/**
 * Finds the taskId whose imageUrl contains the given S3 key.
 * Uses a Scan — acceptable since this is a background Lambda, not a hot API path.
 */
const findTaskByImageKey = async (originalKey) => {
  const result = await dynamo.send(
    new ScanCommand({
      TableName: TASKS_TABLE,
      FilterExpression: "contains(imageUrl, :key)",
      ExpressionAttributeValues: { ":key": originalKey },
      ProjectionExpression: "taskId",
    })
  );
  return result.Items?.[0]?.taskId || null;
};

/**
 * Writes the thumbnailUrl back to the task record.
 */
const updateTaskThumbnail = async (taskId, thumbnailUrl) => {
  await dynamo.send(
    new UpdateCommand({
      TableName: TASKS_TABLE,
      Key: { taskId },
      UpdateExpression: "SET thumbnailUrl = :url, updatedAt = :now",
      ExpressionAttributeValues: {
        ":url": thumbnailUrl,
        ":now": new Date().toISOString(),
      },
    })
  );
};

/**
 * Main Lambda handler.
 * Triggered by S3 PUT events on the originals bucket.
 * Each event record contains one object key.
 */
exports.handler = async (event) => {
  const results = [];

  for (const record of event.Records) {
    const sourceBucket = record.s3.bucket.name;
    const originalKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    // Skip if this fires on the resized bucket (safety guard)
    if (sourceBucket === RESIZED_BUCKET) {
      console.log(`[skip] key ${originalKey} is already in resized bucket`);
      continue;
    }

    // Only process files under task-images/
    if (!originalKey.startsWith("task-images/")) {
      console.log(`[skip] key ${originalKey} not under task-images/`);
      continue;
    }

    try {
      console.log(`[resize] processing: s3://${sourceBucket}/${originalKey}`);

      // 1. Download original from S3
      const getResult = await s3.send(
        new GetObjectCommand({ Bucket: sourceBucket, Key: originalKey })
      );
      const originalBuffer = await streamToBuffer(getResult.Body);

      // 2. Resize with sharp
      const resizedBuffer = await sharp(originalBuffer)
        .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
          fit: "cover",        // crop to fill — no letterboxing
          position: "center",
          withoutEnlargement: true, // never upscale tiny images
        })
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();

      // 3. Build the thumbnail key — same path, suffix added before extension
      const ext = path.extname(originalKey);
      const base = originalKey.slice(0, originalKey.length - ext.length);
      const thumbnailKey = `${base}-thumb.jpg`;

      // 4. Upload thumbnail to resized bucket
      await s3.send(
        new PutObjectCommand({
          Bucket: RESIZED_BUCKET,
          Key: thumbnailKey,
          Body: resizedBuffer,
          ContentType: "image/jpeg",
          Metadata: { originalKey, sourceWidth: String(THUMBNAIL_WIDTH), sourceHeight: String(THUMBNAIL_HEIGHT) },
        })
      );

      const thumbnailUrl = `https://${RESIZED_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${thumbnailKey}`;
      console.log(`[resize] thumbnail written: ${thumbnailUrl}`);

      // 5. Write thumbnailUrl back to DynamoDB
      const taskId = await findTaskByImageKey(originalKey);
      if (taskId) {
        await updateTaskThumbnail(taskId, thumbnailUrl);
        console.log(`[resize] updated task ${taskId} with thumbnailUrl`);
      } else {
        console.warn(`[resize] no task found for key ${originalKey} — thumbnailUrl not persisted`);
      }

      results.push({ key: originalKey, thumbnailKey, status: "ok" });
    } catch (err) {
      console.error(`[resize] error processing ${originalKey}:`, err);
      results.push({ key: originalKey, status: "error", error: err.message });
      // Do NOT rethrow — let other records in the batch process
    }
  }

  return { processed: results.length, results };
};
