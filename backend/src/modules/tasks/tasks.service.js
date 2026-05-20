import { tasksRepository } from './tasks.repository.js';
import { v4 as uuid } from 'uuid';
import { deleteFromS3, getSignedImageUrl } from '../../lib/s3.js';
import { publishTaskAssignment } from '../../lib/sns.js';
import { recordTaskCreated, recordTaskClosed } from '../../lib/cloudwatch.js';

const VALID_STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

const attachPresignedUrl = async (task) => {
  const urlOrKey = task.thumbnailUrl || task.imageUrl;
  if (!urlOrKey) return task;
  const bucket = task.thumbnailUrl
    ? process.env.S3_RESIZED_BUCKET
    : process.env.S3_ORIGINALS_BUCKET;
  task.presignedUrl = await getSignedImageUrl(urlOrKey, bucket);
  return task;
};

const assertTeamAccess = (task, user) => {
  if (user.role === 'manager') return;
  if (task.teamId !== user.teamId) {
    const err = new Error('FORBIDDEN');
    err.code = 'FORBIDDEN';
    throw err;
  }
};

export const tasksService = {
  async createTask(data, user) {
    const task = await tasksRepository.create({
      taskId: uuid(),
      title: data.title,
      description: data.description || '',
      status: 'TODO',
      priority: data.priority || 'MEDIUM',
      teamId: data.teamId,
      assigneeId: data.assigneeId,
      projectId: data.projectId || null,
      deadline: data.deadline || null,
      createdBy: user.sub,
      managerId: user.sub,
      imageUrl: data.imageUrl || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    if (task.assigneeId) {
      await publishTaskAssignment(task);
    }

    recordTaskCreated(task.teamId).catch((err) => console.error('[CW]', err));

    return task;
  },

  async getTasks(user, options = {}) {
    let result;
    if (user?.role !== 'manager' && user?.teamId) {
      result = await tasksRepository.getByTeam(user.teamId, options);
    } else {
      result = await tasksRepository.getAll(options);
    }

    const tasks = result.Items || [];
    return {
      items: await Promise.all(tasks.map(attachPresignedUrl)),
      lastKey: result.LastEvaluatedKey || null,
    };
  },

  async getTaskById(taskId, user) {
    const task = await tasksRepository.getById(taskId);
    if (!task) return null;

    assertTeamAccess(task, user);

    return await attachPresignedUrl(task);
  },

  async updateTaskStatus(taskId, status, user) {
    if (!VALID_STATUSES.includes(status)) {
      const err = new Error('INVALID_STATUS');
      err.code = 'INVALID_STATUS';
      throw err;
    }

    const task = await tasksRepository.getById(taskId);
    if (!task) return null;

    assertTeamAccess(task, user);

    if (user.role !== 'manager' && task.assigneeId !== user.sub) {
      const err = new Error('FORBIDDEN');
      err.code = 'FORBIDDEN';
      throw err;
    }

    const updated = await tasksRepository.updateStatus(taskId, status);

    if (status === 'DONE' && task.createdAt) {
      const timeToCloseMs = Date.now() - new Date(task.createdAt).getTime();
      recordTaskClosed(task.teamId, timeToCloseMs).catch((err) => console.error('[CW]', err));
    }

    return updated;
  },

  async updateTaskImage(taskId, newImageUrl, user) {
    const task = await tasksRepository.getById(taskId);
    if (!task) return null;

    assertTeamAccess(task, user);

    return await tasksRepository.updateImage(taskId, newImageUrl);
  },

  async updateTask(taskId, fields, user) {
    const task = await tasksRepository.getById(taskId);
    if (!task) return null;

    assertTeamAccess(task, user);

    return await tasksRepository.update(taskId, fields);
  },

  async deleteTask(taskId, user) {
    const task = await tasksRepository.getById(taskId);
    if (!task) return false;

    if (task.imageUrl) {
      await deleteFromS3(task.imageUrl);
    }

    return await tasksRepository.delete(taskId);
  },
};
