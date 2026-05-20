import { PutCommand, QueryCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb } from '../../lib/dynamodb.js';
import { v4 as uuidv4 } from 'uuid';

const TABLE = process.env.DYNAMODB_COMMENTS_TABLE || 'Comments';

export const commentsRepository = {
  async create({ taskId, authorId, authorName, content }) {
    const now = new Date().toISOString();
    const item = {
      commentId: uuidv4(),
      taskId,
      authorId,
      authorName,
      content,
      createdAt: now,
      updatedAt: now,
    };
    await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
    return item;
  },

  /**
   * Get all comments for a task, sorted oldest-first.
   * Uses GSI: taskId-index (partition key: taskId, sort key: createdAt)
   */
  async getByTaskId(taskId) {
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: 'taskId-index',
        KeyConditionExpression: 'taskId = :taskId',
        ExpressionAttributeValues: { ':taskId': taskId },
        ScanIndexForward: true, // oldest first
      })
    );
    return result.Items || [];
  },

  async delete(commentId) {
    await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { commentId } }));
  },

  async update(commentId, content) {
    const result = await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { commentId },
        UpdateExpression: 'SET content = :content, updatedAt = :now',
        ExpressionAttributeValues: {
          ':content': content,
          ':now': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
      })
    );
    return result.Attributes;
  },
};
