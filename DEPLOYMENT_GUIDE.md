# Mini-Jira AWS — Console Deployment Guide

> **Free-Tier Architecture**: Single EC2 t3.micro · No NAT Gateway · No ASG · CloudFront → EC2 · DynamoDB on-demand · All within AWS Free Tier limits.
> 
> Everything in this guide is done from the **AWS Console website** — no CDK, no CLI required (except one terminal session to SSH into EC2).

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Free-Tier Architecture Overview](#2-free-tier-architecture-overview)
3. [DynamoDB Tables & GSIs](#3-dynamodb-tables--gsis)
4. [Cognito User Pool](#4-cognito-user-pool)
5. [S3 Buckets](#5-s3-buckets)
6. [SNS Topics](#6-sns-topics)
7. [SQS Queue & DLQ](#7-sqs-queue--dlq)
8. [SNS → SQS Subscription](#8-sns--sqs-subscription)
9. [IAM Roles](#9-iam-roles)
10. [Lambda Functions](#10-lambda-functions)
11. [EventBridge Rule](#11-eventbridge-rule)
12. [SSM Parameter Store](#12-ssm-parameter-store)
13. [EC2 Instance](#13-ec2-instance)
14. [Deploy Backend to EC2](#14-deploy-backend-to-ec2)
15. [CloudFront Distribution](#15-cloudfront-distribution)
16. [Frontend Build & S3 Hosting](#16-frontend-build--s3-hosting)
17. [CloudWatch Alarms](#17-cloudwatch-alarms)
18. [Demo User Setup](#18-demo-user-setup)
19. [Verification Checklist](#19-verification-checklist)
20. [Demo Day Script](#20-demo-day-script)
21. [Troubleshooting](#21-troubleshooting)
22. [Quick Reference Card](#22-quick-reference-card)

---

## 1. Prerequisites

- **AWS Account** with Free Tier active — check at **Console → Billing → Free Tier**
- **Region**: pick one and use it for everything. Recommended: `eu-north-1` (Stockholm)
- **Node.js 20+** on your local machine (only needed to build the frontend and zip Lambdas)
- **SSH client** — built into Mac/Linux terminal; use PuTTY on Windows
- **Git** on your local machine

> Every time you open a new AWS Console page, confirm the **region dropdown** (top-right corner) matches your chosen region before creating anything.

---

## 2. Free-Tier Architecture Overview

```
Browser
  │
  ▼
CloudFront  ←── free: 1 TB/month, always
  │
  ├──/api/*──► EC2 t3.micro :3000  (Node.js + PM2)
  │                │
  │                ├── DynamoDB  (Tasks, Comments, Projects, ActivityLogs)
  │                ├── Cognito   (auth — JWT)
  │                ├── S3        (image uploads — originals bucket)
  │                └── SSM       (secrets fetched at boot)
  │
  └──/*──────► S3 Static Website  (React frontend)

Lambdas (run only when triggered — always free tier):
  image-resize  ← S3 PUT trigger
  sqs-worker    ← SQS trigger
  daily-digest  ← EventBridge 9 AM cron
```

### Free Tier cost table

| Service | Free allowance | This project's usage |
|---|---|---|
| EC2 t3.micro | 750 hrs/month (12 months) | 720 hrs (1 instance) ✅ |
| S3 storage | 5 GB (12 months) | < 100 MB ✅ |
| DynamoDB | 25 GB storage, on-demand ≈ $0 at demo scale | < 1 MB ✅ |
| Lambda | 1 M requests/month always free | < 1,000 ✅ |
| CloudFront | 1 TB transfer/month always free | < 100 MB ✅ |
| Cognito | 50,000 MAU always free | < 10 users ✅ |
| SNS | 1 M publishes/month | < 100 ✅ |
| SQS | 1 M requests/month | < 100 ✅ |
| SSM Parameter Store | Standard params free | ~16 params ✅ |

**What NOT to create** (these cost money):
- ❌ NAT Gateway (~$32/month)
- ❌ Application Load Balancer (LCU charges beyond free baseline)
- ❌ Multiple EC2 instances (only 750 hours free — one instance = free, two = charged)
- ❌ Detailed EC2 monitoring (basic is free)
- ❌ DynamoDB point-in-time recovery PITR ($0.20/GB/month)

---

## 3. DynamoDB Tables & GSIs

> **GSIs are free**: they don't add a separate charge. Storage counts toward the 25 GB free tier. Reads/writes on on-demand tables cost the same as table reads/writes — at demo scale this rounds to $0.00.

Go to: **AWS Console → DynamoDB → Tables → Create table**

### 3a. Tasks Table

| Field | Value |
|---|---|
| Table name | `Tasks` |
| Partition key | `taskId` (String) |
| Sort key | *(leave blank)* |
| Table settings | **Customize settings** |
| Capacity mode | **On-demand** |
| Encryption | AWS owned key (default) |

Click **Create table**. Wait for status **Active**.

**Add GSIs** — click the `Tasks` table → **Indexes** tab → **Create index**

> Wait for each GSI to reach **Active** before creating the next one.

**GSI 1 — employee team queries:**

| Field | Value |
|---|---|
| Partition key | `teamId` (String) |
| Sort key | `createdAt` (String) |
| Index name | `teamId-createdAt-index` |
| Attribute projections | **All** |

**GSI 2 — manager all-tasks query (replaces expensive full Scan):**

| Field | Value |
|---|---|
| Partition key | `entity` (String) |
| Sort key | `createdAt` (String) |
| Index name | `entity-createdAt-index` |
| Attribute projections | **All** |

**GSI 3 — assignee queries (used by daily digest Lambda):**

| Field | Value |
|---|---|
| Partition key | `assigneeId` (String) |
| Sort key | `createdAt` (String) |
| Index name | `assigneeId-createdAt-index` |
| Attribute projections | **All** |

---

### 3b. Comments Table

| Field | Value |
|---|---|
| Table name | `Comments` |
| Partition key | `commentId` (String) |
| Capacity mode | **On-demand** |

**GSI:**

| Field | Value |
|---|---|
| Partition key | `taskId` (String) |
| Sort key | `createdAt` (String) |
| Index name | `taskId-index` |
| Attribute projections | **All** |

---

### 3c. Projects Table

| Field | Value |
|---|---|
| Table name | `Projects` |
| Partition key | `projectId` (String) |
| Capacity mode | **On-demand** |

**GSI:**

| Field | Value |
|---|---|
| Partition key | `teamId` (String) |
| Sort key | `createdAt` (String) |
| Index name | `teamId-createdAt-index` |
| Attribute projections | **All** |

---

### 3d. ActivityLogs Table

| Field | Value |
|---|---|
| Table name | `ActivityLogs` |
| Partition key | `logId` (String) |
| Capacity mode | **On-demand** |

**Enable TTL** (auto-deletes old logs — keeps costs at zero long-term):
After the table is **Active** → **Additional settings** tab → **Time to live (TTL)** → **Manage TTL** → attribute name: `expiresAt` → **Save**.

**GSI:**

| Field | Value |
|---|---|
| Partition key | `taskId` (String) |
| Sort key | `timestamp` (String) |
| Index name | `taskId-timestamp-index` |
| Attribute projections | **All** |

---

## 4. Cognito User Pool

Go to: **AWS Console → Cognito → User pools → Create user pool**

### Step 1 — Sign-in experience
- Sign-in options: check **Email**
- Click **Next**

### Step 2 — Security requirements
- Password policy: **Cognito defaults**
- MFA: **No MFA**
- Click **Next**

### Step 3 — Sign-up experience
- Self-registration: **Enable**
- Required attributes: add **email**
- Custom attributes → **Add custom attribute** (do this twice):
  - Name: `role` · Type: String
  - Name: `teamId` · Type: String
- Click **Next**

### Step 4 — Message delivery
- Email provider: **Send email with Cognito** (free)
- Click **Next**

### Step 5 — Integrate your app
- User pool name: `mini-jira-pool`
- Uncheck **"Use the Cognito Hosted UI"**
- App client name: `mini-jira-client`
- Client secret: **Don't generate a client secret**
- Authentication flows — make sure these are checked:
  - `ALLOW_USER_PASSWORD_AUTH`
  - `ALLOW_REFRESH_TOKEN_AUTH`
- Click **Next**

### Step 6 — Review and create
- Click **Create user pool**

**Save these two values** — you need them in step 12:
- **User Pool ID** (format: `eu-north-1_xxxxxxxx`)
- **App Client ID** (format: `xxxxxxxxxxxxxxxxxxxxxxxxxx`)

---

## 5. S3 Buckets

Go to: **AWS Console → S3 → Create bucket**

Create **three** buckets total.

### 5a. Originals Bucket (uploaded images)

| Field | Value |
|---|---|
| Bucket name | `mini-jira-originals-YOURNAME-2026` *(globally unique — add your name)* |
| Region | Same region as everything else |
| Block all public access | **Checked** (images accessed via presigned URLs) |
| Versioning | Disabled |

Click **Create bucket**.

**Add CORS** — click the bucket → **Permissions** tab → **Cross-origin resource sharing (CORS)** → **Edit** → paste:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

Click **Save changes**.

### 5b. Resized Bucket (Lambda thumbnails)

| Field | Value |
|---|---|
| Bucket name | `mini-jira-resized-YOURNAME-2026` |
| Region | Same |
| Block all public access | **Checked** |

Click **Create bucket**. No CORS needed.

### 5c. Frontend Bucket (React static site)

| Field | Value |
|---|---|
| Bucket name | `mini-jira-frontend-YOURNAME-2026` |
| Region | Same |
| Block all public access | **Uncheck all** *(must be public for static hosting)* |
| Acknowledge the warning | **Check the box** |

Click **Create bucket**.

**Enable static website hosting** — Properties tab → **Static website hosting** → **Edit**:
- Enable: **Enable**
- Hosting type: **Host a static website**
- Index document: `index.html`
- Error document: `index.html`
- Click **Save changes**

**Bucket policy** — Permissions tab → **Bucket policy** → **Edit** → paste (replace `YOURNAME`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::mini-jira-frontend-YOURNAME-2026/*"
    }
  ]
}
```

Click **Save changes**.

---

## 6. SNS Topics

Go to: **AWS Console → Simple Notification Service → Topics → Create topic**

### 6a. Task Assignments Topic

| Field | Value |
|---|---|
| Type | **Standard** |
| Name | `TaskAssignmentsTopic` |
| Display name | `Mini-Jira Assignments` |

Click **Create topic**. **Copy and save the ARN** (shown on the topic page).

**Add email subscription** (for demo — so you receive assignment emails):
- Topics → `TaskAssignmentsTopic` → **Create subscription**
- Protocol: **Email**
- Endpoint: your email address
- Click **Create subscription**
- Check your inbox and click **Confirm subscription** in the email

### 6b. Daily Digest Topic

Same steps:

| Field | Value |
|---|---|
| Type | **Standard** |
| Name | `DailyDigestTopic` |

Save the ARN. Add and confirm an email subscription.

---

## 7. SQS Queue & DLQ

Go to: **AWS Console → SQS → Create queue**

### 7a. Dead Letter Queue — create this FIRST

| Field | Value |
|---|---|
| Type | **Standard** |
| Name | `TaskAssignmentsQueue-DLQ` |
| Visibility timeout | 30 seconds |
| Message retention period | 14 days |

Click **Create queue**. **Save the ARN** shown on the queue page.

### 7b. Main Queue

| Field | Value |
|---|---|
| Type | **Standard** |
| Name | `TaskAssignmentsQueue` |
| Visibility timeout | 30 seconds |
| Message retention period | 4 days |

Scroll to **Dead-letter queue**:
- Enabled: **Yes**
- Choose queue: `TaskAssignmentsQueue-DLQ`
- Maximum receives: `3`

Click **Create queue**. **Save the ARN and the Queue URL**.

---

## 8. SNS → SQS Subscription

**Step 1** — Go to: **SQS → TaskAssignmentsQueue → Subscribe to Amazon SNS topic**
- Choose `TaskAssignmentsTopic` → **Save**

**Step 2** — Add access policy so SNS can write to SQS:

Go to: **SQS → TaskAssignmentsQueue → Access policy → Edit**

Replace the entire policy (fill in your real account ID and region):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "sns.amazonaws.com" },
      "Action": "sqs:SendMessage",
      "Resource": "arn:aws:sqs:YOUR_REGION:YOUR_ACCOUNT_ID:TaskAssignmentsQueue",
      "Condition": {
        "ArnEquals": {
          "aws:SourceArn": "arn:aws:sns:YOUR_REGION:YOUR_ACCOUNT_ID:TaskAssignmentsTopic"
        }
      }
    }
  ]
}
```

Click **Save**.

---

## 9. IAM Roles

### 9a. Lambda Execution Role

Go to: **IAM → Roles → Create role**

- Trusted entity type: **AWS service**
- Use case: **Lambda**
- Click **Next**

Search and attach these managed policies:
- `AWSLambdaBasicExecutionRole`
- `AmazonDynamoDBFullAccess`
- `AmazonS3FullAccess`
- `AmazonSNSFullAccess`
- `AmazonSQSFullAccess`

- Role name: `mini-jira-lambda-role`
- Click **Create role**

### 9b. EC2 Instance Role

Go to: **IAM → Roles → Create role**

- Trusted entity type: **AWS service**
- Use case: **EC2**
- Click **Next**

Search and attach:
- `AmazonSSMManagedInstanceCore` *(enables Session Manager — no SSH key needed)*
- `CloudWatchAgentServerPolicy`
- `AmazonDynamoDBFullAccess`
- `AmazonS3FullAccess`
- `AmazonSNSFullAccess`
- `AmazonCognitoPowerUser`
- `AmazonSSMReadOnlyAccess`

- Role name: `mini-jira-ec2-role`
- Click **Create role**

---

## 10. Lambda Functions

### Package the Lambdas on your computer

Open a terminal on your local machine:

```bash
# Go to your project directory
cd /path/to/mini-jira-aws

# Image resize Lambda
cd lambdas/image-resize
npm install
zip -r ../../image-resize.zip .
cd ../..

# SQS worker Lambda
cd lambdas/sqs-worker
npm install
zip -r ../../sqs-worker.zip .
cd ../..

# Daily digest Lambda
cd lambdas/daily-digest
npm install
zip -r ../../daily-digest.zip .
cd ../..
```

You now have three zip files in your project root.

> **Windows users**: use `Compress-Archive` in PowerShell or 7-Zip. Make sure the zip contains the files at the root, not inside a subfolder.

---

### 10a. image-resize Lambda

Go to: **Lambda → Create function → Author from scratch**

| Field | Value |
|---|---|
| Function name | `mini-jira-image-resize` |
| Runtime | **Node.js 20.x** |
| Architecture | x86_64 |
| Execution role | **Use an existing role** → `mini-jira-lambda-role` |

Click **Create function**.

**Upload code:**
- **Code** tab → **Upload from** → **.zip file** → select `image-resize.zip` → **Save**

**Environment variables** — **Configuration** tab → **Environment variables** → **Edit** → **Add environment variable**:

| Key | Value |
|---|---|
| `S3_RESIZED_BUCKET` | `mini-jira-resized-YOURNAME-2026` |
| `AWS_REGION` | `eu-north-1` |
| `DYNAMODB_TASKS_TABLE` | `Tasks` |

Click **Save**.

**Increase timeout** — **Configuration** tab → **General configuration** → **Edit** → Timeout: `0 min 30 sec` → **Save**

**Add S3 trigger** — **Configuration** tab → **Triggers** → **Add trigger**:
- Source: **S3**
- Bucket: `mini-jira-originals-YOURNAME-2026`
- Event types: **PUT**
- Prefix: `task-images/`
- Acknowledge the warning → **Add**

---

### 10b. sqs-worker Lambda

Go to: **Lambda → Create function → Author from scratch**

| Field | Value |
|---|---|
| Function name | `mini-jira-sqs-worker` |
| Runtime | **Node.js 20.x** |
| Execution role | `mini-jira-lambda-role` |

Upload `sqs-worker.zip`.

**Environment variables:**

| Key | Value |
|---|---|
| `DYNAMODB_ACTIVITY_LOGS_TABLE` | `ActivityLogs` |
| `AWS_REGION` | `eu-north-1` |

**Add SQS trigger** — **Configuration** tab → **Triggers** → **Add trigger**:
- Source: **SQS**
- SQS queue: `TaskAssignmentsQueue`
- Batch size: `1`
- Click **Add**

---

### 10c. daily-digest Lambda

Go to: **Lambda → Create function → Author from scratch**

| Field | Value |
|---|---|
| Function name | `mini-jira-daily-digest` |
| Runtime | **Node.js 20.x** |
| Execution role | `mini-jira-lambda-role` |

Upload `daily-digest.zip`.

**Environment variables:**

| Key | Value |
|---|---|
| `DYNAMODB_TASKS_TABLE` | `Tasks` |
| `SNS_DIGEST_TOPIC_ARN` | *(your DailyDigestTopic ARN from step 6b)* |
| `AWS_REGION` | `eu-north-1` |
| `ENV` | `production` |

**Timeout**: `0 min 60 sec`

---

## 11. EventBridge Rule

Go to: **AWS Console → EventBridge → Rules → Create rule**

| Field | Value |
|---|---|
| Name | `mini-jira-daily-digest` |
| Event bus | **default** |
| Rule type | **Schedule** |

Click **Next**.

**Schedule pattern**:
- Select **A fine-grained schedule** (cron)
- Cron expression: `0 9 * * ? *`
- *(This runs at 09:00 UTC every day)*

Click **Next**.

**Target**:
- Target types: **AWS service**
- Select a target: **Lambda function**
- Function: `mini-jira-daily-digest`

Click **Next** → **Next** → **Create rule**.

---

## 12. SSM Parameter Store

Go to: **AWS Console → Systems Manager → Parameter Store → Create parameter**

Create each parameter below. Settings for every one:
- **Tier**: Standard *(free)*
- **Type**: SecureString
- **KMS key source**: My current account

Click **Create parameter** after each one.

| Parameter Name | Value to enter |
|---|---|
| `/mini-jira/PORT` | `3000` |
| `/mini-jira/NODE_ENV` | `production` |
| `/mini-jira/AWS_REGION` | `eu-north-1` |
| `/mini-jira/COGNITO_USER_POOL_ID` | *(from step 4)* |
| `/mini-jira/COGNITO_CLIENT_ID` | *(from step 4)* |
| `/mini-jira/DYNAMODB_TASKS_TABLE` | `Tasks` |
| `/mini-jira/DYNAMODB_COMMENTS_TABLE` | `Comments` |
| `/mini-jira/DYNAMODB_PROJECTS_TABLE` | `Projects` |
| `/mini-jira/DYNAMODB_ACTIVITY_LOGS_TABLE` | `ActivityLogs` |
| `/mini-jira/S3_ORIGINALS_BUCKET` | `mini-jira-originals-YOURNAME-2026` |
| `/mini-jira/S3_RESIZED_BUCKET` | `mini-jira-resized-YOURNAME-2026` |
| `/mini-jira/SNS_TOPIC_ARN` | *(TaskAssignmentsTopic ARN from step 6a)* |
| `/mini-jira/SNS_DIGEST_TOPIC_ARN` | *(DailyDigestTopic ARN from step 6b)* |
| `/mini-jira/CW_NAMESPACE` | `MiniJira` |
| `/mini-jira/ENV` | `production` |
| `/mini-jira/FRONTEND_URL` | `https://YOUR_CLOUDFRONT_DOMAIN` *(fill after step 15)* |

---

## 13. EC2 Instance

### 13a. Create a Key Pair (for SSH access)

Go to: **EC2 → Key Pairs → Create key pair**

| Field | Value |
|---|---|
| Name | `mini-jira-key` |
| Key pair type | RSA |
| Private key file format | `.pem` (Mac/Linux) or `.ppk` (Windows PuTTY) |

Click **Create key pair** — the file downloads automatically. **Keep this file safe.**

### 13b. Create Security Group

Go to: **EC2 → Security Groups → Create security group**

| Field | Value |
|---|---|
| Security group name | `mini-jira-ec2-sg` |
| Description | Mini-Jira backend |
| VPC | **Default VPC** |

**Inbound rules** — click **Add rule** for each:

| Type | Protocol | Port range | Source | Description |
|---|---|---|---|---|
| Custom TCP | TCP | 3000 | 0.0.0.0/0 | Node.js API |
| SSH | TCP | 22 | **My IP** | SSH from your IP |

Click **Create security group**.

### 13c. Launch the EC2 Instance

Go to: **EC2 → Instances → Launch instances**

| Field | Value |
|---|---|
| Name | `mini-jira-backend` |
| Application and OS Image | **Amazon Linux 2023 AMI** — look for "Free tier eligible" badge |
| Instance type | **t3.micro** — look for "Free tier eligible" |
| Key pair | `mini-jira-key` |

**Network settings** — click **Edit**:
- VPC: Default VPC
- Subnet: any (pick the first one)
- Auto-assign public IP: **Enable**
- Firewall: **Select existing security group** → `mini-jira-ec2-sg`

**Configure storage**:
- 8 GiB gp2 (default) ← leave as-is, this is within free tier

**Advanced details** — scroll to bottom:
- IAM instance profile: **mini-jira-ec2-role**
- User data — paste this script (replace `YOUR_GITHUB_USERNAME`):

```bash
#!/bin/bash
set -e
yum update -y

# Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs git

# PM2
npm install -g pm2

# Clone project
cd /home/ec2-user
git clone https://github.com/YOUR_GITHUB_USERNAME/mini-jira-aws.git app
cd app/backend

# Fetch all SSM parameters into .env
REGION=eu-north-1
aws ssm get-parameters-by-path \
  --path "/mini-jira" \
  --with-decryption \
  --region "$REGION" \
  --query "Parameters[*].[Name,Value]" \
  --output text | while IFS=$'\t' read -r name value; do
    key="${name##/mini-jira/}"
    printf '%s=%s\n' "$key" "$value"
  done > .env

# Install and start
npm ci --production
pm2 start src/index.js --name mini-jira
pm2 startup systemd -u ec2-user --hp /home/ec2-user
pm2 save
```

Click **Launch instance**.

Go to **EC2 → Instances** — wait until **Instance state** shows **Running** and **Status check** shows **2/2 checks passed** (takes 2-3 minutes).

**Save the Public IPv4 address** shown in the instance details — you need it for CloudFront.

---

## 14. Deploy Backend to EC2

### Connect via Session Manager (no SSH key needed)

Go to: **EC2 → Instances → select your instance → Connect → Session Manager tab → Connect**

A browser terminal opens.

```bash
# Switch to the ec2-user
sudo su - ec2-user

# Check the backend is running
pm2 list

# Confirm it responds
curl http://localhost:3000/api/health
```

Expected output from health check: `{"status":"ok"}`

If the output shows **no pm2 processes** or **errored**, the user data script may still be running. Wait 3 minutes and check again:

```bash
# Check if user data script is still running
cat /var/log/cloud-init-output.log | tail -30
```

### Connect via SSH (alternative)

```bash
# Mac/Linux — in your local terminal
chmod 400 ~/Downloads/mini-jira-key.pem
ssh -i ~/Downloads/mini-jira-key.pem ec2-user@YOUR_EC2_PUBLIC_IP
```

### Update backend after a code change

```bash
# On the EC2 (via Session Manager or SSH)
cd /home/ec2-user/app
git pull origin main
cd backend
npm ci --production
pm2 reload mini-jira
```

---

## 15. CloudFront Distribution

Go to: **AWS Console → CloudFront → Create distribution**

### Origin

| Field | Value |
|---|---|
| Origin domain | Type your **EC2 Public IPv4** (e.g. `13.51.x.x`) — do NOT pick from the dropdown |
| Protocol | **HTTP only** |
| HTTP port | `3000` |
| Name | `ec2-backend` |

### Default cache behavior

| Field | Value |
|---|---|
| Viewer protocol policy | **Redirect HTTP to HTTPS** |
| Allowed HTTP methods | **GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE** |
| Cache policy | **CachingDisabled** |
| Origin request policy | **AllViewer** |

### Settings

| Field | Value |
|---|---|
| Price class | **Use only North America and Europe** (lowest cost) |
| Default root object | *(leave blank)* |

Click **Create distribution**.

Status changes from **Deploying** to **Enabled** — this takes about 5 minutes.

**Save the Distribution domain name** — looks like `dxxxxxxxxxxxx.cloudfront.net`.

**Test it:**
Open `https://dxxxxxxxxxxxx.cloudfront.net/api/health` in your browser — should return `{"status":"ok"}`.

**Update the SSM parameter** `/mini-jira/FRONTEND_URL`:
- SSM Parameter Store → `/mini-jira/FRONTEND_URL` → **Edit** → Value: `https://dxxxxxxxxxxxx.cloudfront.net` → **Save changes**

Then reload the backend to pick up the new value:

```bash
# On EC2 (Session Manager)
cd /home/ec2-user/app/backend

# Re-fetch SSM params
REGION=eu-north-1
aws ssm get-parameters-by-path \
  --path "/mini-jira" \
  --with-decryption \
  --region "$REGION" \
  --query "Parameters[*].[Name,Value]" \
  --output text | while IFS=$'\t' read -r name value; do
    key="${name##/mini-jira/}"
    printf '%s=%s\n' "$key" "$value"
  done > .env

pm2 reload mini-jira
```

---

## 16. Frontend Build & S3 Hosting

### 16a. Build on your local machine

Edit `frontend/.env` (create if it does not exist):

```
VITE_COGNITO_USER_POOL_ID=eu-north-1_xxxxxxxx
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_API_URL=https://dxxxxxxxxxxxx.cloudfront.net/api
```

Replace both Cognito values from step 4 and the CloudFront domain from step 15.

Then build:

```bash
cd frontend
npm install
npm run build
```

This creates a `dist/` folder.

### 16b. Upload to S3

Go to: **S3 → mini-jira-frontend-YOURNAME-2026 → Upload**

1. Click **Add files** → select every file directly inside `dist/` (like `index.html`, `vite.svg`, etc.)
2. Click **Add folder** → select the `assets/` folder inside `dist/`
3. Click **Upload** → wait for completion

### 16c. Add a Second CloudFront Origin (S3 Frontend)

Go to: **CloudFront → your distribution → Origins tab → Create origin**

| Field | Value |
|---|---|
| Origin domain | Click the dropdown → select `mini-jira-frontend-YOURNAME-2026.s3-website-eu-north-1.amazonaws.com` |
| Protocol | **HTTP only** |
| Name | `s3-frontend` |

Click **Create origin**.

### 16d. Update CloudFront Behaviors

Go to: **Behaviors tab → Create behavior**

This routes `/api/*` to the EC2 backend:

| Field | Value |
|---|---|
| Path pattern | `/api/*` |
| Origin | `ec2-backend` |
| Viewer protocol policy | **Redirect HTTP to HTTPS** |
| Allowed HTTP methods | GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE |
| Cache policy | **CachingDisabled** |
| Origin request policy | **AllViewer** |

Click **Create behavior**.

Then edit the **Default (\*)** behavior:
- Click the default behavior → **Edit**
- Change Origin to: `s3-frontend`
- Cache policy: **CachingOptimized**
- Click **Save changes**

Now the routing is:
- `https://CF_DOMAIN/api/*` → EC2 backend
- `https://CF_DOMAIN/*` → S3 React frontend

Wait for distribution to redeploy (~2 minutes). Open `https://YOUR_CF_DOMAIN` — the login page should appear.

---

## 17. CloudWatch Alarms

Go to: **CloudWatch → Alarms → All alarms → Create alarm**

### EC2 CPU Alarm

- Click **Select metric** → **EC2** → **Per-Instance Metrics**
- Search your instance ID → select **CPUUtilization** → **Select metric**
- Period: 5 minutes
- Threshold: **Greater than** `80`
- Notification: **Create new topic** → name: `mini-jira-alerts` → email: your address → **Create topic** → confirm the email
- Alarm name: `mini-jira-high-cpu`
- Click **Create alarm**

### DynamoDB Errors Alarm

- Select metric: **DynamoDB** → **Table Metrics** → `Tasks` → **SystemErrors** → **Select metric**
- Threshold: **Greater than** `0`
- Notification: select the `mini-jira-alerts` topic you just created
- Alarm name: `mini-jira-dynamo-errors`
- Click **Create alarm**

---

## 18. Demo User Setup

Go to: **Cognito → User pools → mini-jira-pool → Users → Create user**

### Manager

| Field | Value |
|---|---|
| Invitation | Don't send invitation |
| Email address | `manager@minijira.com` |
| Email address verified | **Check** |
| Temporary password | Set a password: `Manager@2026!` |

After creating → click the user → **Custom attributes** section:
- `custom:role` = `manager`
- `custom:teamId` = `team-alpha`

> To set these attributes from the console, click the user → **Edit** (if available). If there's no edit button for custom attributes, use the **Actions** menu.

### Employee — Alice (team-alpha)

| Field | Value |
|---|---|
| Email address | `alice@minijira.com` |
| Email address verified | **Check** |
| Temporary password | `Alice@2026!` |

Custom attributes:
- `custom:role` = `employee`
- `custom:teamId` = `team-alpha`

### Employee — Bob (team-beta)

| Field | Value |
|---|---|
| Email address | `bob@minijira.com` |
| Email address verified | **Check** |
| Temporary password | `Bob@2026!` |

Custom attributes:
- `custom:role` = `employee`
- `custom:teamId` = `team-beta`

### Set permanent passwords

New users have status `FORCE_CHANGE_PASSWORD`. To change to permanent:

Go to: **Cognito → Users → select user → Actions → Reset password** — then sign in through the app and complete the password change flow, OR use the **Set password** option if visible (allows setting permanent password directly).

---

## 19. Verification Checklist

Go through each item before demo day.

### Infrastructure
- [ ] EC2 instance state: **Running**, Status checks: **2/2 passed**
- [ ] `https://YOUR_CF_DOMAIN/api/health` returns `{"status":"ok"}`
- [ ] All DynamoDB tables show status **Active**
- [ ] All GSIs show status **Active** (not Backfilling)
- [ ] Both S3 buckets exist (originals, resized)
- [ ] All 3 Lambda functions show **Last modified** timestamp (code uploaded)
- [ ] EventBridge rule `mini-jira-daily-digest` is **Enabled**
- [ ] All SSM parameters exist under `/mini-jira/`

### Functionality
- [ ] Login page loads at `https://YOUR_CF_DOMAIN`
- [ ] Manager can log in
- [ ] Employee (Alice) can log in — sees only team-alpha tasks
- [ ] Employee (Bob) can log in — sees only team-beta tasks
- [ ] Manager can create a task
- [ ] Upload an image → appears on the task → check originals S3 bucket for the file → wait 10 seconds → check resized S3 bucket for thumbnail
- [ ] Assign a task → check SQS console for message → check email for notification
- [ ] Drag a task on Kanban → status updates in DynamoDB
- [ ] `GET /api/tasks/TASK_ID/history` returns audit entries

### Lambda smoke tests
- [ ] Lambda → `mini-jira-image-resize` → Monitor → no errors
- [ ] Lambda → `mini-jira-sqs-worker` → Monitor → no errors
- [ ] Lambda → `mini-jira-daily-digest` → **Test** → create test event `{}` → **Invoke** → check email

---

## 20. Demo Day Script

Follow these scenes in order to showcase each AWS service naturally.

### Scene 1 — Login & Auth (Cognito)
Open `https://YOUR_CF_DOMAIN`. Log in as manager.
> *"Authentication is handled by AWS Cognito. The JWT ID token carries `custom:role` and `custom:teamId` claims — the backend verifies the token signature on every request using `aws-jwt-verify`."*

### Scene 2 — Create a Project
Projects page → **New Project** → fill in name and description → **Create**.
> *"Projects are stored in DynamoDB with a `teamId-createdAt-index` GSI for team-scoped queries."*

### Scene 3 — Create a Task with Image Upload (S3 + Lambda)
Tasks → **New Task** → fill all fields → upload an image → **Create**.
- Go to **S3 console → originals bucket** → show the uploaded file under `task-images/`
- Wait 10 seconds → go to **S3 → resized bucket** → show the thumbnail
> *"The S3 PUT event triggers the image-resize Lambda. It uses the `sharp` library to resize the image to 400×400 JPEG and writes the thumbnail to the resized bucket. The task card then uses a presigned URL to display it."*

### Scene 4 — Assign a Task (SNS + SQS + Lambda + Audit)
Edit the task → **Assignee** → select Alice → **Save**.
- Go to **SQS → TaskAssignmentsQueue → Monitoring tab** → show messages received
- Check email for the notification
- Go to **DynamoDB → ActivityLogs table → Explore items** → show the `TASK_ASSIGNMENT` log entry
> *"One SNS publish fans out to: an SQS queue (processed by the worker Lambda which writes the audit log) and an email subscription. This is the SNS fan-out pattern."*

### Scene 5 — Role-Based Access (Team Isolation)
Log out → log in as **Bob** (team-beta). He sees zero tasks. Log in as **Alice** (team-alpha). She sees only team-alpha tasks.
> *"The `teamId` in the JWT is compared against the task's `teamId` in the service layer. The DynamoDB query itself uses the `teamId-createdAt-index` GSI — employees only ever read their own team's data at the database level."*

### Scene 6 — Kanban Drag & Drop (DynamoDB UpdateItem)
Drag a task from **TODO** to **IN_REVIEW**.
- Go to **DynamoDB → Tasks table → Explore items** → find the task → show `status` field updated
> *"Each drag triggers `PATCH /api/tasks/:id/status`. The backend calls `DynamoDB UpdateItem` with an expression. The status change is also written to ActivityLogs."*

### Scene 7 — Audit Trail
In the browser, visit `https://YOUR_CF_DOMAIN/api/tasks/TASK_ID/history`.
Show the JSON response listing every action: TASK_CREATED, TASK_ASSIGNMENT, STATUS_CHANGE.
> *"Every mutation writes an immutable entry to ActivityLogs. The `taskId-timestamp-index` GSI returns them in chronological order in O(log n) time."*

### Scene 8 — Daily Digest Lambda (EventBridge + CloudWatch)
Go to: **Lambda → mini-jira-daily-digest → Test** → create an empty event `{}` → **Invoke**.
Check email for the digest. Then go to **CloudWatch → Metrics → MiniJira namespace** → show the `OverdueTasks` metric.
> *"EventBridge triggers this Lambda at 9 AM UTC daily. It does a paginated DynamoDB scan, groups overdue tasks by assignee, sends one digest email per assignee via SNS, and emits a custom CloudWatch metric."*

### Scene 9 — Monitoring
Open **CloudWatch → Alarms** → show both alarms in OK state.
Open **EC2 → Monitor tab** → show CPU/network graphs.
> *"Custom metrics go to the MiniJira namespace. We have alarms on CPU > 80% and DynamoDB errors — both route to an SNS email alert."*

---

## 21. Troubleshooting

### Health check returns 502 or connection refused via CloudFront

1. Open **EC2 → Instances** → confirm instance is **Running**
2. Connect via Session Manager → run `pm2 list` → is it **online**?
3. Run `pm2 logs mini-jira --lines 50` → read the error
4. Run `curl http://localhost:3000/api/health` → does it respond locally?
5. If not responding locally → check `.env` file: `cat /home/ec2-user/app/backend/.env`

### `.env` on EC2 is empty or missing variables

The SSM fetch in user data may have run too early. Run it manually:

```bash
# On EC2 via Session Manager
sudo su - ec2-user
cd /home/ec2-user/app/backend

REGION=eu-north-1
aws ssm get-parameters-by-path \
  --path "/mini-jira" \
  --with-decryption \
  --region "$REGION" \
  --query "Parameters[*].[Name,Value]" \
  --output text | while IFS=$'\t' read -r name value; do
    key="${name##/mini-jira/}"
    printf '%s=%s\n' "$key" "$value"
  done > .env

pm2 reload mini-jira
```

### GSI returns no results (all tasks empty)

The GSI may still be backfilling. DynamoDB takes 1–30 minutes depending on data size.

Go to: **DynamoDB → Tables → Tasks → Indexes tab** — wait until all indexes show **Active**.

### Image uploaded but no thumbnail appears

Check: **Lambda → mini-jira-image-resize → Monitor tab** → look for errors.

Most common cause: `sharp` was compiled for the wrong OS. The zip must be built on Linux. Fix using AWS CloudShell:

1. Open **CloudShell** (top menu bar, terminal icon)
2. Run:
```bash
mkdir resize && cd resize
cat > index.mjs << 'EOF'
# paste your image-resize/index.mjs content here
EOF
npm init -y
npm install sharp @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/client-s3
zip -r ../image-resize-linux.zip .
```
3. Download the zip from CloudShell (Actions menu → Download file)
4. Upload it to the Lambda

### SQS messages stuck in queue

1. **Lambda → mini-jira-sqs-worker → Monitor** → look for errors
2. **SQS → TaskAssignmentsQueue-DLQ** → messages here = worker Lambda is failing repeatedly
3. Most common fix: check environment variables in the Lambda (especially `DYNAMODB_ACTIVITY_LOGS_TABLE`)

### Cognito user cannot log in

- Check user status in **Cognito → Users** → must be **Confirmed**
- If status is `FORCE_CHANGE_PASSWORD`: sign in through the app — it will prompt for a new password
- Verify `custom:role` and `custom:teamId` attributes are set

### CloudFront serving stale content after backend update

Go to: **CloudFront → your distribution → Invalidations tab → Create invalidation**
- Object paths: `/*`
- Click **Create invalidation**

---

## 22. Quick Reference Card

Fill in as you go. Keep this handy on demo day.

```
REGION:                eu-north-1
ACCOUNT_ID:            ________________________________

─── Cognito ──────────────────────────────────────────
User Pool ID:          ________________________________
App Client ID:         ________________________________

─── S3 Buckets ───────────────────────────────────────
Originals:             mini-jira-originals-_______-2026
Resized:               mini-jira-resized-_________-2026
Frontend:              mini-jira-frontend-________-2026

─── SNS ARNs ─────────────────────────────────────────
TaskAssignmentsTopic:  arn:aws:sns:eu-north-1:ACCT:TaskAssignmentsTopic
DailyDigestTopic:      arn:aws:sns:eu-north-1:ACCT:DailyDigestTopic

─── SQS ──────────────────────────────────────────────
Queue URL:             https://sqs.eu-north-1.amazonaws.com/ACCT/TaskAssignmentsQueue
DLQ ARN:               arn:aws:sqs:eu-north-1:ACCT:TaskAssignmentsQueue-DLQ

─── EC2 ──────────────────────────────────────────────
Instance ID:           i-________________________________
Public IP:             ________________________________
Key pair file:         ~/Downloads/mini-jira-key.pem

─── CloudFront ───────────────────────────────────────
Distribution ID:       ________________________________
Public URL:            https://_________________.cloudfront.net

─── Demo Users ───────────────────────────────────────
Manager:   manager@minijira.com  /  ________________
Alice:     alice@minijira.com    /  ________________
Bob:       bob@minijira.com      /  ________________
```
