import express from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { teamsController } from './teams.controller.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requireRole('manager'));

router.get('/', teamsController.getAll);
router.get('/:id', teamsController.getOne);
router.post('/', teamsController.create);
router.patch('/:id', teamsController.update);
router.delete('/:id', teamsController.delete);

export default router;
