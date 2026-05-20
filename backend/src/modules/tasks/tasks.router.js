import express from 'express';
import { tasksController } from './tasks.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { upload } from '../../lib/s3.js';
import { CreateTaskSchema, UpdateStatusSchema, UpdateTaskSchema } from './tasks.schema.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', tasksController.getAll);
router.get('/:id', tasksController.getOne);
router.get('/:id/image-url', tasksController.getImageUrl);

router.post('/',
  requireRole('manager'),
  validate(CreateTaskSchema),
  tasksController.create
);

router.patch('/:id/status',
  validate(UpdateStatusSchema),
  tasksController.updateStatus
);

router.patch('/:id/image',
  upload.single('image'),
  tasksController.updateImage
);

router.patch('/:id',
  requireRole('manager'),
  validate(UpdateTaskSchema),
  tasksController.update
);

router.delete('/:id',
  requireRole('manager'),
  tasksController.delete
);

export default router;
