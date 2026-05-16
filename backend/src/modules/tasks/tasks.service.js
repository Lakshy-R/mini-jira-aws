import { tasksRepository } from './tasks.repository.js';
import { v4 as uuid } from 'uuid';
import { deleteFromS3, getSignedImageUrl } from '../../lib/s3.js';
import { publishTaskAssignment } from '../../lib/sns.js';

export const tasksService = {
    async createTask(data, user) {
        const task = await tasksRepository.create({
            taskId: uuid(),
            title: data.title,
            description: data.description,
            status: 'TODO',
            priority: data.priority,
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

    async getTaskById(taskId) {
        const task = await tasksRepository.getById(taskId);
        if (task) {
            const urlOrKey = task.thumbnailUrl || task.imageUrl;
            if (urlOrKey) {
                const bucket = task.thumbnailUrl ? process.env.S3_RESIZED_BUCKET : process.env.S3_ORIGINALS_BUCKET;
                task.presignedUrl = await getSignedImageUrl(urlOrKey, bucket);
            }
        }
        return task;
    },

    async updateTaskStatus(
        taskId,
        status
    ) {
        return await tasksRepository.updateStatus(
            taskId,
            status
        );
    },

    async updateTaskImage(taskId, newImageUrl, user) {
        const task = await this.getTaskById(taskId);
        if (!task) return null;

        return await tasksRepository.updateImage(taskId, newImageUrl);
    },

    async deleteTask(taskId) {
        const task = await tasksRepository.getById(taskId);
        if (!task) return false;

        if (task.imageUrl) {
            await deleteFromS3(task.imageUrl);
        }

        return await tasksRepository.delete(taskId);
    },
};