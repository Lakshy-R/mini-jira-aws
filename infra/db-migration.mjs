#!/usr/bin/env node
/**
 * DynamoDB Migration Script
 * ─────────────────────────────────────────────────────────────────────────────
 * Adds missing GSIs to existing DynamoDB tables and backfills the
 * `entity` attribute on all existing Task items.
 *
 * Run once before deploying the updated backend:
 *   node infra/db-migration.mjs
 *
 * Prerequisites:
 *   - AWS credentials configured (aws configure or env vars)
 *   - Tables already exist (Tasks, Comments, ActivityLogs, Projects)
 *
 * DynamoDB only permits one GSI modification per UpdateTable call,
 * and each must reach ACTIVE status before the next can begin.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  DynamoDBClient,
  UpdateTableCommand,
  DescribeTableCommand,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const client = new DynamoDBClient({ region: REGION });
const ddb    = DynamoDBDocumentClient.from(client);

// ─── Helpers ─────────────────────────────────────────────────────────────────
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const describeTable = async (tableName) => {
  const res = await client.send(new DescribeTableCommand({ TableName: tableName }));
  return res.Table;
};

const existingGsiNames = (table) =>
  (table.GlobalSecondaryIndexes || []).map((g) => g.IndexName);

const waitForTableActive = async (tableName) => {
  process.stdout.write(`  Waiting for ${tableName} to be ACTIVE...`);
  let attempts = 0;
  while (attempts < 60) {
    const table = await describeTable(tableName);
    const allGsiActive = (table.GlobalSecondaryIndexes || []).every(
      (g) => g.IndexStatus === 'ACTIVE'
    );
    if (table.TableStatus === 'ACTIVE' && allGsiActive) {
      console.log(' ready.');
      return;
    }
    process.stdout.write('.');
    await wait(5000);
    attempts++;
  }
  throw new Error(`Timeout waiting for ${tableName} to reach ACTIVE state`);
};

const addGsi = async (tableName, gsiDef, attributeDefinitions) => {
  const table      = await describeTable(tableName);
  const existing   = existingGsiNames(table);

  if (existing.includes(gsiDef.IndexName)) {
    console.log(`  ✓ ${gsiDef.IndexName} already exists — skipping`);
    return;
  }

  console.log(`  Adding GSI: ${gsiDef.IndexName}`);
  await client.send(new UpdateTableCommand({
    TableName:            tableName,
    AttributeDefinitions: attributeDefinitions,
    GlobalSecondaryIndexUpdates: [{
      Create: {
        IndexName:             gsiDef.IndexName,
        KeySchema:             gsiDef.KeySchema,
        Projection:            { ProjectionType: 'ALL' },
        BillingMode:           'PAY_PER_REQUEST',
      },
    }],
  }));

  await waitForTableActive(tableName);
};

// ─── Tasks Table Migrations ───────────────────────────────────────────────────
const migrateTasksTable = async () => {
  console.log('\n[ Tasks table ]');

  // GSI 1 — entity-createdAt-index (replaces full-table Scan for managers)
  await addGsi('Tasks', {
    IndexName: 'entity-createdAt-index',
    KeySchema: [
      { AttributeName: 'entity',    KeyType: 'HASH'  },
      { AttributeName: 'createdAt', KeyType: 'RANGE' },
    ],
  }, [
    { AttributeName: 'entity',    AttributeType: 'S' },
    { AttributeName: 'createdAt', AttributeType: 'S' },
  ]);

  // GSI 2 — assigneeId-createdAt-index (required by assignment spec)
  await addGsi('Tasks', {
    IndexName: 'assigneeId-createdAt-index',
    KeySchema: [
      { AttributeName: 'assigneeId', KeyType: 'HASH'  },
      { AttributeName: 'createdAt',  KeyType: 'RANGE' },
    ],
  }, [
    { AttributeName: 'assigneeId', AttributeType: 'S' },
    { AttributeName: 'createdAt',  AttributeType: 'S' },
  ]);
};

// ─── ActivityLogs Table Migrations ───────────────────────────────────────────
const migrateActivityLogsTable = async () => {
  console.log('\n[ ActivityLogs table ]');

  // GSI — taskId-timestamp-index (query audit trail by task)
  await addGsi('ActivityLogs', {
    IndexName: 'taskId-timestamp-index',
    KeySchema: [
      { AttributeName: 'taskId',    KeyType: 'HASH'  },
      { AttributeName: 'timestamp', KeyType: 'RANGE' },
    ],
  }, [
    { AttributeName: 'taskId',    AttributeType: 'S' },
    { AttributeName: 'timestamp', AttributeType: 'S' },
  ]);
};

// ─── Projects Table Migrations ────────────────────────────────────────────────
const migrateProjectsTable = async () => {
  console.log('\n[ Projects table ]');

  // GSI — teamId-createdAt-index (was behind PROJECTS_TEAM_GSI=true flag; now always on)
  await addGsi('Projects', {
    IndexName: 'teamId-createdAt-index',
    KeySchema: [
      { AttributeName: 'teamId',    KeyType: 'HASH'  },
      { AttributeName: 'createdAt', KeyType: 'RANGE' },
    ],
  }, [
    { AttributeName: 'teamId',    AttributeType: 'S' },
    { AttributeName: 'createdAt', AttributeType: 'S' },
  ]);
};

// ─── Backfill `entity = "TASK"` on existing Task items ──────────────────────
// Required so existing tasks appear in the new entity-createdAt-index GSI.
// Items without this attribute are invisible to GSI queries.
const backfillTaskEntity = async () => {
  console.log('\n[ Backfill entity field on Tasks ]');

  let lastKey;
  let total = 0;
  let updated = 0;

  do {
    const params = {
      TableName: 'Tasks',
      FilterExpression: 'attribute_not_exists(#entity)',
      ExpressionAttributeNames: { '#entity': 'entity' },
      ProjectionExpression: 'taskId',
    };
    if (lastKey) params.ExclusiveStartKey = lastKey;

    const result = await ddb.send(new ScanCommand(params));
    const items  = result.Items || [];
    lastKey      = result.LastEvaluatedKey;
    total       += items.length;

    if (items.length === 0) continue;

    // Update in parallel — DynamoDB PAY_PER_REQUEST handles the burst
    await Promise.all(items.map((item) =>
      ddb.send(new UpdateCommand({
        TableName: 'Tasks',
        Key:       { taskId: item.taskId },
        UpdateExpression: 'SET #entity = :entity',
        ExpressionAttributeNames:  { '#entity': 'entity' },
        ExpressionAttributeValues: { ':entity': 'TASK'  },
      }))
    ));

    updated += items.length;
    console.log(`  Backfilled ${updated} tasks so far...`);
  } while (lastKey);

  console.log(`  ✓ Backfill complete — ${updated} tasks updated (${total - updated} already had entity field)`);
};

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`Mini-Jira DynamoDB Migration — region: ${REGION}`);
  console.log('='.repeat(55));

  try {
    await migrateTasksTable();
    await migrateActivityLogsTable();
    await migrateProjectsTable();
    await backfillTaskEntity();

    console.log('\n✅ All migrations complete.');
    console.log('   You can now deploy the updated backend safely.\n');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  }
})();
