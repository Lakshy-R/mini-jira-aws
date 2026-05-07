import { tasksService } from './tasks.service.js';

export const tasksController = {
    async create(req, res) {
        try {
            const task = await tasksService.createTask(req.body, req.user);
            res.status(201).json(task);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async getAll(req, res) {
        try {
            const tasks = await tasksService.getTasks(req.user);
            res.json(tasks);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async getOne(req, res) {
        try {
            const task = await tasksService.getTaskById(req.params.id);
            res.json(task);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async updateStatus(req, res) {
        try {
            const { status } = req.body;
            const updated = await tasksService.updateTaskStatus(req.params.id, status);
            res.json(updated);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },
};