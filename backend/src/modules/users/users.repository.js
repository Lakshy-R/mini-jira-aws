import { ddb } from '../../lib/dynamodb.js';
import {
    PutCommand,
    ScanCommand,
    GetCommand,
    UpdateCommand,
    DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

const TABLE = 'Users';

export const usersRepository = {
    async create(user) {
        await ddb.send(
            new PutCommand({
                TableName: TABLE,
                Item: user,
            })
        );

        return user;
    },

    async getAll() {
        const res = await ddb.send(
            new ScanCommand({
                TableName: TABLE,
            })
        );
        return res.Items;
    },

    async getById(userId) {
        const res = await ddb.send(
            new GetCommand({
                TableName: TABLE,
                Key: { userId },
            })
        );
        return res.Item;
    },

    async update(userId, data) {
        const allowed = {
            name: data?.name,
            email: data?.email,
            role: data?.role,
            teamId: data?.teamId,
        };

        const updates = Object.entries(allowed).filter(([, value]) => value !== undefined);
        if (updates.length === 0) {
            return await this.getById(userId);
        }

        const setExpressions = [];
        const expressionAttributeNames = {};
        const expressionAttributeValues = { ':now': new Date().toISOString() };

        updates.forEach(([key, value], index) => {
            const nameKey = `#k${index}`;
            const valueKey = `:v${index}`;
            expressionAttributeNames[nameKey] = key;
            expressionAttributeValues[valueKey] = value;
            setExpressions.push(`${nameKey} = ${valueKey}`);
        });

        setExpressions.push('updatedAt = :now');

        const result = await ddb.send(
            new UpdateCommand({
                TableName: TABLE,
                Key: { userId },
                UpdateExpression: `SET ${setExpressions.join(', ')}`,
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues,
                ReturnValues: 'ALL_NEW',
            })
        );

        return result.Attributes;
    },

    async delete(userId) {
        await ddb.send(
            new DeleteCommand({
                TableName: TABLE,
                Key: { userId },
            })
        );
        return true;
    },
};
