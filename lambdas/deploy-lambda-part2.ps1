$RoleName = "mini-jira-lambda-resize-role"
$Region = "eu-north-1"
$OriginalsBucket = "mini-jira-originals-laksh-2026"
$ResizedBucket = "mini-jira-resized-laksh-2026"

$AccountId = (aws sts get-caller-identity --query Account --output text).Trim()
$RoleArn = "arn:aws:iam::${AccountId}:role/${RoleName}"

Write-Host "Creating Lambda Function..."
aws lambda create-function `
  --function-name mini-jira-image-resize `
  --runtime nodejs20.x `
  --role $RoleArn `
  --handler index.handler `
  --zip-file fileb://lambda-resize.zip `
  --timeout 30 `
  --memory-size 512 `
  --region $Region `
  --environment "Variables={S3_RESIZED_BUCKET=$ResizedBucket,DYNAMODB_TASKS_TABLE=Tasks,THUMBNAIL_WIDTH=400,THUMBNAIL_HEIGHT=400}"

Write-Host "Waiting 5 seconds for Lambda creation..."
Start-Sleep -Seconds 5

Write-Host "Adding S3 Invoke Permission to Lambda..."
aws lambda add-permission `
  --function-name mini-jira-image-resize `
  --statement-id s3-originals-invoke `
  --action lambda:InvokeFunction `
  --principal s3.amazonaws.com `
  --source-arn "arn:aws:s3:::$OriginalsBucket" `
  --source-account $AccountId `
  --region $Region

Write-Host "Setting up S3 Bucket Notification..."
$NotificationJson = @{
    LambdaFunctionConfigurations = @(
        @{
            LambdaFunctionArn = "arn:aws:lambda:${Region}:${AccountId}:function:mini-jira-image-resize"
            Events = @("s3:ObjectCreated:Put")
            Filter = @{
                Key = @{
                    FilterRules = @(
                        @{ Name = "prefix"; Value = "task-images/" }
                    )
                }
            }
        }
    )
} | ConvertTo-Json -Depth 10

$NotificationFile = "notification.json"
$NotificationJson | Out-File -FilePath $NotificationFile -Encoding ASCII

aws s3api put-bucket-notification-configuration `
  --bucket $OriginalsBucket `
  --notification-configuration file://$NotificationFile `
  --region $Region

Write-Host "Lambda setup complete!"
