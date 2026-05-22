import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import tasksRouter from './modules/tasks/tasks.router.js';
import projectsRouter from './modules/projects/projects.router.js';
import uploadRouter from './modules/upload/upload.router.js';
import commentsRouter from './modules/comments/comments.router.js';
import usersRouter from './modules/users/users.router.js';

import { authMiddleware } from './middleware/auth.middleware.js';
import { multerErrorHandler } from './modules/upload/upload.controller.js';
import { requestId, errorHandler } from './middleware/error.middleware.js';

const app = express();

// Correlation IDs — must be first
app.use(requestId);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      connectSrc:  ["'self'", "https://cognito-idp.eu-north-1.amazonaws.com", "https://*.amazonaws.com"],
      scriptSrc:   ["'self'", "'unsafe-inline'"],
      styleSrc:    ["'self'", "'unsafe-inline'"],
      imgSrc:      ["'self'", "data:", "blob:", "https://*.amazonaws.com"],
      fontSrc:     ["'self'", "data:"],
    },
  },
}));

// CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Structured request logging
app.use(
  morgan(':method :url :status :res[content-length] - :response-time ms', {
    stream: {
      write: (message) =>
        console.log(JSON.stringify({ level: 'info', message: message.trim(), timestamp: new Date().toISOString() })),
    },
  })
);

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// Health check (public — no auth)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'taskflow-api', timestamp: new Date().toISOString() });
});

// Auth debug (protected)
app.get('/api/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

// Application routes
app.use('/api/projects', projectsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/tasks/:taskId/comments', commentsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/users', usersRouter);

// Multer file errors (must come before global handler)
app.use(multerErrorHandler);

// Serve React frontend — must come after all API routes
const DIST = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(DIST));
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

// Global error handler
app.use(errorHandler);

export default app;
