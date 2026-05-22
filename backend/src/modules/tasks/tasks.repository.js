import { ddb } from '../../lib/dynamodb.js';
import {
  PutCommand,
  QueryCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';

const TABLE = process.env.DYNAMODB_TASKS_TABLE || 'Tasks';

// ─── Pagination Token Validation ────────────────────────────────────────────
// DynamoDB LastEvaluatedKey shapes vary by access pattern.
// We accept any object whose PK (taskId) is a valid UUID.
const LastKeySchema = z
  .object({ taskId: z.string().uuid() })
  .passthrough(); // allow SK and GSI key fields through without listing them all

export const parsePaginationKey = (raw) => {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    const result = LastKeySchema.safeParse(parsed);
    if (!result.success) return undefined;
    return result.data;
  } catch {
    return undefined;
  }
};

// ─── Repository ─────────────────────────────────────────────────────────────
export const tasksRepository = {
  async create(data) {
    const task = {
      taskId:    uuid(),              // repository owns ID generation
      entity:    'TASK',             // synthetic PK for manager GSI
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status:    'TODO',
      imageVersions: data.imageUrl ? [data.imageUrl] : [],
      ...data,
    };
    // Ensure entity is never overridden by caller
    task.entity = 'TASK';

    await ddb.send(new PutCommand({ TableName: TABLE, Item: task }));
    return task;
  },

  /**
   * Manager all-tasks query — uses entity-createdAt-index GSI.
   * O(log n) + page-size reads instead of full-table Scan.
   * Newest first. Paginated.
   */
  async queryAll({ limit = 100, lastKey } = {}) {
    const params = {
      TableName: TABLE,
      IndexName: 'entity-createdAt-index',
      KeyConditionExpression: '#entity = :entity',
      ExpressionAttributeNames: { '#entity': 'entity' },
      ExpressionAttributeValues: { ':entity': 'TASK' },
      ScanIndexForward: false, // newest first
      Limit: limit,
    };
    if (lastKey) params.ExclusiveStartKey = lastKey;
    return await ddb.send(new QueryCommand(params));
  },

  /**
   * Employee scoped query — uses teamId-createdAt-index GSI.
   * Newest first. Paginated.
   */
  async getByTeam(teamId, { limit = 100, lastKey } = {}) {
    const params = {
      TableName: TABLE,
      IndexName: 'teamId-createdAt-index',
      KeyConditionExpression: 'teamId = :teamId',
      ExpressionAttributeValues: { ':teamId': teamId },
      ScanIndexForward: false,
      Limit: limit,
    };
    if (lastKey) params.ExclusiveStartKey = lastKey;
    return await ddb.send(new QueryCommand(params));
  },

  /**
   * Assignee query — uses assigneeId-createdAt-index GSI.
   * Required for the daily-digest Lambda and per-user task views.
   */
  async getByAssignee(assigneeId, { limit = 100, lastKey } = {}) {
    const params = {
      TableName: TABLE,
      IndexName: 'assigneeId-createdAt-index',
      KeyConditionExpression: 'assigneeId = :assigneeId',
      ExpressionAttributeValues: { ':assigneeId': assigneeId },
      ScanIndexForward: false,
      Limit: limit,
    };
    if (lastKey) params.ExclusiveStartKey = lastKey;
    return await ddb.send(new QueryCommand(params));
  },

  async getById(taskId) {
    const result = await ddb.send(
      new GetCommand({ TableName: TABLE, Key: { taskId } })
    );
    return result.Item;
  },

  async updateStatus(taskId, status) {
    const result = await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { taskId },
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status':    status,
          ':updatedAt': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
      })
    );
    return result.Attributes;
  },

  async updateImage(taskId, newImageUrl) {
    const existing = await this.getById(taskId);
    if (!existing) return null;

    const versions = Array.isArray(existing.imageVersions)
      ? [...existing.imageVersions]
      : existing.imageUrl ? [existing.imageUrl] : [];

    if (existing.imageUrl && existing.imageUrl !== newImageUrl) {
      versions.push(existing.imageUrl);
    }

    const result = await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { taskId },
        UpdateExpression: 'SET imageUrl = :url, imageVersions = :versions, updatedAt = :now',
        ExpressionAttributeValues: {
          ':url':      newImageUrl,
          ':versions': versions,
          ':now':      new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
      })
    );
    return result.Attributes;
  },

  async update(taskId, fields) {
    const now = new Date().toISOString();
    const sets   = ['updatedAt = :now'];
    const names  = {};
    const values = { ':now': now };

    const allowed = ['title', 'description', 'priority', 'assigneeId', 'projectId', 'deadline'];
    // NOTE: teamId is intentionally excluded — reassigning a task to another
    // team requires a dedicated workflow, not a silent field update.
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
        Key: { taskId },
        UpdateExpression: `SET ${sets.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: 'ALL_NEW',
      })
    );
    return result.Attributes;
  },

  async delete(taskId) {
    await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { taskId } }));
    return true;
  },
};
