import { teamsService } from './teams.service.js';

export const teamsController = {
    async create(req, res) {
        try {
            const team = await teamsService.createTeam(req.body, req.user);
            return res.status(201).json(team);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },

    async getAll(_req, res) {
        try {
            const teams = await teamsService.getTeams();
            return res.json(teams);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },

    async getOne(req, res) {
        try {
            const team = await teamsService.getTeamById(req.params.id);
            if (!team) return res.status(404).json({ error: 'Team not found' });
            return res.json(team);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },

    async update(req, res) {
        try {
            const team = await teamsService.updateTeam(req.params.id, req.body);
            if (!team) return res.status(404).json({ error: 'Team not found' });
            return res.json(team);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },

    async delete(req, res) {
        try {
            const deleted = await teamsService.deleteTeam(req.params.id);
            if (!deleted) return res.status(404).json({ error: 'Team not found' });
            return res.json({ success: true });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },
};
