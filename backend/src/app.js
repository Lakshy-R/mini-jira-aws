import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import tasksRouter from './modules/tasks/tasks.router.js';
import projectsRouter from './modules/projects/projects.router.js';
import uploadRouter from './modules/upload/upload.router.js';
import commentsRouter from './modules/comments/comments.router.js';
import usersRouter from './modules/users/users.router.js';

import { authMiddleware } from './middleware/auth.middleware.js';
import { multerErrorHandler } from './modules/upload/upload.controller.js';

const app = express();

// Security headers
app.use(helmet());

// CORS — reads from env so it works both locally and in production behind CloudFront
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Logging
app.use(morgan('dev'));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// Routes
app.use('/api/projects', projectsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/tasks/:taskId/comments', commentsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/users', usersRouter);

// Health check (public)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Mini Jira API running' });
});

// Auth debug (protected)
app.get('/api/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

// Multer file-size / type errors
app.use(multerErrorHandler);

// Global error handler — catches anything passed to next(err)
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Unhandled error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
