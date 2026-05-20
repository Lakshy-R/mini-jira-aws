import { commentsService } from './comments.service.js';

export const commentsController = {
  async createComment(req, res) {
    try {
      const { content } = req.body;
      if (!content || !content.trim()) {
        return res.status(400).json({ message: 'Comment content is required.' });
      }

      const comment = await commentsService.createComment(
        req.params.taskId,
        content,
        req.user
      );
      if (!comment) return res.status(404).json({ message: 'Task not found.' });
      return res.status(201).json(comment);
    } catch (err) {
      console.error('[Comments] createComment error:', err);
      return res.status(500).json({ message: 'Failed to post comment.' });
    }
  },

  async getComments(req, res) {
    try {
      const comments = await commentsService.getComments(req.params.taskId, req.user);
      if (!comments) return res.status(404).json({ message: 'Task not found.' });
      return res.status(200).json(comments);
    } catch (err) {
      console.error('[Comments] getComments error:', err);
      return res.status(500).json({ message: 'Failed to fetch comments.' });
    }
  },

  async updateComment(req, res) {
    try {
      const { content } = req.body;
      if (!content || !content.trim()) {
        return res.status(400).json({ message: 'Comment content is required.' });
      }

      const updated = await commentsService.updateComment(
        req.params.commentId,
        req.params.taskId,
        content,
        req.user
      );

      return res.status(200).json(updated);
    } catch (err) {
      if (err.message === 'NOT_FOUND')
        return res.status(404).json({ message: 'Comment not found.' });
      if (err.message === 'FORBIDDEN')
        return res.status(403).json({ message: 'You can only edit your own comments.' });
      console.error('[Comments] updateComment error:', err);
      return res.status(500).json({ message: 'Failed to update comment.' });
    }
  },

  async deleteComment(req, res) {
    try {
      await commentsService.deleteComment(
        req.params.commentId,
        req.params.taskId,
        req.user
      );
      return res.status(200).json({ message: 'Comment deleted.' });
    } catch (err) {
      if (err.message === 'NOT_FOUND')
        return res.status(404).json({ message: 'Comment not found.' });
      if (err.message === 'FORBIDDEN')
        return res.status(403).json({ message: 'You can only delete your own comments.' });
      console.error('[Comments] deleteComment error:', err);
      return res.status(500).json({ message: 'Failed to delete comment.' });
    }
  },
};
