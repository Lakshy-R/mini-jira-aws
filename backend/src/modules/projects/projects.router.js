import express from 'express';
import { projectsController } from './projects.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', projectsController.getAll);
router.get('/:id', projectsController.getOne);

router.post('/',
  requireRole('manager'),
  projectsController.create
);

router.patch('/:id',
  requireRole('manager'),
  projectsController.update
);

router.delete('/:id',
  requireRole('manager'),
  projectsController.delete
);

export default router;
