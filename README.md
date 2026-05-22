# Mini-Jira on AWS

A lightweight team task-management web app (like a stripped-down Jira/Trello) fully running on AWS. Supports multiple teams, manager-to-employee task assignment, event-driven notifications, a Lambda image pipeline, and CloudWatch monitoring.

---
## Demo Video
https://drive.google.com/drive/folders/1TfHhhN4RzUf6NBqF6wgGfrxZgt81R7a3?usp=sharing

## CloudFront Link  
https://d3cg7qzt5pb0l4.cloudfront.net/

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [AWS CLI Setup](#aws-cli-setup)
4. [Step 1 — Create S3 Buckets](#step-1--create-s3-buckets)
5. [Step 2 — Create DynamoDB Tables](#step-2--create-dynamodb-tables)
6. [Step 3 — Set Up Cognito User Pool](#step-3--set-up-cognito-user-pool)
7. [Step 4 — Deploy the Image-Resize Lambda](#step-4--deploy-the-image-resize-lambda)
8. [Step 5 — Set Up SNS + SQS Pipeline](#step-5--set-up-sns--sqs-pipeline)
9. [Step 6 — Deploy the Assignment Worker Lambda](#step-6--deploy-the-assignment-worker-lambda)
10. [Step 7 — Deploy the Daily Digest Lambda](#step-7--deploy-the-daily-digest-lambda)
11. [Step 8 — Set Up CloudWatch Dashboard & Alarms](#step-8--set-up-cloudwatch-dashboard--alarms)
12. [Step 9 — Configure & Run the Backend](#step-9--configure--run-the-backend)
13. [Step 10 — Configure & Run the Frontend](#step-10--configure--run-the-frontend)
14. [Project Structure](#project-structure)
15. [Environment Variables Reference](#environment-variables-reference)

---

## Architecture Overview

```
Frontend (React/Vite)
    ↓ REST API
Backend (Express.js on Node)
    ↓                       ↓                    ↓
DynamoDB (Tasks,         S3 (Originals)       Cognito
 Comments, ActivityLogs)     ↓                (Auth)
                         Lambda (Image-Resize)
                             ↓
                         S3 (Resized)

SNS (TaskAssignmentsTopic)
    ↓
SQS (TaskAssignmentsQueue)
    ↓
Lambda (Assignment-Worker) → DynamoDB (ActivityLogs) + CloudWatch Metrics

EventBridge (9 AM Daily)
    ↓
Lambda (Daily-Digest) → SNS (Digest Emails) + CloudWatch (OverdueTasks)

CloudWatch Dashboard → 4 Widgets + 2 Alarms
```

---

## Prerequisites

| Tool           | Version  | Purpose                        |
| -------------- | -------- | ------------------------------ |
| **Node.js**    | ≥ 18.x   | Backend & Frontend runtime     |
| **npm**        | ≥ 9.x    | Package manager                |
| **AWS CLI v2** | ≥ 2.x    | Deploy AWS resources from CLI  |
| **Git**        | any      | Version control                |

### Install AWS CLI

- **Windows**: Download from https://aws.amazon.com/cli/
- **Mac**: `brew install awscli`
- **Linux**: `curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && unzip awscliv2.zip && sudo ./aws/install`

Verify installation:
```bash
aws --version
```

---

## AWS CLI Setup

You need an IAM user with programmatic access. This user should have the following permissions (or use `AdministratorAccess` for development):

- `AmazonS3FullAccess`
- `AmazonDynamoDBFullAccess`
- `AmazonCognitoPowerUser`
- `AWSLambda_FullAccess`
- `AmazonSNSFullAccess`
- `AmazonSQSFullAccess`
- `AmazonEventBridgeFullAccess`
- `CloudWatchFullAccess`
- `IAMFullAccess` (needed to create Lambda execution roles)

### Option A: Using `aws configure` (Recommended)

If you have the AWS CLI installed, run:

```bash
aws configure
```

You will be prompted for:
```
AWS Access Key ID:     <YOUR_ACCESS_KEY_ID>
AWS Secret Access Key: <YOUR_SECRET_ACCESS_KEY>
Default region name:   eu-north-1
Default output format: json
```

This stores credentials in `~/.aws/credentials` and the SDK picks them up automatically. You do **not** need to put these in any `.env` file.

### Option B: Using Environment Variables (No AWS CLI installed)

If you can't install the AWS CLI, set these environment variables before running the backend:

**Windows (PowerShell):**
```powershell
$env:AWS_ACCESS_KEY_ID = "YOUR_ACCESS_KEY_ID"
$env:AWS_SECRET_ACCESS_KEY = "YOUR_SECRET_ACCESS_KEY"
$env:AWS_REGION = "eu-north-1"
```

**Mac/Linux:**
```bash
export AWS_ACCESS_KEY_ID="YOUR_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="YOUR_SECRET_ACCESS_KEY"
export AWS_REGION="eu-north-1"
```

> ⚠️ **Never commit your AWS keys to Git.** The `.env` file is already in `.gitignore`.

---

## Step 1 — Create S3 Buckets

Create two private S3 buckets. Replace `<YOUR-NAME>` with a unique identifier:

```bash
aws s3 mb s3://mini-jira-originals-<YOUR-NAME> --region eu-north-1
aws s3 mb s3://mini-jira-resized-<YOUR-NAME> --region eu-north-1
```

These buckets store uploaded task images (originals) and Lambda-processed thumbnails (resized).

---

## Step 2 — Create DynamoDB Tables

Create three tables with on-demand billing:

```bash
# Tasks table
aws dynamodb create-table \
  --table-name Tasks \
  --attribute-definitions AttributeName=taskId,AttributeType=S \
  --key-schema AttributeName=taskId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-north-1

# Comments table
aws dynamodb create-table \
  --table-name Comments \
  --attribute-definitions AttributeName=commentId,AttributeType=S \
  --key-schema AttributeName=commentId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-north-1

# ActivityLogs table (for the assignment worker)
aws dynamodb create-table \
  --table-name ActivityLogs \
  --attribute-definitions AttributeName=logId,AttributeType=S \
  --key-schema AttributeName=logId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-north-1
```

---

## Step 3 — Set Up Cognito User Pool

1. Go to the **AWS Cognito Console** → **Create User Pool**
2. Configure sign-in with **Email**
3. Set password policy (minimum 8 chars, uppercase, lowercase, numbers, special characters)
4. Create an **App Client** (no client secret needed for SPA)
5. Note down:
   - **User Pool ID** (e.g. `eu-north-1_AbCdEfGhI`)
   - **App Client ID** (e.g. `1abc2def3ghi4jkl5mno`)

You will need these for the backend `.env` file.

---

## Step 4 — Deploy the Image-Resize Lambda

This Lambda automatically generates thumbnails when images are uploaded to the originals bucket.

### 4a. Create the IAM Role

```bash
# Create the trust policy (allows Lambda to assume the role)
aws iam create-role \
  --role-name mini-jira-lambda-resize-role \
  --assume-role-policy-document file://infra/trust-policy.json

# Attach basic execution role (CloudWatch Logs)
aws iam attach-role-policy \
  --role-name mini-jira-lambda-resize-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Attach custom policy for S3 + DynamoDB access
# Edit infra/lambda-policy.json first — replace bucket names with yours
aws iam put-role-policy \
  --role-name mini-jira-lambda-resize-role \
  --policy-name ImageResizePolicy \
  --policy-document file://infra/lambda-policy.json
```

### 4b. Package & Deploy

```bash
cd lambdas/image-resize
npm install
cd ..
# Zip the contents (not the folder itself)
# Windows PowerShell:
Compress-Archive -Path image-resize\* -DestinationPath image-resize.zip -Force

# Deploy
aws lambda create-function \
  --function-name mini-jira-image-resize \
  --runtime nodejs20.x \
  --role arn:aws:iam::<YOUR_ACCOUNT_ID>:role/mini-jira-lambda-resize-role \
  --handler index.handler \
  --zip-file fileb://image-resize.zip \
  --timeout 30 \
  --memory-size 512 \
  --region eu-north-1 \
  --environment "Variables={S3_RESIZED_BUCKET=mini-jira-resized-<YOUR-NAME>,DYNAMODB_TASKS_TABLE=Tasks,THUMBNAIL_WIDTH=400,THUMBNAIL_HEIGHT=400}"
```

### 4c. Add S3 Trigger

```bash
# Allow S3 to invoke the Lambda
aws lambda add-permission \
  --function-name mini-jira-image-resize \
  --statement-id s3-trigger \
  --action lambda:InvokeFunction \
  --principal s3.amazonaws.com \
  --source-arn arn:aws:s3:::mini-jira-originals-<YOUR-NAME>

# Configure the S3 bucket notification (edit infra/notification.json with your Lambda ARN)
aws s3api put-bucket-notification-configuration \
  --bucket mini-jira-originals-<YOUR-NAME> \
  --notification-configuration file://infra/notification.json
```

---

## Step 5 — Set Up SNS + SQS Pipeline

This pipeline broadcasts task assignment events via SNS, which fans out to an SQS queue.

You can run the automated script:
```powershell
# From the project root
.\infra\setup-assignment-pipeline.ps1
```

Or do it manually:

```bash
# Create SNS topic
aws sns create-topic --name TaskAssignmentsTopic --region eu-north-1

# Create SQS queue
aws sqs create-queue --queue-name TaskAssignmentsQueue --region eu-north-1

# Subscribe SQS to SNS (use the ARNs from above)
aws sns subscribe \
  --topic-arn arn:aws:sns:eu-north-1:<ACCOUNT_ID>:TaskAssignmentsTopic \
  --protocol sqs \
  --notification-endpoint arn:aws:sqs:eu-north-1:<ACCOUNT_ID>:TaskAssignmentsQueue

# Set SQS access policy to allow SNS to send messages
# Edit infra/sqs-policy.json with your ARNs first
aws sqs set-queue-attributes \
  --queue-url <YOUR_QUEUE_URL> \
  --attributes file://infra/sqs-policy.json
```

Note down the **SNS Topic ARN** — you need it for the backend `.env`.

---

## Step 6 — Deploy the Assignment Worker Lambda

This Lambda reads from SQS, logs activity to DynamoDB, and pushes CloudWatch metrics.

```bash
cd lambdas/assignment-worker
npm install
cd ../..

# Zip it
Compress-Archive -Path lambdas\assignment-worker\* -DestinationPath lambdas\assignment-worker.zip -Force

# Run the deployment script (creates role + Lambda + SQS trigger)
.\infra\deploy-assignment-worker.ps1
```

Or manually follow the steps in `infra/deploy-assignment-worker.ps1`.

---

## Step 7 — Deploy the Daily Digest Lambda

This Lambda runs daily at 9:00 AM via EventBridge, scans for overdue tasks, and sends digest emails via SNS.

```bash
cd lambdas/daily-digest
npm install
cd ../..

# Zip it
Compress-Archive -Path lambdas\daily-digest\* -DestinationPath lambdas\daily-digest.zip -Force

# Run the deployment script (creates role + Lambda + EventBridge rule)
.\infra\deploy-daily-digest.ps1
```

Or manually follow the steps in `infra/deploy-daily-digest.ps1`.

---

## Step 8 — Set Up CloudWatch Dashboard & Alarms

First, create an SNS topic for alarms:
```bash
aws sns create-topic --name mini-jira-alarms --region eu-north-1
```

Then run the setup script from the backend directory (it needs the `@aws-sdk/client-cloudwatch` dependency):
```bash
cd backend

# Set environment variables and run:
# PowerShell:
$env:SNS_ALARM_TOPIC_ARN = "arn:aws:sns:eu-north-1:<ACCOUNT_ID>:mini-jira-alarms"
$env:REGION = "eu-north-1"
node ..\infra\setup-cloudwatch.cjs
```

This creates:
- **MiniJira Dashboard** with 4 widgets (Tasks Created, Tasks Closed, Avg Time to Close, EC2 CPU)
- **Overdue Tasks Alarm** (fires when overdue > 10)
- **EC2 High CPU Alarm** (fires when CPU > 70%)

---

## Step 9 — Configure & Run the Backend

### 9a. Create the `.env` file

Create `backend/.env` with the following (replace all placeholder values):

```env
PORT=3000
AWS_REGION=eu-north-1
FRONTEND_URL=http://localhost:5173
COGNITO_USER_POOL_ID=<YOUR_COGNITO_USER_POOL_ID>
COGNITO_CLIENT_ID=<YOUR_COGNITO_APP_CLIENT_ID>
DYNAMODB_TASKS_TABLE=Tasks
DYNAMODB_COMMENTS_TABLE=Comments
S3_ORIGINALS_BUCKET=mini-jira-originals-<YOUR-NAME>
S3_RESIZED_BUCKET=mini-jira-resized-<YOUR-NAME>
SNS_TOPIC_ARN=arn:aws:sns:eu-north-1:<YOUR_ACCOUNT_ID>:TaskAssignmentsTopic
```

### 9b. Install & Run

```bash
cd backend
npm install
npm run dev
```

The backend runs on `http://localhost:3000`.

---

## Step 10 — Configure & Run the Frontend

The frontend connects to the backend API and Cognito for authentication.

### 10a. Check API URL

Make sure `frontend/src/services/api.js` points to `http://localhost:3000` (or your deployed backend URL).

### 10b. Install & Run

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`.

---

## Project Structure

```
Project/
├── backend/                    # Express.js REST API
│   ├── src/
│   │   ├── lib/                # Shared utilities
│   │   │   ├── cloudwatch.js   # CloudWatch custom metrics
│   │   │   ├── cognito.js      # Cognito JWT verification
│   │   │   ├── s3.js           # S3 upload/download/presign
│   │   │   └── sns.js          # SNS message publishing
│   │   ├── modules/
│   │   │   ├── tasks/          # Task CRUD + status updates
│   │   │   ├── comments/       # Comment threads on tasks
│   │   │   └── upload/         # Image upload via multer + S3
│   │   └── index.js            # Entry point
│   ├── package.json
│   └── .env                    # Environment config (not committed)
│
├── frontend/                   # React + Vite SPA
│   ├── src/
│   │   ├── components/         # Kanban board, task cards, modals
│   │   ├── pages/              # Dashboard, Login, Register
│   │   └── services/           # API client + auth helpers
│   └── package.json
│
├── lambdas/                    # AWS Lambda function source code
│   ├── image-resize/           # Triggered by S3 → creates thumbnails
│   ├── assignment-worker/      # Triggered by SQS → logs activity + CW metrics
│   └── daily-digest/           # Triggered by EventBridge → sends digest emails
│
├── infra/                      # Infrastructure deployment scripts & IAM policies
│   ├── setup-assignment-pipeline.ps1
│   ├── deploy-assignment-worker.ps1
│   ├── deploy-daily-digest.ps1
│   ├── deploy-lambda-part2.ps1
│   ├── setup-cloudwatch.cjs
│   ├── trust-policy.json
│   ├── lambda-policy.json
│   ├── sqs-policy.json
│   └── ...other IAM policies
│
├── .gitignore
└── README.md                   # ← You are here
```

---

## Environment Variables Reference

| Variable                  | Where    | Description                                      |
| ------------------------- | -------- | ------------------------------------------------ |
| `PORT`                    | Backend  | Server port (default: `3000`)                    |
| `AWS_REGION`              | Backend  | AWS region (e.g. `eu-north-1`)                   |
| `FRONTEND_URL`            | Backend  | Frontend origin for CORS                         |
| `COGNITO_USER_POOL_ID`    | Backend  | Your Cognito User Pool ID                        |
| `COGNITO_CLIENT_ID`       | Backend  | Your Cognito App Client ID                       |
| `DYNAMODB_TASKS_TABLE`    | Backend  | DynamoDB table name for tasks (default: `Tasks`) |
| `DYNAMODB_COMMENTS_TABLE` | Backend  | DynamoDB table for comments (default: `Comments`)|
| `S3_ORIGINALS_BUCKET`     | Backend  | S3 bucket for original uploads                   |
| `S3_RESIZED_BUCKET`       | Backend  | S3 bucket for resized thumbnails                 |
| `SNS_TOPIC_ARN`           | Backend  | ARN of the TaskAssignmentsTopic                  |

---

## Useful AWS Console Links

- **S3**: https://s3.console.aws.amazon.com/s3/
- **DynamoDB**: https://console.aws.amazon.com/dynamodb/
- **Lambda**: https://console.aws.amazon.com/lambda/
- **CloudWatch Dashboard**: https://eu-north-1.console.aws.amazon.com/cloudwatch/home?region=eu-north-1#dashboards:name=MiniJira
- **SNS**: https://console.aws.amazon.com/sns/
- **SQS**: https://console.aws.amazon.com/sqs/
- **Cognito**: https://console.aws.amazon.com/cognito/

---

## License

This project was built as a university assignment for a Cloud Computing course.
