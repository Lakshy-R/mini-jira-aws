import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'eu-north-1' });

export const publishTaskAssignment = async (taskData) => {
  if (!process.env.SNS_TOPIC_ARN) {
    console.warn('[SNS] No SNS_TOPIC_ARN found, skipping assignment event publish.');
    return;
  }

  const message = {
    taskId: taskData.taskId,
    title: taskData.title,
    assigneeId: taskData.assigneeId,
    teamId: taskData.teamId,
    managerId: taskData.managerId,
    type: 'TASK_ASSIGNMENT',
  };

  try {
    await snsClient.send(new PublishCommand({
      TopicArn: process.env.SNS_TOPIC_ARN,
      Message: JSON.stringify(message),
      Subject: `New Task Assigned: ${taskData.title}`,
      MessageAttributes: {
        assigneeId: {
          DataType: 'String',
          StringValue: String(taskData.assigneeId),
        },
        teamId: {
          DataType: 'String',
          StringValue: String(taskData.teamId),
        },
      },
    }));
    console.log(`[SNS] Published task assignment for taskId: ${taskData.taskId}`);
  } catch (err) {
    console.error(`[SNS] Failed to publish assignment event:`, err.message);
  }
};
