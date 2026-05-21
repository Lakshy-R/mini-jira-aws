import { commentsRepository } from './comments.repository.js';
import { tasksRepository } from '../tasks/tasks.repository.js';
import { NotFoundError, ForbiddenError } from '../../middleware/error.middleware.js';

/**
 * Verifies the requesting user has access to the task.
 * Throws typed errors instead of returning null so the controller
 * gets the correct HTTP status code automatically.
 */
const assertTaskAccess = async (taskId, user) => {
  const task = await tasksRepository.getById(taskId);
  if (!task) throw new NotFoundError('Task');
  if (user.role !== 'manager' && task.teamId !== user.teamId) throw new ForbiddenError();
  return task;
};

export const commentsService = {
  async createComment(taskId, content, user) {
    await assertTaskAccess(taskId, user);

    return commentsRepository.create({
      taskId,
      authorId:   user.sub,
      authorName: user.name || user.email || 'User',
      content:    content.trim(),
    });
  },

  async getComments(taskId, user) {
    await assertTaskAccess(taskId, user);
    return commentsRepository.getByTaskId(taskId);
  },

  async deleteComment(commentId, taskId, user) {
    await assertTaskAccess(taskId, user);

    const comments = await commentsRepository.getByTaskId(taskId);
    const comment  = comments.find((c) => c.commentId === commentId);
    if (!comment) throw new NotFoundError('Comment');

    if (user.role !== 'manager' && comment.authorId !== user.sub) {
      throw new ForbiddenError();
    }

    await commentsRepository.delete(commentId);
    return true;
  },
};
