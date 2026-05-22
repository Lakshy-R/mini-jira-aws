import { tasksRepository } from './tasks.repository.js';
import { auditRepository, AUDIT_ACTIONS } from './audit.repository.js';
import { deleteFromS3, getSignedImageUrl } from '../../lib/s3.js';
import { publishTaskAssignment } from '../../lib/sns.js';
import { recordTaskCreated, recordTaskClosed } from '../../lib/cloudwatch.js';
import { ForbiddenError } from '../../middleware/error.middleware.js';

const VALID_STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  if (task.teamId !== user.teamId) throw new ForbiddenError();
};

// ─── Service ─────────────────────────────────────────────────────────────────
export const tasksService = {
  async createTask(data, user) {
    // Repository owns ID generation — no uuid() call here
    const task = await tasksRepository.create({
      title:       data.title,
      description: data.description || '',
      status:      'TODO',
      priority:    data.priority || 'MEDIUM',
      teamId:      data.teamId,
      assigneeId:  data.assigneeId,
      projectId:   data.projectId || null,
      deadline:    data.deadline   || null,
      createdBy:   user.sub,
      managerId:   user.sub,
      imageUrl:    data.imageUrl   || null,
    });

    // Fire-and-forget side effects — failures must not block the response
    if (task.assigneeId) {
      publishTaskAssignment(task).catch((e) => console.error('[SNS]', e.message));
    }

    auditRepository
      .log({
        taskId:    task.taskId,
        action:    AUDIT_ACTIONS.TASK_CREATED,
        actorId:   user.sub,
        actorRole: user.role,
        metadata:  { title: task.title, teamId: task.teamId, assigneeId: task.assigneeId },
      })
      .catch((e) => console.error('[AUDIT]', e.message));

    recordTaskCreated(task.teamId).catch((e) => console.error('[CW]', e.message));

    return task;
  },

  async getTasks(user, options = {}) {
    let result;
    if (user?.role !== 'manager' && user?.teamId) {
      result = await tasksRepository.getByTeam(user.teamId, options);
    } else {
      // Managers use the entity-createdAt-index GSI — no full table scan
      result = await tasksRepository.queryAll(options);
    }

    const tasks = result.Items || [];
    return {
      items:   await Promise.all(tasks.map(attachPresignedUrl)),
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
      err.code  = 'INVALID_STATUS';
      throw err;
    }

    const task = await tasksRepository.getById(taskId);
    if (!task) return null;

    assertTeamAccess(task, user);

    // Employees can only update status on tasks assigned to them
    if (user.role !== 'manager' && task.assigneeId !== user.sub) {
      throw new ForbiddenError();
    }

    const prevStatus = task.status;
    const updated    = await tasksRepository.updateStatus(taskId, status);

    // ── Audit log every status transition ──
    auditRepository
      .log({
        taskId,
        action:    AUDIT_ACTIONS.STATUS_CHANGED,
        actorId:   user.sub,
        actorRole: user.role,
        metadata:  { fromStatus: prevStatus, toStatus: status, teamId: task.teamId },
      })
      .catch((e) => console.error('[AUDIT]', e.message));

    if (status === 'DONE' && task.createdAt) {
      const timeToCloseMs = Date.now() - new Date(task.createdAt).getTime();
      recordTaskClosed(task.teamId, timeToCloseMs).catch((e) => console.error('[CW]', e.message));
    }

    return updated;
  },

  async updateTaskImage(taskId, newImageUrl, user) {
    const task = await tasksRepository.getById(taskId);
    if (!task) return null;

    assertTeamAccess(task, user);

    const updated = await tasksRepository.updateImage(taskId, newImageUrl);

    auditRepository
      .log({
        taskId,
        action:    AUDIT_ACTIONS.IMAGE_UPDATED,
        actorId:   user.sub,
        actorRole: user.role,
        metadata:  { newImageUrl },
      })
      .catch((e) => console.error('[AUDIT]', e.message));

    return updated;
  },

  async updateTask(taskId, fields, user) {
    const task = await tasksRepository.getById(taskId);
    if (!task) return null;

    assertTeamAccess(task, user);

    const updated = await tasksRepository.update(taskId, fields);

    auditRepository
      .log({
        taskId,
        action:    AUDIT_ACTIONS.TASK_UPDATED,
        actorId:   user.sub,
        actorRole: user.role,
        metadata:  { changedFields: Object.keys(fields) },
      })
      .catch((e) => console.error('[AUDIT]', e.message));

    return updated;
  },

  async deleteTask(taskId, user) {
    const task = await tasksRepository.getById(taskId);
    if (!task) return false;

    // Consistent team-isolation check on every mutation including delete
    assertTeamAccess(task, user);

    // Delete original image and its resized thumbnail from S3
    const deletions = [];
    if (task.imageUrl)    deletions.push(deleteFromS3(task.imageUrl, process.env.S3_ORIGINALS_BUCKET));
    if (task.thumbnailUrl) deletions.push(deleteFromS3(task.thumbnailUrl, process.env.S3_RESIZED_BUCKET));
    await Promise.allSettled(deletions);

    await tasksRepository.delete(taskId);

    auditRepository
      .log({
        taskId,
        action:    AUDIT_ACTIONS.TASK_DELETED,
        actorId:   user.sub,
        actorRole: user.role,
        metadata:  { title: task.title, teamId: task.teamId },
      })
      .catch((e) => console.error('[AUDIT]', e.message));

    return true;
  },
};
