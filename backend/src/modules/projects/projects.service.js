import { projectsRepository } from './projects.repository.js';
import { v4 as uuid } from 'uuid';
import { ForbiddenError, NotFoundError } from '../../middleware/error.middleware.js';

export const projectsService = {
  async createProject(data, user) {
    return await projectsRepository.create({
      projectId: uuid(),
      name: data.name.trim(),
      description: (data.description || '').trim(),
      teamId: data.teamId,
      createdBy: user.sub,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  },

  async getProjects(user, options = {}) {
    if (user.role === 'manager') {
      const result = await projectsRepository.getAll(options);
      return result.items;
    }
    const result = await projectsRepository.getByTeam(user.teamId, options);
    return result.items;
  },

  async getProjectById(id, user) {
    const project = await projectsRepository.getById(id);
    if (!project) throw new NotFoundError('Project');

    if (user.role !== 'manager' && project.teamId !== user.teamId) {
      throw new ForbiddenError();
    }
    return project;
  },

  async updateProject(id, fields, user) {
    const project = await projectsRepository.getById(id);
    if (!project) throw new NotFoundError('Project');

    if (user.role !== 'manager') throw new ForbiddenError();

    return await projectsRepository.update(id, fields);
  },

  async deleteProject(id, user) {
    const project = await projectsRepository.getById(id);
    if (!project) throw new NotFoundError('Project');

    if (user.role !== 'manager') throw new ForbiddenError();

    return await projectsRepository.delete(id);
  },
};
