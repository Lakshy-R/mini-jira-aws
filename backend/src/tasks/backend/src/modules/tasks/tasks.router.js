import express from 'express';
import { tasksController } from './tasks.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';

const router = express.Router();

// 🔐 protect everything
router.use(authMiddleware);

// GET all tasks (role-aware)
router.get('/', tasksController.getAll);

// GET single task
router.get('/:id', tasksController.getOne);

router.post('/', requireRole('manager'), tasksController.create);

router.patch('/:id/status', tasksController.updateStatus);

export default router;