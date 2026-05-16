import express from 'express';

import { tasksController } from './tasks.controller.js';

import { authMiddleware } from '../../middleware/auth.middleware.js';

import { requireRole } from '../../middleware/rbac.middleware.js';
import { upload } from '../../lib/s3.js';

const router = express.Router();

// Protect all routes
router.use(authMiddleware);

// GET all tasks
router.get('/', tasksController.getAll);

// GET single task
router.get('/:id', tasksController.getOne);

// CREATE task
router.post(
    '/',
    requireRole('manager'),
    tasksController.create
);

// UPDATE task status
router.patch(
    '/:id/status',
    tasksController.updateStatus
);

// UPDATE task image
router.patch(
    '/:id/image',
    upload.single('image'),
    tasksController.updateImage
);

// DELETE task
router.delete(
    '/:id',
    requireRole('manager'),
    tasksController.delete
);

export default router;