import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { v4 as uuidv4 } from 'uuid';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const cwClient = new CloudWatchClient({});

export const handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    try {
      // The body of the SQS message is the SNS payload
      const snsMessage = JSON.parse(record.body);
      // The actual message we sent from the backend is in snsMessage.Message
      const taskData = JSON.parse(snsMessage.Message);

      const logId = uuidv4();
      const timestamp = new Date().toISOString();

      // 1. Write to ActivityLogs DynamoDB table
      await docClient.send(new PutCommand({
        TableName: 'ActivityLogs',
        Item: {
          logId: logId,
          taskId: taskData.taskId,
          title: taskData.title,
          assigneeId: taskData.assigneeId,
          teamId: taskData.teamId,
          managerId: taskData.managerId,
          action: taskData.type, // 'TASK_ASSIGNMENT'
          timestamp: timestamp,
        }
      }));
      console.log(`Successfully logged activity for task ${taskData.taskId}`);

      // 2. Publish CloudWatch Custom Metric
      const teamId = taskData.teamId || 'UnknownTeam';
      await cwClient.send(new PutMetricDataCommand({
        Namespace: 'MiniJira/Tasks',
        MetricData: [
          {
            MetricName: 'TasksAssignedPerTeam',
            Dimensions: [
              {
                Name: 'TeamId',
                Value: teamId
              }
            ],
            Value: 1,
            Unit: 'Count',
            Timestamp: new Date()
          }
        ]
      }));
      console.log(`Successfully published metric TasksAssignedPerTeam for team ${teamId}`);
      
    } catch (err) {
      console.error('Error processing record:', err);
      // If we throw here, SQS will retry the message or move it to DLQ
      throw err; 
    }
  }

  return { statusCode: 200, body: 'Success' };
};
