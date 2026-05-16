import { tasksRepository } from './tasks.repository.js';

import { v4 as uuid } from 'uuid';

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

    async deleteTask(taskId) {
        return await tasksRepository.delete(
            taskId
        );
    },
};