import { ddb } from '../../lib/dynamodb.js';
import {
  PutCommand,
  QueryCommand,
  ScanCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

const TABLE = process.env.DYNAMODB_PROJECTS_TABLE || 'Projects';

export const projectsRepository = {
  async create(project) {
    await ddb.send(new PutCommand({ TableName: TABLE, Item: project }));
    return project;
  },

  /**
   * Always uses the teamId-createdAt-index GSI.
   * The GSI is now created unconditionally (via CDK + migration script).
   */
  async getByTeam(teamId, { limit = 50, lastKey } = {}) {
    const params = {
      TableName: TABLE,
      IndexName: 'teamId-createdAt-index',
      KeyConditionExpression: 'teamId = :teamId',
      ExpressionAttributeValues: { ':teamId': teamId },
      ScanIndexForward: false, // newest first
      Limit: limit,
    };
    if (lastKey) params.ExclusiveStartKey = lastKey;
    const res = await ddb.send(new QueryCommand(params));
    return { items: res.Items || [], lastKey: res.LastEvaluatedKey || null };
  },

  async getAll({ limit = 100, lastKey } = {}) {
    // Managers: scan is acceptable for projects (typically small count)
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
    const now    = new Date().toISOString();
    const sets   = ['updatedAt = :now'];
    const names  = {};
    const values = { ':now': now };

    const allowed = ['name', 'description'];
    // teamId excluded — reassigning a project to another team is a dedicated operation
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
        Key:       { projectId },
        UpdateExpression:          `SET ${sets.join(', ')}`,
        ExpressionAttributeNames:  names,
        ExpressionAttributeValues: values,
        ReturnValues:              'ALL_NEW',
      })
    );
    return result.Attributes;
  },

  async delete(projectId) {
    await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { projectId } }));
    return true;
  },
};
