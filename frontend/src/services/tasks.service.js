import api from './api';

export const tasksService = {
  async getTasks() {
    const res = await api.get('/tasks');
    return res.data;
  },

  async createTask(taskData) {
    const res = await api.post('/tasks', taskData);
    return res.data;
  },

  async updateStatus(taskId, status) {
    const res = await api.patch(`/tasks/${taskId}/status`, {
      status,
    });

    return res.data;
  },
};