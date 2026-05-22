import express from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { commentsController } from './comments.controller.js';

const router = express.Router({ mergeParams: true }); // gives access to :taskId from parent

// All comment routes require authentication
router.use(authMiddleware);

// GET  /api/tasks/:taskId/comments
router.get('/', commentsController.getComments);

// POST /api/tasks/:taskId/comments
router.post('/', commentsController.createComment);

// PATCH /api/tasks/:taskId/comments/:commentId  (author-only edit)
router.patch('/:commentId', commentsController.updateComment);

// DELETE /api/tasks/:taskId/comments/:commentId
router.delete('/:commentId', commentsController.deleteComment);

export default router;
