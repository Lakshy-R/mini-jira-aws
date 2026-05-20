# Creates DynamoDB tables and required GSIs for Mini-Jira
# Usage: ./infra/create-dynamodb-tables.ps1

$Region = "eu-north-1"

Write-Host "Creating Tasks table..."
aws dynamodb create-table `
    --table-name Tasks `
    --attribute-definitions `
    AttributeName=taskId, AttributeType=S `
    AttributeName=teamId, AttributeType=S `
    AttributeName=createdAt, AttributeType=S `
    AttributeName=assigneeId, AttributeType=S `
    --key-schema AttributeName=taskId, KeyType=HASH `
    --global-secondary-indexes `
    "[{`"IndexName`":`"teamId-createdAt-index`",`"KeySchema`": [{`"AttributeName`":`"teamId`",`"KeyType`":`"HASH`"},{`"AttributeName`":`"createdAt`",`"KeyType`":`"RANGE`"}],`"Projection`":{`"ProjectionType`":`"ALL`"}},{`"IndexName`":`"assigneeId-createdAt-index`",`"KeySchema`": [{`"AttributeName`":`"assigneeId`",`"KeyType`":`"HASH`"},{`"AttributeName`":`"createdAt`",`"KeyType`":`"RANGE`"}],`"Projection`":{`"ProjectionType`":`"ALL`"}}]" `
    --billing-mode PAY_PER_REQUEST `
    --region $Region | Out-Null

Write-Host "Creating Comments table..."
aws dynamodb create-table `
    --table-name Comments `
    --attribute-definitions `
    AttributeName=commentId, AttributeType=S `
    AttributeName=taskId, AttributeType=S `
    AttributeName=createdAt, AttributeType=S `
    --key-schema AttributeName=commentId, KeyType=HASH `
    --global-secondary-indexes `
    "[{`"IndexName`":`"taskId-index`",`"KeySchema`": [{`"AttributeName`":`"taskId`",`"KeyType`":`"HASH`"},{`"AttributeName`":`"createdAt`",`"KeyType`":`"RANGE`"}],`"Projection`":{`"ProjectionType`":`"ALL`"}}]" `
    --billing-mode PAY_PER_REQUEST `
    --region $Region | Out-Null

Write-Host "Creating Projects table..."
aws dynamodb create-table `
    --table-name Projects `
    --attribute-definitions AttributeName=projectId, AttributeType=S `
    --key-schema AttributeName=projectId, KeyType=HASH `
    --billing-mode PAY_PER_REQUEST `
    --region $Region | Out-Null

Write-Host "Creating Users table..."
aws dynamodb create-table `
    --table-name Users `
    --attribute-definitions AttributeName=userId, AttributeType=S `
    --key-schema AttributeName=userId, KeyType=HASH `
    --billing-mode PAY_PER_REQUEST `
    --region $Region | Out-Null

Write-Host "Creating Teams table..."
aws dynamodb create-table `
    --table-name Teams `
    --attribute-definitions AttributeName=teamId, AttributeType=S `
    --key-schema AttributeName=teamId, KeyType=HASH `
    --billing-mode PAY_PER_REQUEST `
    --region $Region | Out-Null

Write-Host "Creating ActivityLogs table..."
aws dynamodb create-table `
    --table-name ActivityLogs `
    --attribute-definitions AttributeName=logId, AttributeType=S `
    --key-schema AttributeName=logId, KeyType=HASH `
    --billing-mode PAY_PER_REQUEST `
    --region $Region | Out-Null

Write-Host "DynamoDB setup complete."
