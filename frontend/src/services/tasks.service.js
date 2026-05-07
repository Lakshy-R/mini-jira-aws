import api from './api';

export const tasksService = {
  getTasks: async () => {
    const res = await api.get('/tasks');
    return res.data;
  },

  createTask: async (data) => {
    const res = await api.post('/tasks', data);
    return res.data;
  },

  updateStatus: async (taskId, status) => {
    const res = await api.patch(`/tasks/${taskId}/status`, { status });
    return res.data;
  },
};
