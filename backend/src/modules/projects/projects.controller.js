import { projectsService } from './projects.service.js';
import { asyncHandler } from '../../middleware/error.middleware.js';

export const projectsController = {
  create: asyncHandler(async (req, res) => {
    const project = await projectsService.createProject(req.body, req.user);
    res.status(201).json(project);
  }),

  getAll: asyncHandler(async (req, res) => {
    const projects = await projectsService.getProjects(req.user);
    res.json(projects);
  }),

  getOne: asyncHandler(async (req, res) => {
    const project = await projectsService.getProjectById(req.params.id, req.user);
    res.json(project);
  }),

  update: asyncHandler(async (req, res) => {
    const updated = await projectsService.updateProject(req.params.id, req.body, req.user);
    res.json(updated);
  }),

  delete: asyncHandler(async (req, res) => {
    await projectsService.deleteProject(req.params.id, req.user);
    res.json({ success: true });
  }),
};
