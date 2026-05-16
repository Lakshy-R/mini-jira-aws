import { ddb } from '../../lib/dynamodb.js';

import {
    PutCommand,
    ScanCommand,
    GetCommand,
} from '@aws-sdk/lib-dynamodb';

const TABLE = 'Projects';

export const projectsRepository = {
    async create(project) {
        await ddb.send(
            new PutCommand({
                TableName: TABLE,
                Item: project,
            })
        );

        return project;
    },

    async getAll() {
        const res = await ddb.send(
            new ScanCommand({
                TableName: TABLE,
            })
        );

        return res.Items;
    },

    async getById(projectId) {
        const res = await ddb.send(
            new GetCommand({
                TableName: TABLE,
                Key: { projectId },
            })
        );

        return res.Item;
    },
};