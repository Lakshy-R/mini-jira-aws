import { ddb } from '../../lib/dynamodb.js';
import { PutCommand, QueryCommand, GetCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuid } from 'uuid';

const TABLE = 'Tasks';

export const tasksRepository = {
    async create(data) {
        const task = {
            taskId: uuid(),
            status: 'TODO',
            createdAt: new Date().toISOString(),
            ...data,
        };

        await ddb.send(
            new PutCommand({
                TableName: TABLE,
                Item: task,
            })
        );

        return task;
    },

    async getByTeam(teamId) {
        const res = await ddb.send(
            new QueryCommand({
                TableName: TABLE,
                IndexName: 'teamId-createdAt-index',
                KeyConditionExpression: 'teamId = :t',
                ExpressionAttributeValues: {
                    ':t': teamId,
                },
            })
        );
        return { Items: res.Items || [] };
    },

    async getAll() {
        const res = await ddb.send(
            new ScanCommand({
                TableName: TABLE,
            })
        );
        return { Items: res.Items || [] };
    },

    async getById(taskId) {
        const res = await ddb.send(
            new GetCommand({
                TableName: TABLE,
                Key: { taskId },
            })
        );
        return res.Item;
    },

    async updateStatus(taskId, status) {
        return await ddb.send(
            new UpdateCommand({
                TableName: TABLE,
                Key: { taskId },
                UpdateExpression: 'SET #s = :s',
                ExpressionAttributeNames: { '#s': 'status' },
                ExpressionAttributeValues: {
                    ':s': status,
                },
                ReturnValues: 'ALL_NEW',
            })
        );
    },
};