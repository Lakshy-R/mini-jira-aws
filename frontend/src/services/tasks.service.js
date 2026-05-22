import api from './api';

export const tasksService = {
  async getTasks(options = {}) {
    const params = {};
    if (options.lastKey) params.lastKey = encodeURIComponent(JSON.stringify(options.lastKey));
    if (options.limit) params.limit = options.limit;
    const res = await api.get('/tasks', { params });
    return res.data;
  },

  async getTaskById(taskId) {
    const res = await api.get(`/tasks/${taskId}`);
    return res.data;
  },

  async updateStatus(taskId, status) {
    const res = await api.patch(`/tasks/${taskId}/status`, { status });
    return res.data;
  },

  async updateTask(taskId, fields) {
    const res = await api.patch(`/tasks/${taskId}`, fields);
    return res.data;
  },

  async deleteTask(taskId) {
    const res = await api.delete(`/tasks/${taskId}`);
    return res.data;
  },

  async getComments(taskId) {
    const res = await api.get(`/tasks/${taskId}/comments`);
    return res.data;
  },

  async postComment(taskId, content) {
    const res = await api.post(`/tasks/${taskId}/comments`, { content });
    return res.data;
  },

  async updateComment(taskId, commentId, content) {
    const res = await api.patch(`/tasks/${taskId}/comments/${commentId}`, { content });
    return res.data;
  },

  async deleteComment(taskId, commentId) {
    const res = await api.delete(`/tasks/${taskId}/comments/${commentId}`);
    return res.data;
  },
};

export const createTask = async (taskData, imageFile) => {
  let imageUrl = null;

  if (imageFile) {
    const formData = new FormData();
    formData.append('image', imageFile);
    const uploadRes = await api.post('/upload/task-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    imageUrl = uploadRes.data.imageUrl;
  }

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
