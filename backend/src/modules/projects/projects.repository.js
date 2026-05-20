import { ddb } from '../../lib/dynamodb.js';
import {
  PutCommand,
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

  async getAll() {
    const res = await ddb.send(new ScanCommand({ TableName: TABLE }));
    return res.Items || [];
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
