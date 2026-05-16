$roleName = "mini-jira-lambda-assignment-role"
$accountId = (aws sts get-caller-identity --query 'Account' --output text)
$queueArn = "arn:aws:sqs:eu-north-1:${accountId}:TaskAssignmentsQueue"
$tableArn = "arn:aws:dynamodb:eu-north-1:${accountId}:table/ActivityLogs"

# Assume Role Policy for Lambda
$assumeRolePolicy = @"
{
  `"Version`": `"2012-10-17`",
  `"Statement`": [
    {
      `"Effect`": `"Allow`",
      `"Principal`": {
        `"Service`": `"lambda.amazonaws.com`"
      },
      `"Action`": `"sts:AssumeRole`"
    }
  ]
}
"@
$assumeRolePolicy | Out-File -FilePath assume-role-policy.json -Encoding utf8

# Create Role
$roleArn = (aws iam create-role --role-name $roleName --assume-role-policy-document file://assume-role-policy.json --query 'Role.Arn' --output text)

# Attach Basic Execution Role for CloudWatch Logs
aws iam attach-role-policy --role-name $roleName --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Create Custom Policy
$policy = @"
{
  `"Version`": `"2012-10-17`",
  `"Statement`": [
    {
      `"Effect`": `"Allow`",
      `"Action`": [
        `"sqs:ReceiveMessage`",
        `"sqs:DeleteMessage`",
        `"sqs:GetQueueAttributes`"
      ],
      `"Resource`": `"$queueArn`"
    },
    {
      `"Effect`": `"Allow`",
      `"Action`": [
        `"dynamodb:PutItem`"
      ],
      `"Resource`": `"$tableArn`"
    },
    {
      `"Effect`": `"Allow`",
      `"Action`": [
        `"cloudwatch:PutMetricData`"
      ],
      `"Resource`": `"*`"
    }
  ]
}
"@
$policy | Out-File -FilePath assignment-worker-policy.json -Encoding utf8

# Put Inline Policy
aws iam put-role-policy --role-name $roleName --policy-name AssignmentWorkerPolicy --policy-document file://assignment-worker-policy.json

Write-Host "Role created: $roleArn. Waiting 10 seconds for IAM propagation..."
Start-Sleep -Seconds 10

# Create Lambda
aws lambda create-function `
  --function-name mini-jira-assignment-worker `
  --runtime nodejs20.x `
  --role $roleArn `
  --handler index.handler `
  --zip-file fileb://lambdas/assignment-worker.zip `
  --region eu-north-1 | Out-Null

Write-Host "Created Lambda function mini-jira-assignment-worker"

# Create Event Source Mapping to trigger Lambda from SQS
aws lambda create-event-source-mapping `
  --function-name mini-jira-assignment-worker `
  --event-source-arn $queueArn `
  --batch-size 10 `
  --region eu-north-1 | Out-Null

Write-Host "Mapped SQS to trigger Lambda"
