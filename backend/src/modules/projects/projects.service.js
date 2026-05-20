import { projectsRepository } from './projects.repository.js';
import { v4 as uuid } from 'uuid';

export const projectsService = {
  async createProject(data, user) {
    return await projectsRepository.create({
      projectId: uuid(),
      name: data.name,
      description: data.description || '',
      teamId: data.teamId,
      createdBy: user.sub,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  },

  async getProjects(user) {
    const all = await projectsRepository.getAll();
    if (user.role === 'manager') return all;
    return all.filter((p) => p.teamId === user.teamId);
  },

  async getProjectById(id, user) {
    const project = await projectsRepository.getById(id);
    if (!project) return null;
    if (user.role !== 'manager' && project.teamId !== user.teamId) {
      const err = new Error('FORBIDDEN');
      err.code = 'FORBIDDEN';
      throw err;
    }
    return project;
  },

  async updateProject(id, fields, user) {
    const project = await projectsRepository.getById(id);
    if (!project) return null;
    if (user.role !== 'manager' && project.teamId !== user.teamId) {
      const err = new Error('FORBIDDEN');
      err.code = 'FORBIDDEN';
      throw err;
    }
    return await projectsRepository.update(id, fields);
  },

  async deleteProject(id, user) {
    const project = await projectsRepository.getById(id);
    if (!project) return false;
    return await projectsRepository.delete(id);
  },
};
