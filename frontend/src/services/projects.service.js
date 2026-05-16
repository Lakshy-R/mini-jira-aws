import api from './api';

export const projectsService = {
    async getProjects() {
        const res = await api.get('/projects');
        return res.data;
    },

    async createProject(projectData) {
        const res = await api.post(
            '/projects',
            projectData
        );

        return res.data;
    },
};