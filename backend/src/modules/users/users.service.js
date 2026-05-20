import { v4 as uuid } from 'uuid';
import { usersRepository } from './users.repository.js';

export const usersService = {
    async createUser(data, user) {
        const userId = data.userId || uuid();

        return await usersRepository.create({
            userId,
            name: data.name || null,
            email: data.email || null,
            role: data.role || 'employee',
            teamId: data.teamId || null,
            createdBy: user.sub,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
    },

    async getUsers() {
        return await usersRepository.getAll();
    },

    async getUserById(userId) {
        return await usersRepository.getById(userId);
    },

    async updateUser(userId, data) {
        const existing = await usersRepository.getById(userId);
        if (!existing) return null;

        return await usersRepository.update(userId, data);
    },

    async deleteUser(userId) {
        const existing = await usersRepository.getById(userId);
        if (!existing) return null;

        await usersRepository.delete(userId);
        return true;
    },
};
