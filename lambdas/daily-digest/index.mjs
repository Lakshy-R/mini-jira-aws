import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-north-1' });
const docClient = DynamoDBDocumentClient.from(ddbClient);
const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'eu-north-1' });
const cwClient = new CloudWatchClient({ region: process.env.AWS_REGION || 'eu-north-1' });
const CW_NAMESPACE = process.env.CW_NAMESPACE || 'MiniJira';

export const handler = async (event) => {
  console.log('Daily digest triggered by EventBridge:', JSON.stringify(event));

  try {
    const todayStr = new Date().toISOString().split('T')[0];

    const { Items } = await docClient.send(new ScanCommand({
      TableName: process.env.DYNAMODB_TASKS_TABLE || 'Tasks'
    }));

    if (!Items || Items.length === 0) {
      console.log('No tasks found.');
      return;
    }

    const dueTasks = Items.filter(task => {
      if (task.status === 'DONE') return false;
      if (!task.assigneeId) return false;
      if (!task.deadline) return false;

      const deadlineDate = new Date(task.deadline).toISOString().split('T')[0];
      return deadlineDate <= todayStr;
    });

    console.log(`Found ${dueTasks.length} tasks due today or overdue.`);

    // Publish OverdueTasks metric to CloudWatch
    if (dueTasks.length > 0) {
      try {
        await cwClient.send(new PutMetricDataCommand({
          Namespace: CW_NAMESPACE,
          MetricData: [{
            MetricName: 'OverdueTasks',
            Dimensions: [{ Name: 'Environment', Value: process.env.ENV || 'production' }],
            Value: dueTasks.length,
            Unit: 'Count',
            Timestamp: new Date(),
          }]
        }));
        console.log(`Successfully published OverdueTasks metric: ${dueTasks.length}`);
      } catch (cwErr) {
        console.error('Failed to publish OverdueTasks metric:', cwErr);
      }
    }

    const tasksByAssignee = dueTasks.reduce((acc, task) => {
      if (!acc[task.assigneeId]) {
        acc[task.assigneeId] = [];
      }
      acc[task.assigneeId].push(task);
      return acc;
    }, {});

    const topicArn = process.env.SNS_TOPIC_ARN;
    if (!topicArn) {
      console.warn('SNS_TOPIC_ARN not set. Skipping sending digests.');
      return;
    }

    for (const [assigneeId, tasks] of Object.entries(tasksByAssignee)) {
      const taskListStr = tasks.map(t => `- ${t.title} (Status: ${t.status}, Deadline: ${new Date(t.deadline).toLocaleDateString()})`).join('\n');

      const message = `Hello Assignee ${assigneeId},\n\nYou have ${tasks.length} task(s) due today or overdue:\n\n${taskListStr}\n\nPlease update their status on the Mini-Jira dashboard.\n\nBest,\nMini-Jira System`;

      await snsClient.send(new PublishCommand({
        TopicArn: topicArn,
        Subject: `Mini-Jira Daily Digest - ${tasks.length} tasks due`,
        Message: message,
        MessageAttributes: {
          assigneeId: {
            DataType: 'String',
            StringValue: String(assigneeId),
          }
        }
      }));
      console.log(`Sent digest to assignee: ${assigneeId}`);
    }

    console.log('Daily digest processing complete.');
    return { statusCode: 200, body: 'Success' };

  } catch (err) {
    console.error('Error executing daily digest:', err);
    throw err;
  }
};
