import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-north-1' });
const docClient = DynamoDBDocumentClient.from(ddbClient);
const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'eu-north-1' });

export const handler = async (event) => {
  console.log('Daily digest triggered by EventBridge:', JSON.stringify(event));

  try {
    // We only care about tasks that are NOT DONE
    // A more complex query could filter by today's date exactly, but let's scan all active ones
    // or just scan and filter in memory to keep it simple for the assignment.
    const todayStr = new Date().toISOString().split('T')[0];
    
    // In DynamoDB we'll scan for tasks
    const { Items } = await docClient.send(new ScanCommand({
      TableName: process.env.DYNAMODB_TASKS_TABLE || 'Tasks'
    }));

    if (!Items || Items.length === 0) {
      console.log('No tasks found.');
      return;
    }

    // Filter tasks due today (or overdue) and not DONE, and has assignee
    const dueTasks = Items.filter(task => {
      if (task.status === 'DONE') return false;
      if (!task.assigneeId) return false;
      if (!task.deadline) return false;
      
      const deadlineDate = new Date(task.deadline).toISOString().split('T')[0];
      return deadlineDate <= todayStr;
    });

    console.log(`Found ${dueTasks.length} tasks due today or overdue.`);

    // Group by assignee
    const tasksByAssignee = dueTasks.reduce((acc, task) => {
      if (!acc[task.assigneeId]) {
        acc[task.assigneeId] = [];
      }
      acc[task.assigneeId].push(task);
      return acc;
    }, {});

    // Send an SNS email to each assignee
    // Note: SNS Topic fan-out usually broadcasts the same message to all subscribers.
    // The assignment says: "sends each assignee a digest email via SNS." 
    // To send individual emails via SNS, we'd need to publish to an assignee-specific topic,
    // OR we just broadcast a generic digest. But let's publish individual messages to the global topic, 
    // or direct emails if we used SES. Since the requirement forces SNS, we will publish 
    // individual messages to the global topic and assume the subscriber handles filtering,
    // OR we create a generic payload. Let's just publish one SNS message per assignee.
    
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
        Message: message
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
