import { tasksService } from './tasks.service.js';
import { tasksRepository } from './tasks.repository.js';
import { getSignedImageUrl } from '../../lib/s3.js';

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

    async updateImage(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ message: 'No image file provided.' });
            }

            const updated = await tasksService.updateTaskImage(
                req.params.id,
                req.file.location,
                req.user
            );

            if (!updated) {
                return res.status(404).json({ message: 'Task not found.' });
            }

            res.status(200).json({
                message: 'Task image updated.',
                imageUrl: updated.imageUrl,
                imageVersions: updated.imageVersions,
            });
        } catch (err) {
            console.error('[Tasks] updateImage error:', err);
            res.status(500).json({ message: 'Failed to update task image.' });
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

    async getImageUrl(req, res) {
        try {
            const task = await tasksRepository.getById(req.params.id);
            if (!task) return res.status(404).json({ error: 'Task not found' });

            const signedUrl = await getSignedImageUrl(task.imageUrl);
            res.json({ url: signedUrl });
        } catch (err) {
            console.error('[Tasks] getImageUrl error:', err);
            res.status(500).json({ error: 'Failed to generate image URL.' });
        }
    },
};