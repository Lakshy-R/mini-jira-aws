import { usersService } from './users.service.js';

export const usersController = {
    async create(req, res) {
        try {
            const created = await usersService.createUser(req.body, req.user);
            return res.status(201).json(created);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },

    async getAll(_req, res) {
        try {
            const users = await usersService.getUsers();
            return res.json(users);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },

    async getOne(req, res) {
        try {
            const user = await usersService.getUserById(req.params.id);
            if (!user) return res.status(404).json({ error: 'User not found' });
            return res.json(user);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },

    async update(req, res) {
        try {
            const user = await usersService.updateUser(req.params.id, req.body);
            if (!user) return res.status(404).json({ error: 'User not found' });
            return res.json(user);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },

    async delete(req, res) {
        try {
            const deleted = await usersService.deleteUser(req.params.id);
            if (!deleted) return res.status(404).json({ error: 'User not found' });
            return res.json({ success: true });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },
};
