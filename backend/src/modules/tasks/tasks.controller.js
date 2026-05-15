import { tasksService } from './tasks.service.js';

export const tasksController = {
    async create(req, res) {
        try {
            const task = await tasksService.createTask(
                req.body,
                req.user
            );

            res.status(201).json(task);
        } catch (err) {
            console.error(err);

            res.status(500).json({
                error: err.message,
            });
        }
    },

    async getAll(req, res) {
        try {
            const tasks = await tasksService.getTasks(
                req.user
            );

            res.json(tasks);
        } catch (err) {
            console.error(err);

            res.status(500).json({
                error: err.message,
            });
        }
    },

    async getOne(req, res) {
        try {
            const task = await tasksService.getTaskById(
                req.params.id
            );

            if (!task) {
                return res.status(404).json({
                    error: 'Task not found',
                });
            }

            res.json(task);
        } catch (err) {
            console.error(err);

            res.status(500).json({
                error: err.message,
            });
        }
    },

    async updateStatus(req, res) {
        try {
            const task =
                await tasksService.updateTaskStatus(
                    req.params.id,
                    req.body.status
                );

            res.json(task);
        } catch (err) {
            console.error(err);

            res.status(500).json({
                error: err.message,
            });
        }
    },

    async delete(req, res) {
        try {
            await tasksService.deleteTask(req.params.id);

            res.json({
                success: true,
            });
        } catch (err) {
            console.error(err);

            res.status(500).json({
                error: err.message,
            });
        }
    },
};