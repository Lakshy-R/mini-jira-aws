#!/usr/bin/env node
/**
 * Run once to provision:
 *   - CloudWatch dashboard with 4 widgets
 *   - Overdue tasks alarm → SNS notification
 *
 * Usage:
 *   REGION=us-east-1 ACCOUNT_ID=123456789 SNS_ALARM_TOPIC_ARN=arn:... node setup-cloudwatch.js
 */

const { CloudWatchClient, PutDashboardCommand, PutMetricAlarmCommand } = require("@aws-sdk/client-cloudwatch");

const REGION = process.env.REGION || "us-east-1";
const NAMESPACE = "MiniJira";
const SNS_ALARM_TOPIC_ARN = process.env.SNS_ALARM_TOPIC_ARN; // existing or new SNS topic for alarms

const cw = new CloudWatchClient({ region: REGION });

const dashboard = {
  widgets: [
    // Widget 1 — Tasks created per day
    {
      type: "metric",
      x: 0, y: 0, width: 12, height: 6,
      properties: {
        title: "Tasks created per day",
        view: "timeSeries",
        stat: "Sum",
        period: 86400, // 1 day
        metrics: [
          [NAMESPACE, "TasksCreated", "TeamId", "frontend"],
          [NAMESPACE, "TasksCreated", "TeamId", "backend"],
          [NAMESPACE, "TasksCreated", "TeamId", "qa"],
          [NAMESPACE, "TasksCreated", "TeamId", "devops"],
        ],
        yAxis: { left: { min: 0 } },
        region: REGION,
      },
    },

    // Widget 2 — Tasks closed per day per team
    {
      type: "metric",
      x: 12, y: 0, width: 12, height: 6,
      properties: {
        title: "Tasks closed per day (per team)",
        view: "timeSeries",
        stat: "Sum",
        period: 86400,
        metrics: [
          [NAMESPACE, "TasksClosed", "TeamId", "frontend"],
          [NAMESPACE, "TasksClosed", "TeamId", "backend"],
          [NAMESPACE, "TasksClosed", "TeamId", "qa"],
          [NAMESPACE, "TasksClosed", "TeamId", "devops"],
        ],
        yAxis: { left: { min: 0 } },
        region: REGION,
      },
    },

    // Widget 3 — Average time to close (ms → readable as hours in the console)
    {
      type: "metric",
      x: 0, y: 6, width: 12, height: 6,
      properties: {
        title: "Avg time to close (ms)",
        view: "timeSeries",
        stat: "Average",
        period: 86400,
        metrics: [
          [NAMESPACE, "TimeToCloseMs", "TeamId", "frontend"],
          [NAMESPACE, "TimeToCloseMs", "TeamId", "backend"],
          [NAMESPACE, "TimeToCloseMs", "TeamId", "qa"],
          [NAMESPACE, "TimeToCloseMs", "TeamId", "devops"],
        ],
        yAxis: { left: { min: 0 } },
        region: REGION,
      },
    },

    // Widget 4 — EC2 CPU utilization across the Auto Scaling Group
    {
      type: "metric",
      x: 12, y: 6, width: 12, height: 6,
      properties: {
        title: "EC2 CPU utilization (ASG)",
        view: "timeSeries",
        stat: "Average",
        period: 300, // 5 min
        metrics: [
          ["AWS/EC2", "CPUUtilization", "AutoScalingGroupName", "mini-jira-asg"],
        ],
        annotations: {
          horizontal: [{ label: "High CPU threshold", value: 70, color: "#ff6961" }],
        },
        yAxis: { left: { min: 0, max: 100 } },
        region: REGION,
      },
    },
  ],
};

const createDashboard = async () => {
  await cw.send(
    new PutDashboardCommand({
      DashboardName: "MiniJira",
      DashboardBody: JSON.stringify(dashboard),
    })
  );
  console.log("✅ Dashboard 'MiniJira' created/updated");
};

const createAlarms = async () => {
  // Alarm 1 — Overdue tasks above threshold
  await cw.send(
    new PutMetricAlarmCommand({
      AlarmName: "MiniJira-OverdueTasks-High",
      AlarmDescription: "Fires when overdue tasks exceed 10 — check task deadlines",
      Namespace: NAMESPACE,
      MetricName: "OverdueTasks",
      Dimensions: [{ Name: "Environment", Value: "production" }],
      Statistic: "Maximum",
      Period: 86400,       // evaluate once per day
      EvaluationPeriods: 1,
      Threshold: 10,
      ComparisonOperator: "GreaterThanThreshold",
      TreatMissingData: "notBreaching",
      AlarmActions: [SNS_ALARM_TOPIC_ARN],
      OKActions: [SNS_ALARM_TOPIC_ARN],
    })
  );
  console.log("✅ Alarm 'MiniJira-OverdueTasks-High' created");

  // Alarm 2 — High EC2 CPU
  await cw.send(
    new PutMetricAlarmCommand({
      AlarmName: "MiniJira-EC2-HighCPU",
      AlarmDescription: "EC2 average CPU > 70% for 10 minutes — consider scaling",
      Namespace: "AWS/EC2",
      MetricName: "CPUUtilization",
      Dimensions: [{ Name: "AutoScalingGroupName", Value: "mini-jira-asg" }],
      Statistic: "Average",
      Period: 300,
      EvaluationPeriods: 2,
      Threshold: 70,
      ComparisonOperator: "GreaterThanThreshold",
      TreatMissingData: "missing",
      AlarmActions: [SNS_ALARM_TOPIC_ARN],
    })
  );
  console.log("✅ Alarm 'MiniJira-EC2-HighCPU' created");
};

(async () => {
  if (!SNS_ALARM_TOPIC_ARN) {
    console.error("❌ Set SNS_ALARM_TOPIC_ARN env var before running");
    process.exit(1);
  }
  await createDashboard();
  await createAlarms();
  console.log("\n🎉 CloudWatch setup complete. Open the console:");
  console.log(`   https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#dashboards:name=MiniJira`);
})();
