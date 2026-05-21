import { ddb } from '../../lib/dynamodb.js';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const TABLE = process.env.DYNAMODB_ACTIVITY_LOGS_TABLE || 'ActivityLogs';

export const AUDIT_ACTIONS = {
  TASK_CREATED:   'TASK_CREATED',
  TASK_DELETED:   'TASK_DELETED',
  TASK_ASSIGNED:  'TASK_ASSIGNMENT',
  STATUS_CHANGED: 'STATUS_CHANGE',
  IMAGE_UPDATED:  'IMAGE_UPDATED',
  TASK_UPDATED:   'TASK_UPDATED',
};

/**
 * Write one immutable audit entry.
 * Returns the written item (useful for callers that want to chain or log).
 */
export const auditRepository = {
  async log({ taskId, action, actorId, actorRole, metadata = {} }) {
    const item = {
      logId: uuidv4(),
      taskId,
      action,
      actorId,
      actorRole,
      timestamp: new Date().toISOString(),
      ...metadata,
    };
    await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
    return item;
  },

  /**
   * Requires GSI: taskId-timestamp-index (PK=taskId, SK=timestamp)
   * Returns entries in chronological order (oldest first).
   */
  async getByTaskId(taskId) {
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: 'taskId-timestamp-index',
        KeyConditionExpression: 'taskId = :taskId',
        ExpressionAttributeValues: { ':taskId': taskId },
        ScanIndexForward: true,
      })
    );
    return result.Items || [];
  },
};
