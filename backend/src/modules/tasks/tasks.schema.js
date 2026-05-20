import { z } from 'zod';

export const TASK_STATUS = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  IN_REVIEW: 'IN_REVIEW',
  DONE: 'DONE',
};

export const TASK_PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
};

export const CreateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').trim(),
  description: z.string().max(2000, 'Description too long').trim().optional().default(''),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  teamId: z.string().min(1, 'Team is required').trim(),
  assigneeId: z.string().min(1, 'Assignee is required').trim(),
  projectId: z.string().trim().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  deadline: z.string().optional().nullable(),
});

export const UpdateStatusSchema = z.object({
  status: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']),
});

export const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(2000).trim().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  teamId: z.string().min(1).trim().optional(),
  assigneeId: z.string().min(1).trim().optional(),
  projectId: z.string().trim().nullable().optional(),
  deadline: z.string().nullable().optional(),
});
