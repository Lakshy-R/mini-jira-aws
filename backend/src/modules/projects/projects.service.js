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

    async getProjectById(id) {
        return await projectsRepository.getById(id);
    },
};