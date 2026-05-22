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

  async updateComment(commentId, taskId, content, user) {
    await assertTaskAccess(taskId, user);

    // O(1) direct fetch — no N+1 scan across all task comments
    const comment = await commentsRepository.getById(commentId);
    if (!comment) throw new NotFoundError('Comment');

    // Only the original author may edit — managers cannot rewrite other people's comments
    if (comment.authorId !== user.sub) throw new ForbiddenError('Only the comment author can edit it');

    return commentsRepository.update(commentId, content.trim());
  },

  async deleteComment(commentId, taskId, user) {
    await assertTaskAccess(taskId, user);

    // O(1) direct fetch — fixed N+1 that previously loaded all task comments
    const comment = await commentsRepository.getById(commentId);
    if (!comment) throw new NotFoundError('Comment');

    if (user.role !== 'manager' && comment.authorId !== user.sub) {
      throw new ForbiddenError();
    }

    await commentsRepository.delete(commentId);
    return true;
  },
};
