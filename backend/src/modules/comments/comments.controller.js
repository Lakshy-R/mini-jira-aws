import { commentsService } from './comments.service.js';
import { asyncHandler, NotFoundError, ValidationError } from '../../middleware/error.middleware.js';

export const commentsController = {
  createComment: asyncHandler(async (req, res) => {
    const { content } = req.body;
    if (!content?.trim()) throw new ValidationError('Comment content is required');
    const comment = await commentsService.createComment(req.params.taskId, content, req.user);
    if (!comment) throw new NotFoundError('Task');
    res.status(201).json(comment);
  }),

  getComments: asyncHandler(async (req, res) => {
    const comments = await commentsService.getComments(req.params.taskId, req.user);
    res.json(comments);
  }),

  updateComment: asyncHandler(async (req, res) => {
    const { content } = req.body;
    if (!content?.trim()) throw new ValidationError('Comment content is required');
    const comment = await commentsService.updateComment(
      req.params.commentId,
      req.params.taskId,
      content,
      req.user,
    );
    res.json(comment);
  }),

  deleteComment: asyncHandler(async (req, res) => {
    await commentsService.deleteComment(req.params.commentId, req.params.taskId, req.user);
    res.json({ success: true });
  }),
};
