import { CloudWatchClient, PutMetricDataCommand } from "@aws-sdk/client-cloudwatch";

const cw = new CloudWatchClient({ region: process.env.AWS_REGION || "eu-north-1" });
const NAMESPACE = process.env.CW_NAMESPACE || "MiniJira";

const putMetrics = async (metricData) => {
  try {
    await cw.send(new PutMetricDataCommand({ Namespace: NAMESPACE, MetricData: metricData }));
  } catch(e) {
    console.error("[CW] Error:", e);
  }
};

export const recordTaskCreated = async (teamId) => {
  await putMetrics([{
    MetricName: "TasksCreated",
    Dimensions: [{ Name: "TeamId", Value: teamId || 'UnknownTeam' }],
    Value: 1,
    Unit: "Count",
    Timestamp: new Date(),
  }]);
};

export const recordTaskClosed = async (teamId, timeToCloseMs) => {
  await putMetrics([
    {
      MetricName: "TasksClosed",
      Dimensions: [{ Name: "TeamId", Value: teamId || 'UnknownTeam' }],
      Value: 1,
      Unit: "Count",
      Timestamp: new Date(),
    },
    {
      MetricName: "TimeToCloseMs",
      Dimensions: [{ Name: "TeamId", Value: teamId || 'UnknownTeam' }],
      Value: timeToCloseMs,
      Unit: "Milliseconds",
      Timestamp: new Date(),
    },
  ]);
};

export const recordTaskAssigned = async (teamId) => {
  await putMetrics([{
    MetricName: "TasksAssigned",
    Dimensions: [{ Name: "TeamId", Value: teamId || 'UnknownTeam' }],
    Value: 1,
    Unit: "Count",
    Timestamp: new Date(),
  }]);
};

export const recordOverdueTasks = async (count) => {
  await putMetrics([{
    MetricName: "OverdueTasks",
    Dimensions: [{ Name: "Environment", Value: process.env.ENV || "production" }],
    Value: count,
    Unit: "Count",
    Timestamp: new Date(),
  }]);
};
