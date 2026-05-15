import { tasksRepository } from './tasks.repository.js';

export const tasksService = {
    async createTask(data, user) {
        return await tasksRepository.create({
            ...data,
            createdBy: user.sub,
            managerId: user.sub,
        });
    },

    async getTasks(user) {
        // Manager sees all tasks
        if (user.role === 'manager') {
            const result = await tasksRepository.getAll();
            return result.Items || [];
        }

        // Employee only sees own team
        const result = await tasksRepository.getByTeam(
            user.teamId
        );

        return result.Items || [];
    },

    async getTaskById(taskId) {
        return await tasksRepository.getById(taskId);
    },

    async updateTaskStatus(taskId, status) {
        return await tasksRepository.updateStatus(
            taskId,
            status
        );
    },

    async deleteTask(taskId) {
        return await tasksRepository.delete(taskId);
    },
};