import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import multer from 'multer';
import multerS3 from 'multer-s3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export const s3Client = new S3Client({
  region: process.env.AWS_REGION,
});

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

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
    bucket: process.env.S3_ORIGINALS_BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: (_req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const key = `task-images/${uuidv4()}${ext}`;
      cb(null, key);
    },
  }),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

/**
 * Deletes an object from S3 by its full URL or key.
 * Does NOT throw — logs errors and resolves so callers don't crash.
 */
export const deleteFromS3 = async (urlOrKey) => {
  if (!urlOrKey) return;
  try {
    // Extract key from full S3 URL if needed
    let key = urlOrKey;
    if (urlOrKey.startsWith('https://')) {
      const url = new URL(urlOrKey);
      key = decodeURIComponent(url.pathname.slice(1)); // strip leading "/"
    }
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.S3_ORIGINALS_BUCKET,
        Key: key,
      })
    );
  } catch (err) {
    console.error('[S3] deleteFromS3 failed:', err.message);
  }
};
