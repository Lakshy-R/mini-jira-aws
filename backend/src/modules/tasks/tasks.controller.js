import { tasksService } from './tasks.service.js';
import { getSignedImageUrl } from '../../lib/s3.js';

const handleTaskError = (err, res) => {
    if (err.message === 'NOT_FOUND') {
        return res.status(404).json({ error: 'Task not found' });
    }
    if (err.message === 'FORBIDDEN') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    console.error(err);
    return res.status(500).json({ error: err.message });
};

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
                req.params.id,
                req.user
            );

            res.json(task);
        } catch (err) {
            return handleTaskError(err, res);
        }
    },

    async update(req, res) {
        try {
            const updated = await tasksService.updateTask(
                req.params.id,
                req.body,
                req.user
            );

            res.json(updated);
        } catch (err) {
            return handleTaskError(err, res);
        }
    },

    async updateStatus(req, res) {
        try {
            const task =
                await tasksService.updateTaskStatus(
                    req.params.id,
                    req.body.status,
                    req.user
                );

            res.json(task);
        } catch (err) {
            return handleTaskError(err, res);
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

            res.status(200).json({
                message: 'Task image updated.',
                imageUrl: updated.imageUrl,
                imageVersions: updated.imageVersions,
            });
        } catch (err) {
            if (err.message === 'NOT_FOUND') {
                return res.status(404).json({ message: 'Task not found.' });
            }
            if (err.message === 'FORBIDDEN') {
                return res.status(403).json({ message: 'Forbidden.' });
            }
            console.error('[Tasks] updateImage error:', err);
            return res.status(500).json({ message: 'Failed to update task image.' });
        }
    },

    async delete(req, res) {
        try {
            await tasksService.deleteTask(
                req.params.id,
                req.user
            );

            res.json({
                success: true,
            });
        } catch (err) {
            return handleTaskError(err, res);
        }
    },

    async getImageUrl(req, res) {
        try {
            const task = await tasksService.getTaskById(
                req.params.id,
                req.user
            );

            const signedUrl = await getSignedImageUrl(task.imageUrl);
            res.json({ url: signedUrl });
        } catch (err) {
            if (err.message === 'NOT_FOUND') {
                return res.status(404).json({ error: 'Task not found' });
            }
            if (err.message === 'FORBIDDEN') {
                return res.status(403).json({ error: 'Forbidden' });
            }
            console.error('[Tasks] getImageUrl error:', err);
            return res.status(500).json({ error: 'Failed to generate image URL.' });
        }
    },
};