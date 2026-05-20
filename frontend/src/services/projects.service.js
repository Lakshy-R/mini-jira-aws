import api from './api';

export const projectsService = {
  async getProjects() {
    const res = await api.get('/projects');
    return res.data;
  },

  async createProject(projectData) {
    const res = await api.post('/projects', projectData);
    return res.data;
  },

  async updateProject(projectId, fields) {
    const res = await api.patch(`/projects/${projectId}`, fields);
    return res.data;
  },

  async deleteProject(projectId) {
    const res = await api.delete(`/projects/${projectId}`);
    return res.data;
  },
};
