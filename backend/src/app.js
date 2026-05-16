import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authMiddleware } from './middleware/auth.middleware.js';
import tasksRouter from './modules/tasks/tasks.router.js';

const app = express();

app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  })
);

app.use(helmet());
app.use(express.json());

app.use('/api/tasks', tasksRouter);

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

export default app;