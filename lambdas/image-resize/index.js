const { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
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

const streamToBuffer = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
};

/**
 * Reads the taskId from S3 object metadata first.
 * This is the fast path — O(1) instead of a full table scan.
 * Falls back to a table scan if metadata isn't present (legacy uploads).
 */
const findTaskId = async (bucket, key) => {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    const taskId = head.Metadata?.taskid; // S3 metadata keys are lowercased
    if (taskId) {
      console.log(`[resize] Found taskId=${taskId} from S3 metadata`);
      return taskId;
    }
  } catch (err) {
    console.warn(`[resize] Could not read S3 metadata for ${key}:`, err.message);
  }

  // Fallback: scan the Tasks table — used for legacy uploads without metadata
  console.log(`[resize] Falling back to DynamoDB scan for key=${key}`);
  const result = await dynamo.send(
    new ScanCommand({
      TableName: TASKS_TABLE,
      FilterExpression: "contains(imageUrl, :key)",
      ExpressionAttributeValues: { ":key": key },
      ProjectionExpression: "taskId",
    })
  );
  return result.Items?.[0]?.taskId || null;
};

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

exports.handler = async (event) => {
  const results = [];

  for (const record of event.Records) {
    const sourceBucket = record.s3.bucket.name;
    const originalKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    if (sourceBucket === RESIZED_BUCKET) {
      console.log(`[skip] ${originalKey} is already in resized bucket`);
      continue;
    }

    if (!originalKey.startsWith("task-images/")) {
      console.log(`[skip] ${originalKey} not under task-images/`);
      continue;
    }

    try {
      console.log(`[resize] Processing s3://${sourceBucket}/${originalKey}`);

      const getResult = await s3.send(new GetObjectCommand({ Bucket: sourceBucket, Key: originalKey }));
      const originalBuffer = await streamToBuffer(getResult.Body);

      const resizedBuffer = await sharp(originalBuffer)
        .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
          fit: "cover",
          position: "center",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();

      const ext = path.extname(originalKey);
      const base = originalKey.slice(0, originalKey.length - ext.length);
      const thumbnailKey = `${base}-thumb.jpg`;

      await s3.send(
        new PutObjectCommand({
          Bucket: RESIZED_BUCKET,
          Key: thumbnailKey,
          Body: resizedBuffer,
          ContentType: "image/jpeg",
        })
      );

      const thumbnailUrl = `https://${RESIZED_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${thumbnailKey}`;
      console.log(`[resize] Thumbnail written: ${thumbnailUrl}`);

      const taskId = await findTaskId(sourceBucket, originalKey);
      if (taskId) {
        await updateTaskThumbnail(taskId, thumbnailUrl);
        console.log(`[resize] Updated task ${taskId} with thumbnailUrl`);
      } else {
        console.warn(`[resize] No task found for key ${originalKey}`);
      }

      results.push({ key: originalKey, thumbnailKey, status: "ok" });
    } catch (err) {
      console.error(`[resize] Error processing ${originalKey}:`, err);
      results.push({ key: originalKey, status: "error", error: err.message });
    }
  }

  return { processed: results.length, results };
};
