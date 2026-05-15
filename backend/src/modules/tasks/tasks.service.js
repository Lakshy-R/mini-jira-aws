import { tasksRepository } from './tasks.repository.js';

export const tasksService = {
    async createTask(data, user) {
        return await tasksRepository.create({
            ...data,
            createdBy: user.sub,
            managerId: user.sub,
            teamId: data.teamId,
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