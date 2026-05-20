import { projectsRepository } from './projects.repository.js';
import { v4 as uuid } from 'uuid';

export const projectsService = {
    async createProject(data, user) {
        return await projectsRepository.create({
            projectId: uuid(),
            name: data.name,
            description: data.description,
            teamId: data.teamId,
            createdBy: user.sub,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
    },

    async getProjects(user) {
        const all = await projectsRepository.getAll();

        // managers see all
        if (user.role === 'manager') return all;

        // employees see only their team
        return all.filter(p => p.teamId === user.teamId);
    },

    async getProjectById(id, user) {
        const project = await projectsRepository.getById(id);
        if (!project) return null;

        if (user?.role !== 'manager' && project.teamId !== user?.teamId) {
            return null;
        }

        return project;
    },

    async updateProject(id, data, user) {
        const existing = await projectsRepository.getById(id);
        if (!existing) return null;

        return await projectsRepository.update(id, data);
    },

    async deleteProject(id, user) {
        const existing = await projectsRepository.getById(id);
        if (!existing) return null;

        await projectsRepository.delete(id);
        return true;
    },
};