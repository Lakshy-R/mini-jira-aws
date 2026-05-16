import { ddb } from '../../lib/dynamodb.js';

import {
    PutCommand,
    QueryCommand,
    GetCommand,
    ScanCommand,
    UpdateCommand,
    DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

import { v4 as uuid } from 'uuid';

const TABLE = 'Tasks';

export const tasksRepository = {
    async create(data) {
        const task = {
            taskId: uuid(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'TODO',
            imageVersions: data.imageUrl ? [data.imageUrl] : [],
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

    async getAll() {
        return await ddb.send(
            new ScanCommand({
                TableName: TABLE,
            })
        );
    },

    async getByTeam(teamId) {
        return await ddb.send(
            new QueryCommand({
                TableName: TABLE,
                IndexName: 'teamId-createdAt-index',
                KeyConditionExpression: 'teamId = :teamId',
                ExpressionAttributeValues: {
                    ':teamId': teamId,
                },
            })
        );
    },

    async getById(taskId) {
        const result = await ddb.send(
            new GetCommand({
                TableName: TABLE,
                Key: { taskId },
            })
        );

        return result.Item;
    },

    async updateStatus(taskId, status) {
        const result = await ddb.send(
            new UpdateCommand({
                TableName: TABLE,
                Key: { taskId },

                UpdateExpression:
                    'SET #status = :status, updatedAt = :updatedAt',

                ExpressionAttributeNames: {
                    '#status': 'status',
                },

                ExpressionAttributeValues: {
                    ':status': status,
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
            ? existing.imageVersions
            : existing.imageUrl
            ? [existing.imageUrl]
            : [];

        if (existing.imageUrl && existing.imageUrl !== newImageUrl) {
            versions.push(existing.imageUrl);
        }

        const result = await ddb.send(
            new UpdateCommand({
                TableName: TABLE,
                Key: { taskId },
                UpdateExpression:
                    'SET imageUrl = :url, imageVersions = :versions, updatedAt = :now',
                ExpressionAttributeValues: {
                    ':url': newImageUrl,
                    ':versions': versions,
                    ':now': new Date().toISOString(),
                },
                ReturnValues: 'ALL_NEW',
            })
        );
        return result.Attributes;
    },

    async delete(taskId) {
        await ddb.send(
            new DeleteCommand({
                TableName: TABLE,
                Key: { taskId },
            })
        );

        return true;
    },
};