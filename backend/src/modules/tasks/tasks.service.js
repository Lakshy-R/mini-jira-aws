import { tasksRepository } from './tasks.repository.js';
import { v4 as uuid } from 'uuid';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { deleteFromS3, getSignedImageUrl } from '../../lib/s3.js';
import { publishTaskAssignment } from '../../lib/sns.js';
import { recordTaskCreated, recordTaskClosed } from '../../lib/cloudwatch.js';
import { ddb } from '../../lib/dynamodb.js';

const getUserId = (user) => user?.sub || user?.userId;
const ACTIVITY_TABLE = process.env.DYNAMODB_ACTIVITY_TABLE || 'ActivityLogs';

const assertTaskAccess = async (taskId, user) => {
    const task = await tasksRepository.getById(taskId);
    if (!task) throw new Error('NOT_FOUND');

    if (user?.role !== 'manager' && task.teamId !== user?.teamId) {
        throw new Error('FORBIDDEN');
    }

    return task;
};

const recordStatusChange = async (task, status, user) => {
    if (!task) return;

    const userId = getUserId(user);
    const now = new Date().toISOString();

    await ddb.send(
        new PutCommand({
            TableName: ACTIVITY_TABLE,
            Item: {
                logId: uuid(),
                taskId: task.taskId,
                teamId: task.teamId,
                assigneeId: task.assigneeId,
                managerId: task.managerId,
                action: 'STATUS_CHANGE',
                fromStatus: task.status,
                toStatus: status,
                changedBy: userId,
                timestamp: now,
            },
        })
    );
};

export const tasksService = {
    async createTask(data, user) {
        const task = await tasksRepository.create({
            taskId: uuid(),
            title: data.title,
            description: data.description,
            status: 'TODO',
            priority: data.priority,
            deadline: data.deadline || null,
            teamId: data.teamId,
            assigneeId: data.assigneeId,
            projectId: data.projectId,
            createdBy: user.sub,
            managerId: user.sub,
            imageUrl: data.imageUrl || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });

        // Trigger SNS fan-out if task has an assignee
        if (task.assigneeId) {
            await publishTaskAssignment(task);
        }

        recordTaskCreated(task.teamId).catch(err => console.error(err));

        return task;
    },

    async getTasks(user) {
        let tasks = [];
        // Employee → only own team
        if (user?.role !== 'manager' && user?.teamId) {
            const result = await tasksRepository.getByTeam(user.teamId);
            tasks = result.Items || [];
        } else {
            // Manager → all tasks
            const result = await tasksRepository.getAll();
            tasks = result.Items || [];
        }

        return await Promise.all(tasks.map(async (task) => {
            const urlOrKey = task.thumbnailUrl || task.imageUrl;
            if (urlOrKey) {
                const bucket = task.thumbnailUrl ? process.env.S3_RESIZED_BUCKET : process.env.S3_ORIGINALS_BUCKET;
                task.presignedUrl = await getSignedImageUrl(urlOrKey, bucket);
            }
            return task;
        }));
    },

    async getTaskById(taskId, user) {
        const task = await assertTaskAccess(taskId, user);
        if (task) {
            const urlOrKey = task.thumbnailUrl || task.imageUrl;
            if (urlOrKey) {
                const bucket = task.thumbnailUrl ? process.env.S3_RESIZED_BUCKET : process.env.S3_ORIGINALS_BUCKET;
                task.presignedUrl = await getSignedImageUrl(urlOrKey, bucket);
            }
        }
        return task;
    },

    async updateTask(taskId, data, user) {
        const task = await assertTaskAccess(taskId, user);

        const updated = await tasksRepository.updateDetails(taskId, data);

        if (data?.assigneeId && data.assigneeId !== task.assigneeId) {
            await publishTaskAssignment({
                ...task,
                ...updated,
                assigneeId: data.assigneeId,
            });
        }

        return updated;
    },

    async updateTaskStatus(taskId, status, user) {
        const task = await assertTaskAccess(taskId, user);

        const userId = getUserId(user);
        if (user?.role !== 'manager' && task.assigneeId !== userId) {
            throw new Error('FORBIDDEN');
        }

        const updated = await tasksRepository.updateStatus(taskId, status);

        if (task.status !== status) {
            recordStatusChange(task, status, user).catch(err => console.error(err));
        }

        if (status === 'DONE' && task.createdAt) {
            const timeToCloseMs = Date.now() - new Date(task.createdAt).getTime();
            recordTaskClosed(task.teamId, timeToCloseMs).catch(err => console.error(err));
        }

        return updated;
    },

    async updateTaskImage(taskId, newImageUrl, user) {
        const task = await assertTaskAccess(taskId, user);

        const userId = getUserId(user);
        if (user?.role !== 'manager' && task.assigneeId !== userId) {
            throw new Error('FORBIDDEN');
        }

        return await tasksRepository.updateImage(taskId, newImageUrl);
    },

    async deleteTask(taskId, user) {
        const task = await assertTaskAccess(taskId, user);

        const imageTargets = new Set();
        if (task.imageUrl) imageTargets.add(task.imageUrl);
        if (task.thumbnailUrl) imageTargets.add(task.thumbnailUrl);
        if (Array.isArray(task.imageVersions)) {
            task.imageVersions.forEach((url) => imageTargets.add(url));
        }

        for (const target of imageTargets) {
            await deleteFromS3(target);
        }

        return await tasksRepository.delete(taskId);
    },
};