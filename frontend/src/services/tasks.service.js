import api from './api';

export const tasksService = {
  async getTasks() {
    const res = await api.get('/tasks');
    return res.data;
  },

  async getTaskById(taskId) {
    const res = await api.get(`/tasks/${taskId}`);
    return res.data;
  },

  async updateStatus(taskId, status) {
    const res = await api.patch(`/tasks/${taskId}/status`, {
      status,
    });
    return res.data;
  },

  async deleteTask(taskId) {
    const res = await api.delete(`/tasks/${taskId}`);
    return res.data;
  },
};

export const createTask = async (taskData, imageFile) => {
  // 1. Upload image if exists
  let imageUrl = null;
  if (imageFile) {
    const formData = new FormData();
    formData.append('image', imageFile);
    const uploadRes = await api.post('/upload/task-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    imageUrl = uploadRes.data.imageUrl;
  }

  // 2. Create task
  const res = await api.post('/tasks', { ...taskData, imageUrl });
  return res.data;
};

export const updateTaskImage = async (taskId, imageFile) => {
  const formData = new FormData();
  formData.append('image', imageFile);
  const res = await api.patch(`/tasks/${taskId}/image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};