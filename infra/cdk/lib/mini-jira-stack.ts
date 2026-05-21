import * as cdk          from 'aws-cdk-lib';
import * as ec2           from 'aws-cdk-lib/aws-ec2';
import * as iam           from 'aws-cdk-lib/aws-iam';
import * as elbv2         from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as autoscaling   from 'aws-cdk-lib/aws-autoscaling';
import * as cloudfront    from 'aws-cdk-lib/aws-cloudfront';
import * as origins       from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb      from 'aws-cdk-lib/aws-dynamodb';
import * as ssm           from 'aws-cdk-lib/aws-ssm';
import { Construct }      from 'constructs';
import * as fs            from 'fs';
import * as path          from 'path';

export class MiniJiraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ─── 1. VPC ─────────────────────────────────────────────────────────────
    // Two AZs, public subnets for ALB, private subnets for EC2.
    // One NAT Gateway (cost-optimised for free tier; use 2 for full HA).
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs:      2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name:       'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask:   24,
        },
        {
          name:       'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask:   24,
        },
      ],
    });

    // ─── 2. Security Groups ─────────────────────────────────────────────────
    const albSg = new ec2.SecurityGroup(this, 'AlbSg', {
      vpc,
      description:       'ALB — allow HTTP and HTTPS from the internet',
      allowAllOutbound:  true,
    });
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80),  'HTTP');
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS');

    const ec2Sg = new ec2.SecurityGroup(this, 'Ec2Sg', {
      vpc,
      description:       'EC2 — allow traffic only from the ALB',
      allowAllOutbound:  true,
    });
    // Only ALB can reach EC2 on the Node.js port
    ec2Sg.addIngressRule(albSg, ec2.Port.tcp(3000), 'ALB to Node');
    // SSM Session Manager — no SSH key needed
    ec2Sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'SSM HTTPS');

    // ─── 3. IAM Role for EC2 ────────────────────────────────────────────────
    const instanceRole = new iam.Role(this, 'Ec2InstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
      ],
    });

    // Fine-grained permissions instead of AdministratorAccess
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
        `arn:aws:s3:::mini-jira-originals-*/*`,
        `arn:aws:s3:::mini-jira-resized-*/*`,
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
    // The bootstrap script is maintained in infra/ec2-userdata.sh.
    // It: installs Node 20, installs PM2, clones the repo, fetches SSM params,
    // writes the .env file, installs deps, and starts the backend under PM2.
    const userdataPath = path.join(__dirname, '../../ec2-userdata.sh');
    const userdataScript = fs.existsSync(userdataPath)
      ? fs.readFileSync(userdataPath, 'utf8')
      : '#!/bin/bash\necho "userdata script not found"';

    const userData = ec2.UserData.forLinux();
    userData.addCommands(userdataScript);

    // ─── 5. Launch Template ──────────────────────────────────────────────────
    const launchTemplate = new ec2.LaunchTemplate(this, 'LaunchTemplate', {
      instanceType:   ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage:   ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup:  ec2Sg,
      role:           instanceRole,
      userData,
      // Enable detailed monitoring for CloudWatch (1-min granularity)
      detailedMonitoring: true,
      blockDevices: [{
        deviceName: '/dev/xvda',
        volume: ec2.BlockDeviceVolume.ebs(20, {  // 20 GB — within free tier
          volumeType: ec2.EbsDeviceVolumeType.GP3,
          encrypted:  true,
        }),
      }],
    });

    // ─── 6. Auto Scaling Group ───────────────────────────────────────────────
    const asg = new autoscaling.AutoScalingGroup(this, 'Asg', {
      vpc,
      launchTemplate,
      minCapacity: 2,   // HA minimum — one instance per AZ
      maxCapacity: 4,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    // Target tracking: scale out when average CPU > 65%
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

    const listener = alb.addListener('HttpListener', {
      port: 80,
      open: true,
    });

    listener.addTargets('Ec2Fleet', {
      port: 3000,
      targets: [asg],
      protocol: elbv2.ApplicationProtocol.HTTP,
      healthCheck: {
        path:                   '/api/health',
        healthyHttpCodes:       '200',
        interval:               cdk.Duration.seconds(30),
        timeout:                cdk.Duration.seconds(5),
        healthyThresholdCount:  2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    // ─── 8. CloudFront Distribution ──────────────────────────────────────────
    // All requests (API + static assets) flow through CloudFront.
    // API paths are forwarded uncached; static assets are cached aggressively.
    const distribution = new cloudfront.Distribution(this, 'Cdn', {
      comment: 'Mini-Jira CDN',
      defaultBehavior: {
        // All traffic (including API) goes to ALB
        origin: new origins.LoadBalancerV2Origin(alb, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          httpPort:       80,
        }),
        // API must not be cached
        cachePolicy:         cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        allowedMethods:      cloudfront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        // S3 presigned URLs must be proxied with all query strings
        '/api/*': {
          origin:              new origins.LoadBalancerV2Origin(alb, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          }),
          cachePolicy:         cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
          allowedMethods:      cloudfront.AllowedMethods.ALLOW_ALL,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
      },
      // Minimum TLS 1.2
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    });

    // ─── 9. DynamoDB Tables ──────────────────────────────────────────────────
    // Defined in CDK so the GSIs are source-controlled and reproducible.
    // If tables already exist, import them instead of creating new ones.

    const tasksTable = new dynamodb.Table(this, 'TasksTable', {
      tableName:    'Tasks',
      partitionKey: { name: 'taskId',  type: dynamodb.AttributeType.STRING },
      billingMode:  dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // never auto-delete data
      pointInTimeRecovery: true,
    });

    // GSI 1 — employee team-scoped query (existing)
    tasksTable.addGlobalSecondaryIndex({
      indexName:        'teamId-createdAt-index',
      partitionKey:     { name: 'teamId',    type: dynamodb.AttributeType.STRING },
      sortKey:          { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType:   dynamodb.ProjectionType.ALL,
    });

    // GSI 2 — manager all-tasks paginated query (replaces full-table Scan)
    tasksTable.addGlobalSecondaryIndex({
      indexName:        'entity-createdAt-index',
      partitionKey:     { name: 'entity',    type: dynamodb.AttributeType.STRING },
      sortKey:          { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType:   dynamodb.ProjectionType.ALL,
    });

    // GSI 3 — assignee-scoped query (required by assignment, used by daily digest)
    tasksTable.addGlobalSecondaryIndex({
      indexName:        'assigneeId-createdAt-index',
      partitionKey:     { name: 'assigneeId', type: dynamodb.AttributeType.STRING },
      sortKey:          { name: 'createdAt',  type: dynamodb.AttributeType.STRING },
      projectionType:   dynamodb.ProjectionType.ALL,
    });

    const commentsTable = new dynamodb.Table(this, 'CommentsTable', {
      tableName:    'Comments',
      partitionKey: { name: 'commentId', type: dynamodb.AttributeType.STRING },
      billingMode:  dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    commentsTable.addGlobalSecondaryIndex({
      indexName:      'taskId-index',
      partitionKey:   { name: 'taskId',    type: dynamodb.AttributeType.STRING },
      sortKey:        { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const activityLogsTable = new dynamodb.Table(this, 'ActivityLogsTable', {
      tableName:    'ActivityLogs',
      partitionKey: { name: 'logId',     type: dynamodb.AttributeType.STRING },
      billingMode:  dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      // Auto-expire logs after 90 days to control storage costs
      timeToLiveAttribute: 'expiresAt',
    });

    // GSI — query activity history for a specific task
    activityLogsTable.addGlobalSecondaryIndex({
      indexName:      'taskId-timestamp-index',
      partitionKey:   { name: 'taskId',    type: dynamodb.AttributeType.STRING },
      sortKey:        { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const projectsTable = new dynamodb.Table(this, 'ProjectsTable', {
      tableName:    'Projects',
      partitionKey: { name: 'projectId', type: dynamodb.AttributeType.STRING },
      billingMode:  dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    projectsTable.addGlobalSecondaryIndex({
      indexName:      'teamId-createdAt-index',
      partitionKey:   { name: 'teamId',    type: dynamodb.AttributeType.STRING },
      sortKey:        { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ─── 10. Outputs ─────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'AlbDnsName', {
      value:       alb.loadBalancerDnsName,
      description: 'ALB DNS — use as CloudFront origin or direct API URL',
    });

    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value:       `https://${distribution.distributionDomainName}`,
      description: 'CloudFront distribution URL — this is the public app URL',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value:       distribution.distributionId,
      description: 'CloudFront distribution ID — needed for cache invalidation',
    });
  }
}
