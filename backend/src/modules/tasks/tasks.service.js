import { tasksRepository } from './tasks.repository.js';

import { v4 as uuid } from 'uuid';
import { deleteFromS3 } from '../../lib/s3.js';

export const tasksService = {
    async createTask(data, user) {
        return await tasksRepository.create({
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
    },

    async getTasks(user) {
        // Employee → only own team
        if (
            user?.role !== 'manager' &&
            user?.teamId
        ) {
            const result =
                await tasksRepository.getByTeam(
                    user.teamId
                );

            return result.Items || [];
        }

        // Manager → all tasks
        const result =
            await tasksRepository.getAll();

        return result.Items || [];
    },

    async getTaskById(taskId) {
        return await tasksRepository.getById(
            taskId
        );
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