import { projectsService } from './projects.service.js';

const handleError = (res, err, context) => {
  console.error(`[Projects][${context}]`, err);
  if (err.code === 'FORBIDDEN') return res.status(403).json({ error: 'Access denied' });
  return res.status(500).json({ error: 'Internal server error' });
};

export const projectsController = {
  async create(req, res) {
    try {
      const project = await projectsService.createProject(req.body, req.user);
      res.status(201).json(project);
    } catch (err) {
      handleError(res, err, 'create');
    }
  },

  async getAll(req, res) {
    try {
      const projects = await projectsService.getProjects(req.user);
      res.json(projects);
    } catch (err) {
      handleError(res, err, 'getAll');
    }
  },

  async getOne(req, res) {
    try {
      const project = await projectsService.getProjectById(req.params.id, req.user);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      res.json(project);
    } catch (err) {
      handleError(res, err, 'getOne');
    }
  },

  async update(req, res) {
    try {
      const updated = await projectsService.updateProject(req.params.id, req.body, req.user);
      if (!updated) return res.status(404).json({ error: 'Project not found' });
      res.json(updated);
    } catch (err) {
      handleError(res, err, 'update');
    }
  },

  async delete(req, res) {
    try {
      const deleted = await projectsService.deleteProject(req.params.id, req.user);
      if (!deleted) return res.status(404).json({ error: 'Project not found' });
      res.json({ success: true });
    } catch (err) {
      handleError(res, err, 'delete');
    }
  },
};
