import { tasksService } from './tasks.service.js';
import { tasksRepository } from './tasks.repository.js';
import { getSignedImageUrl } from '../../lib/s3.js';

const handleError = (res, err, context) => {
  console.error(`[Tasks][${context}]`, err);
  if (err.code === 'FORBIDDEN') return res.status(403).json({ error: 'Access denied' });
  if (err.code === 'INVALID_STATUS') return res.status(400).json({ error: 'Invalid status value' });
  return res.status(500).json({ error: 'Internal server error' });
};

export const tasksController = {
  async create(req, res) {
    try {
      const task = await tasksService.createTask(req.body, req.user);
      res.status(201).json(task);
    } catch (err) {
      handleError(res, err, 'create');
    }
  },

  async getAll(req, res) {
    try {
      const { lastKey, limit } = req.query;
      const options = {
        limit: Math.min(parseInt(limit) || 100, 200),
        lastKey: lastKey ? JSON.parse(decodeURIComponent(lastKey)) : undefined,
      };
      const result = await tasksService.getTasks(req.user, options);
      res.json(result);
    } catch (err) {
      handleError(res, err, 'getAll');
    }
  },

  async getOne(req, res) {
    try {
      const task = await tasksService.getTaskById(req.params.id, req.user);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      res.json(task);
    } catch (err) {
      handleError(res, err, 'getOne');
    }
  },

  async updateStatus(req, res) {
    try {
      const task = await tasksService.updateTaskStatus(
        req.params.id,
        req.body.status,
        req.user
      );
      if (!task) return res.status(404).json({ error: 'Task not found' });
      res.json(task);
    } catch (err) {
      handleError(res, err, 'updateStatus');
    }
  },

  async updateImage(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }
      const updated = await tasksService.updateTaskImage(
        req.params.id,
        req.file.location,
        req.user
      );
      if (!updated) return res.status(404).json({ error: 'Task not found' });
      res.json({ message: 'Image updated', imageUrl: updated.imageUrl, imageVersions: updated.imageVersions });
    } catch (err) {
      handleError(res, err, 'updateImage');
    }
  },

  async update(req, res) {
    try {
      const updated = await tasksService.updateTask(req.params.id, req.body, req.user);
      if (!updated) return res.status(404).json({ error: 'Task not found' });
      res.json(updated);
    } catch (err) {
      handleError(res, err, 'update');
    }
  },

  async delete(req, res) {
    try {
      await tasksService.deleteTask(req.params.id, req.user);
      res.json({ success: true });
    } catch (err) {
      handleError(res, err, 'delete');
    }
  },

  async getImageUrl(req, res) {
    try {
      const task = await tasksRepository.getById(req.params.id);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      if (!task.imageUrl && !task.thumbnailUrl) {
        return res.status(404).json({ error: 'No image attached to this task' });
      }
      const urlOrKey = task.thumbnailUrl || task.imageUrl;
      const bucket = task.thumbnailUrl
        ? process.env.S3_RESIZED_BUCKET
        : process.env.S3_ORIGINALS_BUCKET;
      const signedUrl = await getSignedImageUrl(urlOrKey, bucket);
      res.json({ url: signedUrl });
    } catch (err) {
      handleError(res, err, 'getImageUrl');
    }
  },
};
