import express from 'express';
import { usersController } from './users.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';

const router = express.Router();

router.use(authMiddleware);

// All authenticated users can list employees and teams (needed for dropdowns)
router.get('/employees', usersController.listEmployees);
router.get('/teams', usersController.listTeams);

// Full user list is manager-only
router.get('/', requireRole('manager'), usersController.listUsers);

export default router;
