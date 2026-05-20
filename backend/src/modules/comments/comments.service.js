import { commentsRepository } from './comments.repository.js';
import { tasksRepository } from '../tasks/tasks.repository.js';

/**
 * Verifies the requesting user has access to the task's team.
 * Managers see everything; employees only their own team.
 */
const assertTaskAccess = async (taskId, user) => {
  const task = await tasksRepository.getById(taskId);
  if (!task) return null;
  // user.sub is usually where the userId is stored in our current auth setup
  const userId = user.sub || user.userId;
  if (user.role !== 'manager' && task.teamId !== user.teamId) return null;
  return task;
};

export const commentsService = {
  async createComment(taskId, content, user) {
    const task = await assertTaskAccess(taskId, user);
    if (!task) return null;

    return commentsRepository.create({
      taskId,
      authorId: user.sub || user.userId,
      authorName: user.name || user.email || user['cognito:username'] || 'User',
      content: content.trim(),
    });
  },

  async getComments(taskId, user) {
    const task = await assertTaskAccess(taskId, user);
    if (!task) return null;
    return commentsRepository.getByTaskId(taskId);
  },

  async updateComment(commentId, taskId, content, user) {
    const task = await assertTaskAccess(taskId, user);
    if (!task) throw new Error('NOT_FOUND');

    const userId = user.sub || user.userId;

    const comments = await commentsRepository.getByTaskId(taskId);
    const comment = comments.find((c) => c.commentId === commentId);
    if (!comment) throw new Error('NOT_FOUND');
    if (user.role !== 'manager' && comment.authorId !== userId) {
      throw new Error('FORBIDDEN');
    }

    return commentsRepository.update(commentId, content.trim());
  },

  async deleteComment(commentId, taskId, user) {
    const task = await assertTaskAccess(taskId, user);
    if (!task) throw new Error('NOT_FOUND');

    const userId = user.sub || user.userId;

    // Only managers or the comment's own author can delete
    const comments = await commentsRepository.getByTaskId(taskId);
    const comment = comments.find((c) => c.commentId === commentId);
    if (!comment) throw new Error('NOT_FOUND');
    if (user.role !== 'manager' && comment.authorId !== userId) {
      throw new Error('FORBIDDEN');
    }

    await commentsRepository.delete(commentId);
    return true;
  },
};
