import { ddb } from '../../lib/dynamodb.js';
import {
  PutCommand,
  ScanCommand,
  QueryCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

const TABLE = process.env.DYNAMODB_PROJECTS_TABLE || 'Projects';

/*
 * NOTE: A `teamId-createdAt-index` GSI on the Projects table would replace the
 * full-table Scan in `getByTeam`. Add it in your CloudFormation template:
 *   IndexName: teamId-createdAt-index
 *   KeySchema: [{ teamId: HASH }, { createdAt: RANGE }]
 *   Projection: ALL
 * Until then, getByTeam falls back to Scan + in-memory filter.
 */

const HAS_TEAM_GSI = process.env.PROJECTS_TEAM_GSI === 'true';

export const projectsRepository = {
  async create(project) {
    await ddb.send(new PutCommand({ TableName: TABLE, Item: project }));
    return project;
  },

  /* Efficient path: GSI query — enabled via PROJECTS_TEAM_GSI=true env var */
  async getByTeam(teamId, { limit = 50, lastKey } = {}) {
    if (HAS_TEAM_GSI) {
      const params = {
        TableName: TABLE,
        IndexName: 'teamId-createdAt-index',
        KeyConditionExpression: 'teamId = :teamId',
        ExpressionAttributeValues: { ':teamId': teamId },
        ScanIndexForward: false,
        Limit: limit,
      };
      if (lastKey) params.ExclusiveStartKey = lastKey;
      const res = await ddb.send(new QueryCommand(params));
      return { items: res.Items || [], lastKey: res.LastEvaluatedKey || null };
    }

    /* Fallback: filtered scan (acceptable at startup scale) */
    const params = {
      TableName: TABLE,
      FilterExpression: 'teamId = :teamId',
      ExpressionAttributeValues: { ':teamId': teamId },
    };
    const res = await ddb.send(new ScanCommand(params));
    return { items: res.Items || [], lastKey: null };
  },

  async getAll({ limit = 100, lastKey } = {}) {
    const params = { TableName: TABLE, Limit: limit };
    if (lastKey) params.ExclusiveStartKey = lastKey;
    const res = await ddb.send(new ScanCommand(params));
    return { items: res.Items || [], lastKey: res.LastEvaluatedKey || null };
  },

  async getById(projectId) {
    const res = await ddb.send(
      new GetCommand({ TableName: TABLE, Key: { projectId } })
    );
    return res.Item;
  },

  async update(projectId, fields) {
    const now = new Date().toISOString();
    const sets = ['updatedAt = :now'];
    const names = {};
    const values = { ':now': now };

    const allowed = ['name', 'description', 'teamId'];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        sets.push(`#${key} = :${key}`);
        names[`#${key}`] = key;
        values[`:${key}`] = fields[key];
      }
    }

    const result = await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { projectId },
        UpdateExpression: `SET ${sets.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: 'ALL_NEW',
      })
    );
    return result.Attributes;
  },

  async delete(projectId) {
    await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { projectId } }));
    return true;
  },
};
