import { usersService } from './users.service.js';

export const usersController = {
  async listUsers(req, res) {
    try {
      const users = await usersService.listUsers();
      res.json(users);
    } catch (err) {
      console.error('[Users] listUsers error:', err);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  },

  async listEmployees(req, res) {
    try {
      const employees = await usersService.listEmployees();
      res.json(employees);
    } catch (err) {
      console.error('[Users] listEmployees error:', err);
      res.status(500).json({ error: 'Failed to fetch employees' });
    }
  },

  async listTeams(req, res) {
    try {
      const teams = await usersService.listTeams();
      res.json(teams);
    } catch (err) {
      console.error('[Users] listTeams error:', err);
      res.status(500).json({ error: 'Failed to fetch teams' });
    }
  },
};
