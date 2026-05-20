import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authMiddleware } from './middleware/auth.middleware.js';
import tasksRouter from './modules/tasks/tasks.router.js';
import projectsRouter from './modules/projects/projects.router.js';
import uploadRouter from './modules/upload/upload.router.js';
import commentsRouter from './modules/comments/comments.router.js';
import teamsRouter from './modules/teams/teams.router.js';
import usersRouter from './modules/users/users.router.js';

import { multerErrorHandler } from './modules/upload/upload.controller.js';

const app = express();

app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  })
);

app.use(helmet());
app.use(express.json());

app.use('/api/projects', projectsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/tasks/:taskId/comments', commentsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/users', usersRouter);

// ❌ DO NOT apply globally yet (we will refine later)
// app.use(authMiddleware);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Mini Jira API running',
  });
});

// 🔍 Debug: inspect what your token contains
app.get('/api/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

// Add multer error handler
app.use(multerErrorHandler);

export default app;