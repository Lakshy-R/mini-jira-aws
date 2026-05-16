import { projectsService } from './projects.service.js';

export const projectsController = {
    async create(req, res) {
        try {
            const project = await projectsService.createProject(req.body, req.user);
            res.status(201).json(project);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async getAll(req, res) {
        try {
            const projects = await projectsService.getProjects(req.user);
            res.json(projects);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async getOne(req, res) {
        try {
            const project = await projectsService.getProjectById(req.params.id);
            res.json(project);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },
};