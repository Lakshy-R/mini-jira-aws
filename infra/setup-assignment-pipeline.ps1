$topicArn = (aws sns create-topic --name TaskAssignmentsTopic --region eu-north-1 --query 'TopicArn' --output text)
Write-Host "Created SNS Topic: $topicArn"

$queueUrl = (aws sqs create-queue --queue-name TaskAssignmentsQueue --region eu-north-1 --query 'QueueUrl' --output text)
$queueArn = (aws sqs get-queue-attributes --queue-url $queueUrl --attribute-names QueueArn --region eu-north-1 --query 'Attributes.QueueArn' --output text)
Write-Host "Created SQS Queue: $queueArn"

# Policy to allow SNS to write to SQS
$policy = @"
{
  `"Version`": `"2012-10-17`",
  `"Id`": `"sqspolicy`",
  `"Statement`": [
    {
      `"Sid`": `"First`",
      `"Effect`": `"Allow`",
      `"Principal`": `"*`",
      `"Action`": `"sqs:SendMessage`",
      `"Resource`": `"$queueArn`",
      `"Condition`": {
        `"ArnEquals`": {
          `"aws:SourceArn`": `"$topicArn`"
        }
      }
    }
  ]
}
"@

$policy | Out-File -FilePath sqs-policy.json -Encoding utf8
aws sqs set-queue-attributes --queue-url $queueUrl --attributes file://sqs-policy.json --region eu-north-1

aws sns subscribe --topic-arn $topicArn --protocol sqs --notification-endpoint $queueArn --region eu-north-1
Write-Host "Subscribed SQS to SNS"

# Create ActivityLogs Table
aws dynamodb create-table --table-name ActivityLogs `
  --attribute-definitions AttributeName=logId,AttributeType=S `
  --key-schema AttributeName=logId,KeyType=HASH `
  --billing-mode PAY_PER_REQUEST `
  --region eu-north-1 | Out-Null
Write-Host "Created ActivityLogs DynamoDB table"

Write-Host "`nSetup complete! Add this to your backend/.env:"
Write-Host "SNS_TOPIC_ARN=$topicArn"
