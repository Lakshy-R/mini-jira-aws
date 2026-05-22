import { S3Client, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import multer from 'multer';
import multerS3 from 'multer-s3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export const s3Client = new S3Client({ region: process.env.AWS_REGION });

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE      = 5 * 1024 * 1024; // 5 MB

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WebP are allowed.'), false);
  }
};

export const upload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket:      process.env.S3_ORIGINALS_BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: (req, file, cb) => {
      // Always write taskId into S3 metadata when available.
      // This is read by the image-resize Lambda as the fast path (O(1))
      // to avoid a full DynamoDB scan fallback.
      const meta = { fieldName: file.fieldname };

      // /:id/image  → req.params.id is the existing task's ID
      // /upload/task-image → task does not exist yet; taskId comes from the
      //   query param ?taskId=xxx written by the frontend BEFORE creating the task
      const taskId = req.params?.id || req.query?.taskId;
      if (taskId) meta.taskid = taskId;

      cb(null, meta);
    },
    key: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `task-images/${uuidv4()}${ext}`);
    },
  }),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

/**
 * Delete an object from any S3 bucket.
 * Accepts either a full HTTPS URL or a bare object key.
 */
export const deleteFromS3 = async (
  urlOrKey,
  bucket = process.env.S3_ORIGINALS_BUCKET
) => {
  if (!urlOrKey || !bucket) return;
  try {
    let key = urlOrKey;
    if (urlOrKey.startsWith('https://')) {
      key = decodeURIComponent(new URL(urlOrKey).pathname.slice(1));
    }
    await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch (err) {
    console.error('[S3] deleteFromS3 failed:', err.message);
  }
};

/**
 * Generate a presigned GET URL (default 1 hour expiry).
 * Accepts either a full HTTPS URL or a bare object key.
 */
export const getSignedImageUrl = async (
  urlOrKey,
  bucket    = process.env.S3_ORIGINALS_BUCKET,
  expiresIn = 3600
) => {
  if (!urlOrKey) return null;
  try {
    let key = urlOrKey;
    if (urlOrKey.startsWith('https://')) {
      key = decodeURIComponent(new URL(urlOrKey).pathname.slice(1));
    }
    return await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn }
    );
  } catch (err) {
    console.error('[S3] getSignedImageUrl failed:', err.message);
    return null;
  }
};
