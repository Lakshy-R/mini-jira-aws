import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const region    = process.env.AWS_REGION || 'eu-north-1';
const ddbClient = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(ddbClient);
const snsClient = new SNSClient({ region });
const cwClient  = new CloudWatchClient({ region });

/**
 * Daily digest Lambda — triggered by EventBridge at 9:00 AM.
 *
 * Scans Tasks for non-DONE items whose deadline ≤ today.
 * Groups by assigneeId and sends one summary SNS message per assignee.
 * Publishes OverdueTasks metric to CloudWatch.
 *
 * NOTE: A full Scan is acceptable here because:
 *   a) This Lambda runs once per day, not per request.
 *   b) It needs all teams' tasks (no teamId filter applies).
 *   c) A production alternative would be a DynamoDB Stream that maintains
 *      a "tasks due today" materialized view in a separate table.
 */
export const handler = async (event) => {
  console.log('Daily digest triggered:', JSON.stringify(event));

  const topicArn = process.env.SNS_DIGEST_TOPIC_ARN;
  if (!topicArn) {
    console.error('SNS_DIGEST_TOPIC_ARN not configured — aborting digest.');
    return { statusCode: 400, body: 'SNS_DIGEST_TOPIC_ARN not set' };
  }

  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // Paginated scan — collects all tasks regardless of table size
    const allTasks = [];
    let lastKey;
    do {
      const params = {
        TableName: process.env.DYNAMODB_TASKS_TABLE || 'Tasks',
        // Only retrieve the fields we need (reduces read capacity)
        ProjectionExpression: 'taskId, #st, assigneeId, deadline, title',
        ExpressionAttributeNames: { '#st': 'status' },
      };
      if (lastKey) params.ExclusiveStartKey = lastKey;

      const { Items, LastEvaluatedKey } = await docClient.send(new ScanCommand(params));
      allTasks.push(...(Items || []));
      lastKey = LastEvaluatedKey;
    } while (lastKey);

    console.log(`Scanned ${allTasks.length} tasks total`);

    // Filter: non-DONE tasks with a valid deadline on or before today
    const dueTasks = allTasks.filter((task) => {
      if (task.status === 'DONE' || !task.assigneeId || !task.deadline) return false;
      const d = new Date(task.deadline);
      if (isNaN(d.getTime())) return false;   // guard against invalid dates
      return d.toISOString().split('T')[0] <= todayStr;
    });

    console.log(`${dueTasks.length} overdue/due tasks found`);

    // Publish OverdueTasks count to CloudWatch
    if (dueTasks.length > 0) {
      await cwClient.send(new PutMetricDataCommand({
        Namespace:  'MiniJira/Tasks',
        MetricData: [{
          MetricName: 'OverdueTasks',
          Dimensions: [{ Name: 'Environment', Value: process.env.ENV || 'production' }],
          Value:      dueTasks.length,
          Unit:       'Count',
          Timestamp:  new Date(),
        }],
      })).catch((e) => console.error('CW PutMetricData failed:', e.message));
    }

    if (dueTasks.length === 0) {
      console.log('No due tasks — no emails sent.');
      return { statusCode: 200, body: 'No due tasks' };
    }

    // Group by assigneeId
    const byAssignee = dueTasks.reduce((acc, task) => {
      if (!acc[task.assigneeId]) acc[task.assigneeId] = [];
      acc[task.assigneeId].push(task);
      return acc;
    }, {});

    // Send one digest per assignee
    const sends = Object.entries(byAssignee).map(async ([assigneeId, tasks]) => {
      const taskLines = tasks
        .map((t) => {
          const due = new Date(t.deadline).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
          });
          return `  • ${t.title} — Status: ${t.status}, Due: ${due}`;
        })
        .join('\n');

      const message =
        `Hello,\n\n` +
        `You have ${tasks.length} task(s) that are due today or overdue:\n\n` +
        `${taskLines}\n\n` +
        `Please update their status on Mini-Jira.\n\n` +
        `Best,\nMini-Jira System`;

      await snsClient.send(new PublishCommand({
        TopicArn:  topicArn,
        Subject:   `[Mini-Jira] Daily Digest — ${tasks.length} task(s) need attention`,
        Message:   message,
        MessageAttributes: {
          assigneeId: { DataType: 'String', StringValue: assigneeId },
        },
      }));

      console.log(`Digest sent to assignee ${assigneeId} (${tasks.length} tasks)`);
    });

    const results = await Promise.allSettled(sends);
    const failed  = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      failed.forEach((r) => console.error('Digest send failed:', r.reason));
    }

    console.log('Daily digest complete.');
    return {
      statusCode: 200,
      body: `Processed ${dueTasks.length} overdue tasks, ${failed.length} send failures`,
    };
  } catch (err) {
    console.error('Daily digest failed:', err);
    throw err; // triggers Lambda retry / DLQ
  }
};
