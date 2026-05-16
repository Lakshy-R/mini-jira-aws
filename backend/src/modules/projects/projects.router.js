import express from 'express';
import { projectsController } from './projects.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';

const router = express.Router();

router.use(authMiddleware);

// GET all projects
router.get('/', projectsController.getAll);

// GET project by id
router.get('/:id', projectsController.getOne);

// CREATE project (manager only)
router.post(
    '/',
    requireRole('manager'),
    projectsController.create
);

export default router;