import api from './api';

export const usersService = {
  async getEmployees() {
    const res = await api.get('/users/employees');
    return res.data;
  },

  async getTeams() {
    const res = await api.get('/users/teams');
    return res.data;
  },
};
