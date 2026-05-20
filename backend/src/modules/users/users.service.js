import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'eu-north-1',
});

const mapUser = (cognitoUser) => {
  const attr = (name) =>
    cognitoUser.Attributes?.find((a) => a.Name === name)?.Value ?? null;

  return {
    userId: cognitoUser.Username,
    email: attr('email'),
    name: attr('name') || attr('email'),
    role: attr('custom:role'),
    teamId: attr('custom:teamId'),
    status: cognitoUser.UserStatus,
  };
};

export const usersService = {
  async listUsers() {
    const result = await cognitoClient.send(
      new ListUsersCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        Limit: 60,
      })
    );
    return (result.Users || []).map(mapUser);
  },

  async listTeams() {
    const users = await this.listUsers();
    const teamMap = {};
    for (const u of users) {
      if (u.teamId && !teamMap[u.teamId]) {
        teamMap[u.teamId] = { teamId: u.teamId, name: u.teamId };
      }
    }
    return Object.values(teamMap);
  },

  async listEmployees() {
    const users = await this.listUsers();
    return users.filter((u) => u.role === 'employee');
  },
};
