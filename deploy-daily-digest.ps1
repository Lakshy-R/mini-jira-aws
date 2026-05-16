$roleName = "mini-jira-lambda-digest-role"
$accountId = (aws sts get-caller-identity --query 'Account' --output text)
$tasksTableArn = "arn:aws:dynamodb:eu-north-1:${accountId}:table/Tasks"
$snsTopicArn = "arn:aws:sns:eu-north-1:${accountId}:TaskAssignmentsTopic"

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
$assumeRolePolicy | Out-File -FilePath assume-role-policy-digest.json -Encoding ASCII

# Create Role
$roleArn = (aws iam create-role --role-name $roleName --assume-role-policy-document file://assume-role-policy-digest.json --query 'Role.Arn' --output text)
aws iam attach-role-policy --role-name $roleName --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Create Custom Policy
$policy = @"
{
  `"Version`": `"2012-10-17`",
  `"Statement`": [
    {
      `"Effect`": `"Allow`",
      `"Action`": [
        `"dynamodb:Scan`"
      ],
      `"Resource`": `"$tasksTableArn`"
    },
    {
      `"Effect`": `"Allow`",
      `"Action`": [
        `"sns:Publish`"
      ],
      `"Resource`": `"$snsTopicArn`"
    }
  ]
}
"@
$policy | Out-File -FilePath digest-worker-policy.json -Encoding ASCII
aws iam put-role-policy --role-name $roleName --policy-name DigestWorkerPolicy --policy-document file://digest-worker-policy.json

Write-Host "Role created: $roleArn. Zipping and waiting for IAM propagation..."
Compress-Archive -Path lambdas\daily-digest\* -DestinationPath lambdas\daily-digest.zip -Force
Start-Sleep -Seconds 10

# Create Lambda
$lambdaArn = (aws lambda create-function `
  --function-name mini-jira-daily-digest `
  --runtime nodejs20.x `
  --role $roleArn `
  --handler index.handler `
  --zip-file fileb://lambdas/daily-digest.zip `
  --environment "Variables={DYNAMODB_TASKS_TABLE=Tasks,SNS_TOPIC_ARN=$snsTopicArn}" `
  --region eu-north-1 --query 'FunctionArn' --output text)

Write-Host "Created Lambda function mini-jira-daily-digest"

# Create EventBridge Rule (9:00 AM every day)
$ruleArn = (aws events put-rule `
  --name "mini-jira-daily-digest-rule" `
  --schedule-expression "cron(0 9 * * ? *)" `
  --state ENABLED `
  --region eu-north-1 --query 'RuleArn' --output text)

# Add permission for EventBridge to trigger Lambda
aws lambda add-permission `
  --function-name mini-jira-daily-digest `
  --statement-id "AllowEventBridgeInvoke" `
  --action "lambda:InvokeFunction" `
  --principal "events.amazonaws.com" `
  --source-arn $ruleArn `
  --region eu-north-1 | Out-Null

# Add Lambda as Target to Rule
# We need an array of targets in JSON
$targetJson = @"
[
  {
    `"Id`": `"TargetDailyDigestLambda`",
    `"Arn`": `"$lambdaArn`"
  }
]
"@
$targetJson | Out-File -FilePath eventbridge-targets.json -Encoding utf8

aws events put-targets `
  --rule "mini-jira-daily-digest-rule" `
  --targets file://eventbridge-targets.json `
  --region eu-north-1 | Out-Null

Write-Host "EventBridge Rule configured successfully!"
