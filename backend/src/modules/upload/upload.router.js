import express from 'express';
import { upload } from '../../lib/s3.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { uploadController } from './upload.controller.js';

const router = express.Router();

// POST /api/upload/task-image
// Authenticated users only; managers create tasks, employees attach files
router.post(
  '/task-image',
  authMiddleware,
  upload.single('image'),
  uploadController.uploadTaskImage
);

export default router;
