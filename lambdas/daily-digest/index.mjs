import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-north-1' });
const docClient = DynamoDBDocumentClient.from(ddbClient);
const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'eu-north-1' });
const cwClient = new CloudWatchClient({ region: process.env.AWS_REGION || 'eu-north-1' });

/**
 * Daily digest Lambda.
 * Triggered by EventBridge at 9:00 AM every day.
 *
 * IMPORTANT: Uses SNS_DIGEST_TOPIC_ARN — a SEPARATE topic from TaskAssignmentsTopic.
 * This prevents digest messages from entering the assignment-worker SQS pipeline.
 * Create a new SNS topic (DailyDigestTopic) and subscribe assignee emails directly to it.
 */
export const handler = async (event) => {
  console.log('Daily digest triggered:', JSON.stringify(event));

  // Prefer dedicated digest topic; warn if falling back to the assignment topic
  const topicArn = process.env.SNS_DIGEST_TOPIC_ARN;
  if (!topicArn) {
    console.error('SNS_DIGEST_TOPIC_ARN is not set. Aborting digest to prevent polluting the assignment pipeline.');
    return { statusCode: 400, body: 'SNS_DIGEST_TOPIC_ARN not configured' };
  }

  try {
    const todayStr = new Date().toISOString().split('T')[0];

    const { Items } = await docClient.send(
      new ScanCommand({ TableName: process.env.DYNAMODB_TASKS_TABLE || 'Tasks' })
    );

    if (!Items || Items.length === 0) {
      console.log('No tasks found.');
      return { statusCode: 200, body: 'No tasks' };
    }

    const dueTasks = Items.filter((task) => {
      if (task.status === 'DONE') return false;
      if (!task.assigneeId || !task.deadline) return false;
      const deadlineDate = new Date(task.deadline).toISOString().split('T')[0];
      return deadlineDate <= todayStr;
    });

    console.log(`Found ${dueTasks.length} tasks due today or overdue.`);

    // Publish OverdueTasks metric
    if (dueTasks.length > 0) {
      await cwClient.send(
        new PutMetricDataCommand({
          Namespace: 'MiniJira/Tasks',
          MetricData: [
            {
              MetricName: 'OverdueTasks',
              Dimensions: [{ Name: 'Environment', Value: process.env.ENV || 'production' }],
              Value: dueTasks.length,
              Unit: 'Count',
              Timestamp: new Date(),
            },
          ],
        })
      ).catch((err) => console.error('Failed to publish OverdueTasks metric:', err));
    }

    // Group tasks by assignee
    const byAssignee = dueTasks.reduce((acc, task) => {
      if (!acc[task.assigneeId]) acc[task.assigneeId] = [];
      acc[task.assigneeId].push(task);
      return acc;
    }, {});

    // Send one digest email per assignee
    const sends = Object.entries(byAssignee).map(async ([assigneeId, tasks]) => {
      const taskLines = tasks
        .map((t) => `  • ${t.title} — Status: ${t.status}, Due: ${new Date(t.deadline).toLocaleDateString()}`)
        .join('\n');

      const message =
        `Hello,\n\n` +
        `You have ${tasks.length} task(s) that are due today or overdue:\n\n` +
        `${taskLines}\n\n` +
        `Please update their status on Mini-Jira.\n\n` +
        `Best,\nMini-Jira System`;

      await snsClient.send(
        new PublishCommand({
          TopicArn: topicArn,
          Subject: `[Mini-Jira] Daily Digest — ${tasks.length} task(s) need attention`,
          Message: message,
          MessageAttributes: {
            assigneeId: { DataType: 'String', StringValue: assigneeId },
          },
        })
      );
      console.log(`Sent digest for assignee: ${assigneeId} (${tasks.length} tasks)`);
    });

    await Promise.allSettled(sends);

    console.log('Daily digest complete.');
    return { statusCode: 200, body: `Processed ${dueTasks.length} overdue tasks` };
  } catch (err) {
    console.error('Daily digest failed:', err);
    throw err;
  }
};
