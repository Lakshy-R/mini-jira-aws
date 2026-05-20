import { ddb } from '../../lib/dynamodb.js';
import {
    PutCommand,
    ScanCommand,
    GetCommand,
    UpdateCommand,
    DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

const TABLE = 'Teams';

export const teamsRepository = {
    async create(team) {
        await ddb.send(
            new PutCommand({
                TableName: TABLE,
                Item: team,
            })
        );

        return team;
    },

    async getAll() {
        const res = await ddb.send(
            new ScanCommand({
                TableName: TABLE,
            })
        );
        return res.Items;
    },

    async getById(teamId) {
        const res = await ddb.send(
            new GetCommand({
                TableName: TABLE,
                Key: { teamId },
            })
        );
        return res.Item;
    },

    async update(teamId, data) {
        const allowed = {
            name: data?.name,
            description: data?.description,
        };

        const updates = Object.entries(allowed).filter(([, value]) => value !== undefined);
        if (updates.length === 0) {
            return await this.getById(teamId);
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
                Key: { teamId },
                UpdateExpression: `SET ${setExpressions.join(', ')}`,
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues,
                ReturnValues: 'ALL_NEW',
            })
        );

        return result.Attributes;
    },

    async delete(teamId) {
        await ddb.send(
            new DeleteCommand({
                TableName: TABLE,
                Key: { teamId },
            })
        );
        return true;
    },
};
