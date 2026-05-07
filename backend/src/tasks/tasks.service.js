import { tasksRepository } from './tasks.repository.js';

export const tasksService = {
    async createTask(data, user) {
        // Only manager can create tasks (enforced later in routes)
        return await tasksRepository.create({
            ...data,
            createdBy: user.sub,
            managerId: user.sub,
        });
    },

    async getTasks(user) {
        // 🔥 CORE REQUIREMENT: team isolation
        let res;
        if (user.role === 'manager') {
            res = await tasksRepository.getAll();
        } else {
            res = await tasksRepository.getByTeam(user.teamId);
        }
        return res.Items;
    },

    async getTaskById(taskId) {
        return await tasksRepository.getById(taskId);
    },

    async updateTaskStatus(taskId, status) {
        return await tasksRepository.updateStatus(taskId, status);
    },
};