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
    email:  attr('email'),
    name:   attr('name') || attr('email'),
    role:   attr('custom:role'),
    teamId: attr('custom:teamId'),
    status: cognitoUser.UserStatus,
  };
};

/**
 * Paginates through ALL Cognito users — no hard 60-user cap.
 * Cognito's max per-page is 60; this loop collects all pages.
 */
const listAllUsers = async () => {
  const users      = [];
  let paginationToken;

  do {
    const command = new ListUsersCommand({
      UserPoolId:      process.env.COGNITO_USER_POOL_ID,
      Limit:           60,
      PaginationToken: paginationToken,
    });

    const result   = await cognitoClient.send(command);
    const page     = (result.Users || []).map(mapUser);
    users.push(...page);
    paginationToken = result.PaginationToken;
  } while (paginationToken);

  return users;
};

export const usersService = {
  async listUsers() {
    return listAllUsers();
  },

  async listTeams() {
    const users   = await listAllUsers();
    const teamMap = {};
    for (const u of users) {
      if (u.teamId && !teamMap[u.teamId]) {
        teamMap[u.teamId] = { teamId: u.teamId, name: u.teamId };
      }
    }
    return Object.values(teamMap);
  },

  async listEmployees() {
    const users = await listAllUsers();
    return users.filter((u) => u.role === 'employee');
  },
};
