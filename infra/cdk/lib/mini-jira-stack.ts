import * as cdk        from 'aws-cdk-lib';
import * as ec2        from 'aws-cdk-lib/aws-ec2';
import * as iam        from 'aws-cdk-lib/aws-iam';
import * as elbv2      from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins    from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb   from 'aws-cdk-lib/aws-dynamodb';
import * as s3         from 'aws-cdk-lib/aws-s3';
import * as s3n        from 'aws-cdk-lib/aws-s3-notifications';
import * as lambda     from 'aws-cdk-lib/aws-lambda';
import * as evtsrc     from 'aws-cdk-lib/aws-lambda-event-sources';
import * as sns        from 'aws-cdk-lib/aws-sns';
import * as snsSubs    from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs        from 'aws-cdk-lib/aws-sqs';
import * as events     from 'aws-cdk-lib/aws-events';
import * as targets    from 'aws-cdk-lib/aws-events-targets';
import * as logs       from 'aws-cdk-lib/aws-logs';
import * as ssm        from 'aws-cdk-lib/aws-ssm';
import { Construct }   from 'constructs';
import * as fs         from 'fs';
import * as path       from 'path';

/**
 * Complete Mini-Jira infrastructure stack.
 *
 * PREREQUISITE — before running `cdk deploy`, install Lambda dependencies:
 *
 *   # image-resize needs sharp compiled for Linux x64
 *   cd lambdas/image-resize
 *   npm install --platform=linux --arch=x64 --libc=glibc
 *
 *   # assignment-worker needs uuid
 *   cd lambdas/assignment-worker
 *   npm install
 *
 * If resources (buckets, topics, queues, functions) were previously created
 * manually, run `cdk import` to adopt them before deploying, or remove them
 * first and let CDK recreate them.
 *
 * Context variable (optional):
 *   cdk deploy --context suffix=yourname-2026
 * Defaults to the current suffix used in the existing deployment.
 */
export class MiniJiraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Suffix used in bucket / resource names — override with --context suffix=xxx
    const suffix = this.node.tryGetContext('suffix') ?? 'laksh-2026';

    // ─── 1. VPC ─────────────────────────────────────────────────────────────
    // Two AZs, public subnets for ALB, private subnets for EC2.
    // Two NAT Gateways — one per AZ for full HA egress.
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs:      2,
      natGateways: 2, // one per AZ — prevents single-NAT-AZ failure cutting egress
      subnetConfiguration: [
        { name: 'Public',  subnetType: ec2.SubnetType.PUBLIC,               cidrMask: 24 },
        { name: 'Private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,  cidrMask: 24 },
      ],
    });

    // ─── 2. Security Groups ─────────────────────────────────────────────────
    const albSg = new ec2.SecurityGroup(this, 'AlbSg', {
      vpc,
      description:      'ALB — allow HTTP and HTTPS from the internet',
      allowAllOutbound: true,
    });
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80),  'HTTP');
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS');

    const ec2Sg = new ec2.SecurityGroup(this, 'Ec2Sg', {
      vpc,
      description:      'EC2 — allow traffic only from the ALB',
      allowAllOutbound: true,
    });
    ec2Sg.addIngressRule(albSg, ec2.Port.tcp(3000), 'ALB → Node.js');

    // ─── 3. IAM Role for EC2 ────────────────────────────────────────────────
    const instanceRole = new iam.Role(this, 'Ec2InstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
      ],
    });

    instanceRole.addToPolicy(new iam.PolicyStatement({
      sid:       'DynamoDB',
      actions:   [
        'dynamodb:PutItem', 'dynamodb:GetItem', 'dynamodb:UpdateItem',
        'dynamodb:DeleteItem', 'dynamodb:Query', 'dynamodb:Scan',
        'dynamodb:BatchWriteItem',
      ],
      resources: [
        `arn:aws:dynamodb:${this.region}:${this.account}:table/Tasks`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/Tasks/index/*`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/Comments`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/Comments/index/*`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/Projects`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/Projects/index/*`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/ActivityLogs`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/ActivityLogs/index/*`,
      ],
    }));

    instanceRole.addToPolicy(new iam.PolicyStatement({
      sid:       'S3',
      actions:   ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:HeadObject'],
      resources: [
        `arn:aws:s3:::mini-jira-originals-${suffix}/*`,
        `arn:aws:s3:::mini-jira-resized-${suffix}/*`,
      ],
    }));

    instanceRole.addToPolicy(new iam.PolicyStatement({
      sid:       'SNS',
      actions:   ['sns:Publish'],
      resources: [`arn:aws:sns:${this.region}:${this.account}:*`],
    }));

    instanceRole.addToPolicy(new iam.PolicyStatement({
      sid:       'CloudWatch',
      actions:   ['cloudwatch:PutMetricData'],
      resources: ['*'], // AWS requires * for PutMetricData
    }));

    instanceRole.addToPolicy(new iam.PolicyStatement({
      sid:       'Cognito',
      actions:   ['cognito-idp:ListUsers'],
      resources: [`arn:aws:cognito-idp:${this.region}:${this.account}:userpool/*`],
    }));

    instanceRole.addToPolicy(new iam.PolicyStatement({
      sid:       'SSMParams',
      actions:   ['ssm:GetParametersByPath', 'ssm:GetParameter'],
      resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/mini-jira/*`],
    }));

    // ─── 4. User Data ────────────────────────────────────────────────────────
    const userdataPath   = path.join(__dirname, '../../ec2-userdata.sh');
    const userdataScript = fs.existsSync(userdataPath)
      ? fs.readFileSync(userdataPath, 'utf8')
      : '#!/bin/bash\necho "userdata script not found"';

    const userData = ec2.UserData.forLinux();
    userData.addCommands(userdataScript);

    // ─── 5. Launch Template ──────────────────────────────────────────────────
    const launchTemplate = new ec2.LaunchTemplate(this, 'LaunchTemplate', {
      instanceType:      ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage:      ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup:     ec2Sg,
      role:              instanceRole,
      userData,
      detailedMonitoring: true,
      blockDevices: [{
        deviceName: '/dev/xvda',
        volume: ec2.BlockDeviceVolume.ebs(20, {
          volumeType: ec2.EbsDeviceVolumeType.GP3,
          encrypted:  true,
        }),
      }],
    });

    // ─── 6. Auto Scaling Group ───────────────────────────────────────────────
    const asg = new autoscaling.AutoScalingGroup(this, 'Asg', {
      vpc,
      launchTemplate,
      minCapacity: 2,  // one instance per AZ for HA
      maxCapacity: 4,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    asg.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 65,
      cooldown:                 cdk.Duration.seconds(120),
    });

    // ─── 7. Application Load Balancer ────────────────────────────────────────
    const alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc,
      internetFacing: true,
      securityGroup:  albSg,
      vpcSubnets:     { subnetType: ec2.SubnetType.PUBLIC },
    });

    const listener = alb.addListener('HttpListener', { port: 80, open: true });

    listener.addTargets('Ec2Fleet', {
      port:     3000,
      targets:  [asg],
      protocol: elbv2.ApplicationProtocol.HTTP,
      healthCheck: {
        path:                    '/api/health',
        healthyHttpCodes:        '200',
        interval:                cdk.Duration.seconds(30),
        timeout:                 cdk.Duration.seconds(5),
        healthyThresholdCount:   2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    // ─── 8. CloudFront Distribution ──────────────────────────────────────────
    const distribution = new cloudfront.Distribution(this, 'Cdn', {
      comment: 'Mini-Jira CDN',
      defaultBehavior: {
        origin: new origins.LoadBalancerV2Origin(alb, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          httpPort:       80,
        }),
        cachePolicy:          cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy:  cloudfront.OriginRequestPolicy.ALL_VIEWER,
        allowedMethods:       cloudfront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.LoadBalancerV2Origin(alb, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          }),
          cachePolicy:          cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy:  cloudfront.OriginRequestPolicy.ALL_VIEWER,
          allowedMethods:       cloudfront.AllowedMethods.ALLOW_ALL,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
      },
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    });

    // ─── 9. DynamoDB Tables ──────────────────────────────────────────────────

    const tasksTable = new dynamodb.Table(this, 'TasksTable', {
      tableName:           'Tasks',
      partitionKey:        { name: 'taskId',  type: dynamodb.AttributeType.STRING },
      billingMode:         dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy:       cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    // GSI 1 — employee team-scoped query
    tasksTable.addGlobalSecondaryIndex({
      indexName:      'teamId-createdAt-index',
      partitionKey:   { name: 'teamId',    type: dynamodb.AttributeType.STRING },
      sortKey:        { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI 2 — manager all-tasks paginated query (entity = 'TASK' synthetic key)
    tasksTable.addGlobalSecondaryIndex({
      indexName:      'entity-createdAt-index',
      partitionKey:   { name: 'entity',    type: dynamodb.AttributeType.STRING },
      sortKey:        { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI 3 — assignee-scoped query (used by daily digest Lambda)
    tasksTable.addGlobalSecondaryIndex({
      indexName:      'assigneeId-createdAt-index',
      partitionKey:   { name: 'assigneeId', type: dynamodb.AttributeType.STRING },
      sortKey:        { name: 'createdAt',  type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const commentsTable = new dynamodb.Table(this, 'CommentsTable', {
      tableName:     'Comments',
      partitionKey:  { name: 'commentId', type: dynamodb.AttributeType.STRING },
      billingMode:   dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    commentsTable.addGlobalSecondaryIndex({
      indexName:      'taskId-index',
      partitionKey:   { name: 'taskId',    type: dynamodb.AttributeType.STRING },
      sortKey:        { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const activityLogsTable = new dynamodb.Table(this, 'ActivityLogsTable', {
      tableName:           'ActivityLogs',
      partitionKey:        { name: 'logId',     type: dynamodb.AttributeType.STRING },
      billingMode:         dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy:       cdk.RemovalPolicy.RETAIN,
      timeToLiveAttribute: 'expiresAt', // auto-expire logs after 90 days
    });

    activityLogsTable.addGlobalSecondaryIndex({
      indexName:      'taskId-timestamp-index',
      partitionKey:   { name: 'taskId',    type: dynamodb.AttributeType.STRING },
      sortKey:        { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const projectsTable = new dynamodb.Table(this, 'ProjectsTable', {
      tableName:     'Projects',
      partitionKey:  { name: 'projectId', type: dynamodb.AttributeType.STRING },
      billingMode:   dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    projectsTable.addGlobalSecondaryIndex({
      indexName:      'teamId-createdAt-index',
      partitionKey:   { name: 'teamId',    type: dynamodb.AttributeType.STRING },
      sortKey:        { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ─── 10. S3 Buckets ──────────────────────────────────────────────────────
    // Originals bucket: versioning enabled so every image replacement is
    // retained as a distinct S3 version — satisfies the assignment requirement
    // "ensure old and new versions are retained".
    // Resized bucket: thumbnails are derived from originals, no versioning needed.

    const originsBucket = new s3.Bucket(this, 'OriginalsBucket', {
      bucketName:        `mini-jira-originals-${suffix}`,
      versioned:         true,                      // ← actual S3 bucket versioning
      removalPolicy:     cdk.RemovalPolicy.RETAIN,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption:        s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [{
        // Non-current (replaced) image versions expire after 90 days to control cost
        noncurrentVersionExpiration: cdk.Duration.days(90),
      }],
      cors: [{
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
        maxAge:         3600,
      }],
    });

    const resizedBucket = new s3.Bucket(this, 'ResizedBucket', {
      bucketName:        `mini-jira-resized-${suffix}`,
      versioned:         false,
      removalPolicy:     cdk.RemovalPolicy.RETAIN,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption:        s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [{
        // Thumbnails older than 180 days expire automatically
        expiration: cdk.Duration.days(180),
      }],
    });

    // ─── 11. SNS Topics ──────────────────────────────────────────────────────
    // TaskAssignmentsTopic fans out to:
    //   (a) email subscription for the assignee
    //   (b) SQS queue drained by the assignment-worker Lambda
    //
    // DailyDigestTopic sends individual digest emails per assignee.
    // Both are standard topics (no FIFO needed for these workloads).

    const assignmentTopic = new sns.Topic(this, 'AssignmentTopic', {
      topicName:   'TaskAssignmentsTopic',
      displayName: 'Mini-Jira Task Assignment Notifications',
    });

    const digestTopic = new sns.Topic(this, 'DigestTopic', {
      topicName:   'DailyDigestTopic',
      displayName: 'Mini-Jira Daily Digest',
    });

    // ─── 12. SQS Queue + Dead-Letter Queue ───────────────────────────────────
    // Failed messages are retried up to 3 times before landing in the DLQ.
    // The DLQ retains messages for 14 days for investigation.

    const assignmentDlq = new sqs.Queue(this, 'AssignmentDlq', {
      queueName:             'TaskAssignmentsDLQ',
      retentionPeriod:       cdk.Duration.days(14),
      encryption:            sqs.QueueEncryption.SQS_MANAGED,
    });

    const assignmentQueue = new sqs.Queue(this, 'AssignmentQueue', {
      queueName:             'TaskAssignmentsQueue',
      visibilityTimeout:     cdk.Duration.seconds(30),
      retentionPeriod:       cdk.Duration.days(4),
      encryption:            sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue: {
        queue:           assignmentDlq,
        maxReceiveCount: 3,
      },
    });

    // Subscribe the SQS queue to the assignment topic (fan-out leg 2)
    assignmentTopic.addSubscription(
      new snsSubs.SqsSubscription(assignmentQueue, { rawMessageDelivery: false })
    );

    // ─── 13. Lambda — Image Resize ───────────────────────────────────────────
    // Triggered by S3 PUT on originals bucket (prefix: task-images/).
    // Reads the original, resizes to 400×400 JPEG thumbnail via sharp,
    // writes to the resized bucket, then updates DynamoDB with thumbnailUrl.
    //
    // PREREQUISITE: cd lambdas/image-resize && npm install --platform=linux --arch=x64

    const imageResizePath = path.join(__dirname, '../../../lambdas/image-resize');

    const imageResizeRole = new iam.Role(this, 'ImageResizeRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });
    imageResizeRole.addToPolicy(new iam.PolicyStatement({
      actions:   ['s3:GetObject', 's3:HeadObject'],
      resources: [originsBucket.arnForObjects('task-images/*')],
    }));
    imageResizeRole.addToPolicy(new iam.PolicyStatement({
      actions:   ['s3:PutObject'],
      resources: [resizedBucket.arnForObjects('task-images/*')],
    }));
    imageResizeRole.addToPolicy(new iam.PolicyStatement({
      actions:   ['dynamodb:UpdateItem', 'dynamodb:Scan'],
      resources: [tasksTable.tableArn],
    }));

    const imageResizeFn = new lambda.Function(this, 'ImageResizeFn', {
      functionName: 'mini-jira-image-resize',
      runtime:      lambda.Runtime.NODEJS_20_X,
      handler:      'index.handler',
      code:         lambda.Code.fromAsset(imageResizePath),
      role:         imageResizeRole,
      timeout:      cdk.Duration.seconds(30),
      memorySize:   512,
      environment: {
        S3_RESIZED_BUCKET:     resizedBucket.bucketName,
        DYNAMODB_TASKS_TABLE:  'Tasks',
        AWS_REGION_NAME:       this.region, // named to avoid collision with reserved AWS_REGION
        THUMBNAIL_WIDTH:       '400',
        THUMBNAIL_HEIGHT:      '400',
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Trigger: every PUT to task-images/ in the originals bucket
    originsBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED_PUT,
      new s3n.LambdaDestination(imageResizeFn),
      { prefix: 'task-images/' }
    );

    // ─── 14. Lambda — Assignment Worker ──────────────────────────────────────
    // Drains TaskAssignmentsQueue.
    // Writes an ActivityLog entry to DynamoDB.
    // Publishes TasksAssignedPerTeam custom metric to CloudWatch.
    //
    // PREREQUISITE: cd lambdas/assignment-worker && npm install

    const assignmentWorkerPath = path.join(__dirname, '../../../lambdas/assignment-worker');

    const assignmentWorkerRole = new iam.Role(this, 'AssignmentWorkerRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });
    assignmentWorkerRole.addToPolicy(new iam.PolicyStatement({
      actions:   ['dynamodb:PutItem'],
      resources: [activityLogsTable.tableArn],
    }));
    assignmentWorkerRole.addToPolicy(new iam.PolicyStatement({
      actions:   ['cloudwatch:PutMetricData'],
      resources: ['*'],
    }));
    // SQS permissions needed to receive and delete messages
    assignmentWorkerRole.addToPolicy(new iam.PolicyStatement({
      actions:   [
        'sqs:ReceiveMessage',
        'sqs:DeleteMessage',
        'sqs:GetQueueAttributes',
      ],
      resources: [assignmentQueue.queueArn],
    }));

    const assignmentWorkerFn = new lambda.Function(this, 'AssignmentWorkerFn', {
      functionName: 'mini-jira-assignment-worker',
      runtime:      lambda.Runtime.NODEJS_20_X,
      handler:      'index.handler',
      code:         lambda.Code.fromAsset(assignmentWorkerPath),
      role:         assignmentWorkerRole,
      timeout:      cdk.Duration.seconds(30),
      memorySize:   256,
      environment: {
        DYNAMODB_ACTIVITY_LOGS_TABLE: 'ActivityLogs',
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Wire SQS → Lambda (batch size 1 ensures each assignment is processed atomically)
    assignmentWorkerFn.addEventSource(
      new evtsrc.SqsEventSource(assignmentQueue, {
        batchSize:              1,
        reportBatchItemFailures: true,
      })
    );

    // ─── 15. Lambda — Daily Digest ───────────────────────────────────────────
    // Triggered by EventBridge at 09:00 UTC every day.
    // Scans Tasks for non-DONE items whose deadline ≤ today.
    // Groups by assigneeId and publishes one digest per assignee via DailyDigestTopic.
    // Also publishes OverdueTasks metric to CloudWatch.
    //
    // No extra npm install needed — only AWS SDK (built into Lambda runtime).

    const dailyDigestPath = path.join(__dirname, '../../../lambdas/daily-digest');

    const dailyDigestRole = new iam.Role(this, 'DailyDigestRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });
    dailyDigestRole.addToPolicy(new iam.PolicyStatement({
      actions:   ['dynamodb:Scan'],
      resources: [tasksTable.tableArn],
    }));
    dailyDigestRole.addToPolicy(new iam.PolicyStatement({
      actions:   ['sns:Publish'],
      resources: [digestTopic.topicArn],
    }));
    dailyDigestRole.addToPolicy(new iam.PolicyStatement({
      actions:   ['cloudwatch:PutMetricData'],
      resources: ['*'],
    }));

    const dailyDigestFn = new lambda.Function(this, 'DailyDigestFn', {
      functionName: 'mini-jira-daily-digest',
      runtime:      lambda.Runtime.NODEJS_20_X,
      handler:      'index.handler',
      code:         lambda.Code.fromAsset(dailyDigestPath),
      role:         dailyDigestRole,
      timeout:      cdk.Duration.minutes(5), // may scan a large Tasks table
      memorySize:   512,
      environment: {
        DYNAMODB_TASKS_TABLE:  'Tasks',
        SNS_DIGEST_TOPIC_ARN:  digestTopic.topicArn,
        ENV:                   'production',
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // ─── 16. EventBridge Scheduled Rule ──────────────────────────────────────
    // Fires daily at 09:00 UTC → triggers the daily-digest Lambda.
    // cron format: cron(minutes hours day-of-month month day-of-week year)

    const digestRule = new events.Rule(this, 'DailyDigestRule', {
      ruleName:    'mini-jira-daily-digest',
      description: 'Trigger daily digest Lambda at 09:00 UTC',
      schedule:    events.Schedule.cron({ minute: '0', hour: '9' }),
    });

    digestRule.addTarget(
      new targets.LambdaFunction(dailyDigestFn, {
        retryAttempts: 2,
      })
    );

    // ─── 17. SSM — write all resource references for EC2 userdata ────────────
    // EC2 instances pull their .env from SSM at boot time (see ec2-userdata.sh).
    // These parameters are written by CDK so the full deploy is self-contained.
    // Existing manually-set params (COGNITO_USER_POOL_ID etc.) are left untouched.

    new ssm.StringParameter(this, 'SsmSnsTopic', {
      parameterName: '/mini-jira/SNS_TOPIC_ARN',
      stringValue:   assignmentTopic.topicArn,
      description:   'ARN of the TaskAssignmentsTopic',
    });

    new ssm.StringParameter(this, 'SsmSnsDigestTopic', {
      parameterName: '/mini-jira/SNS_DIGEST_TOPIC_ARN',
      stringValue:   digestTopic.topicArn,
      description:   'ARN of the DailyDigestTopic',
    });

    new ssm.StringParameter(this, 'SsmOriginalsBucket', {
      parameterName: '/mini-jira/S3_ORIGINALS_BUCKET',
      stringValue:   originsBucket.bucketName,
      description:   'S3 bucket for original task image uploads',
    });

    new ssm.StringParameter(this, 'SsmResizedBucket', {
      parameterName: '/mini-jira/S3_RESIZED_BUCKET',
      stringValue:   resizedBucket.bucketName,
      description:   'S3 bucket for resized thumbnails',
    });

    new ssm.StringParameter(this, 'SsmCwNamespace', {
      parameterName: '/mini-jira/CW_NAMESPACE',
      stringValue:   'MiniJira',
      description:   'CloudWatch custom metrics namespace',
    });

    // ─── 18. Outputs ─────────────────────────────────────────────────────────

    new cdk.CfnOutput(this, 'AlbDnsName', {
      value:       alb.loadBalancerDnsName,
      description: 'ALB DNS — CloudFront origin',
    });

    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value:       `https://${distribution.distributionDomainName}`,
      description: 'Public app URL — paste this into the README',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value:       distribution.distributionId,
      description: 'CloudFront distribution ID — needed for cache invalidation',
    });

    new cdk.CfnOutput(this, 'OriginalsBucketName', {
      value:       originsBucket.bucketName,
      description: 'S3 originals bucket (versioning enabled)',
    });

    new cdk.CfnOutput(this, 'ResizedBucketName', {
      value:       resizedBucket.bucketName,
      description: 'S3 resized thumbnails bucket',
    });

    new cdk.CfnOutput(this, 'AssignmentTopicArn', {
      value:       assignmentTopic.topicArn,
      description: 'SNS topic for task-assignment fan-out',
    });

    new cdk.CfnOutput(this, 'DigestTopicArn', {
      value:       digestTopic.topicArn,
      description: 'SNS topic for daily digest emails',
    });

    new cdk.CfnOutput(this, 'AssignmentQueueUrl', {
      value:       assignmentQueue.queueUrl,
      description: 'SQS queue drained by assignment-worker Lambda',
    });

    new cdk.CfnOutput(this, 'AssignmentDlqUrl', {
      value:       assignmentDlq.queueUrl,
      description: 'Dead-letter queue for failed assignment events',
    });
  }
}
