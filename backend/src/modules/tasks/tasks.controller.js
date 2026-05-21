import { tasksService } from './tasks.service.js';
import { tasksRepository } from './tasks.repository.js';
import { auditRepository } from './audit.repository.js';
import { getSignedImageUrl } from '../../lib/s3.js';
import { asyncHandler, NotFoundError, ValidationError, ForbiddenError } from '../../middleware/error.middleware.js';
import { parsePaginationKey } from './tasks.repository.js';

export const tasksController = {
  create: asyncHandler(async (req, res) => {
    const task = await tasksService.createTask(req.body, req.user);
    res.status(201).json(task);
  }),

  getAll: asyncHandler(async (req, res) => {
    const { lastKey, limit } = req.query;
    const options = {
      limit:   Math.min(parseInt(limit) || 100, 200),
      lastKey: parsePaginationKey(lastKey),
    };
    const result = await tasksService.getTasks(req.user, options);
    res.json(result);
  }),

  getOne: asyncHandler(async (req, res) => {
    const task = await tasksService.getTaskById(req.params.id, req.user);
    if (!task) throw new NotFoundError('Task');
    res.json(task);
  }),

  updateStatus: asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!status) throw new ValidationError('status is required');
    const task = await tasksService.updateTaskStatus(req.params.id, status, req.user);
    if (!task) throw new NotFoundError('Task');
    res.json(task);
  }),

  updateImage: asyncHandler(async (req, res) => {
    if (!req.file) throw new ValidationError('No image file provided');
    const updated = await tasksService.updateTaskImage(req.params.id, req.file.location, req.user);
    if (!updated) throw new NotFoundError('Task');
    res.json({ message: 'Image updated', imageUrl: updated.imageUrl, imageVersions: updated.imageVersions });
  }),

  update: asyncHandler(async (req, res) => {
    const updated = await tasksService.updateTask(req.params.id, req.body, req.user);
    if (!updated) throw new NotFoundError('Task');
    res.json(updated);
  }),

  delete: asyncHandler(async (req, res) => {
    await tasksService.deleteTask(req.params.id, req.user);
    res.json({ success: true });
  }),

  getImageUrl: asyncHandler(async (req, res) => {
    const task = await tasksRepository.getById(req.params.id);
    if (!task) throw new NotFoundError('Task');
    if (req.user.role !== 'manager' && task.teamId !== req.user.teamId) throw new ForbiddenError();
    if (!task.imageUrl && !task.thumbnailUrl) throw new NotFoundError('Task image');

    const urlOrKey = task.thumbnailUrl || task.imageUrl;
    const bucket   = task.thumbnailUrl ? process.env.S3_RESIZED_BUCKET : process.env.S3_ORIGINALS_BUCKET;
    const url      = await getSignedImageUrl(urlOrKey, bucket);
    res.json({ url });
  }),

  // GET /api/tasks/:id/history — returns full audit trail for a task
  getHistory: asyncHandler(async (req, res) => {
    const task = await tasksRepository.getById(req.params.id);
    if (!task) throw new NotFoundError('Task');
    if (req.user.role !== 'manager' && task.teamId !== req.user.teamId) throw new ForbiddenError();

    const history = await auditRepository.getByTaskId(req.params.id);
    res.json(history);
  }),
};
