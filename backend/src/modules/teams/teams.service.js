import { v4 as uuid } from 'uuid';
import { teamsRepository } from './teams.repository.js';

export const teamsService = {
    async createTeam(data, user) {
        return await teamsRepository.create({
            teamId: uuid(),
            name: data.name,
            description: data.description || null,
            createdBy: user.sub,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
    },

    async getTeams() {
        return await teamsRepository.getAll();
    },

    async getTeamById(teamId) {
        return await teamsRepository.getById(teamId);
    },

    async updateTeam(teamId, data) {
        const existing = await teamsRepository.getById(teamId);
        if (!existing) return null;

        return await teamsRepository.update(teamId, data);
    },

    async deleteTeam(teamId) {
        const existing = await teamsRepository.getById(teamId);
        if (!existing) return null;

        await teamsRepository.delete(teamId);
        return true;
    },
};
