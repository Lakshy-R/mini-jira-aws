# Mini-Jira on AWS — Deployment Guide

> **Architecture**: VPC with public/private subnets across 2 AZs · NAT Gateway · Application Load Balancer · Auto Scaling Group (2 EC2 instances) · CloudFront in front of ALB · DynamoDB · S3 · Lambda · SNS · SQS · EventBridge · CloudWatch
>
> Everything below is done from the **AWS Console** — no CDK or CLI required (except one SSH/Session Manager session to verify EC2).

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Architecture Overview](#2-architecture-overview)
3. [VPC, Subnets, NAT Gateway](#3-vpc-subnets-nat-gateway)
4. [DynamoDB Tables & GSIs](#4-dynamodb-tables--gsis)
5. [Cognito User Pool](#5-cognito-user-pool)
6. [S3 Buckets](#6-s3-buckets)
7. [SNS Topics](#7-sns-topics)
8. [SQS Queue & DLQ](#8-sqs-queue--dlq)
9. [SNS → SQS Subscription](#9-sns--sqs-subscription)
10. [IAM Roles](#10-iam-roles)
11. [SSM Parameter Store](#11-ssm-parameter-store)
12. [Lambda Functions](#12-lambda-functions)
13. [EventBridge Rule](#13-eventbridge-rule)
14. [Security Groups](#14-security-groups)
15. [Application Load Balancer & Target Group](#15-application-load-balancer--target-group)
16. [Launch Template & Auto Scaling Group](#16-launch-template--auto-scaling-group)
17. [CloudFront Distribution](#17-cloudfront-distribution)
18. [Update SSM with CloudFront URL](#18-update-ssm-with-cloudfront-url)
19. [CloudWatch Dashboard](#19-cloudwatch-dashboard)
20. [CloudWatch Alarms](#20-cloudwatch-alarms)
21. [Demo User Setup](#21-demo-user-setup)
22. [Verification Checklist](#22-verification-checklist)
23. [Demo Day Script](#23-demo-day-script)
24. [Troubleshooting](#24-troubleshooting)
25. [Quick Reference Card](#25-quick-reference-card)

---

## 1. Prerequisites

- **AWS Account** — confirm Free Tier status at **Console → Billing → Free Tier**
- **Region**: use one region for everything. Recommended: `eu-north-1` (Stockholm)
- **Node.js 20+** on your local machine (to zip Lambdas)
- **Git** on your local machine

> Every time you open a new AWS Console page, confirm the **region dropdown** (top-right) matches your chosen region before creating anything.

> **Cost note**: This architecture matches the assignment requirements exactly. Two EC2 t3.micro instances exceed the free-tier 750-hour limit, and one NAT Gateway costs ~$0.045/hr (~$32/month). Stop all instances when not in use.

---

## 2. Architecture Overview

```
Browser
  │
  ▼
CloudFront  (HTTPS — CDN, global PoPs)
  │
  ▼
Application Load Balancer  (internet-facing — public subnets AZ-a, AZ-b)
  │
  ▼
Auto Scaling Group  (min 2, target 2 — private subnets AZ-a, AZ-b)
  │  EC2-a (AZ-a)    EC2-b (AZ-b)
  │       ↘  ↙
  │   Node.js + PM2
  │   Serves: React frontend (/) + REST API (/api/*)
  │
  │   outbound via NAT Gateway (public subnet AZ-a)
  ▼
AWS Services (all accessed from private EC2s via NAT/VPC endpoints)
  ├── DynamoDB    Tasks, Comments, Projects, ActivityLogs
  ├── S3          task images (originals + resized buckets)
  ├── Cognito     JWT authentication
  ├── SNS         task-assignment fan-out + daily digest
  ├── SQS         assignment events queue
  ├── SSM         secrets fetched at EC2 boot
  └── CloudWatch  custom metrics + dashboard + alarms

Lambdas (event-driven — not in VPC):
  image-resize      ← S3 PUT on originals bucket
  assignment-worker ← SQS trigger (drains TaskAssignmentsQueue)
  daily-digest      ← EventBridge 9:00 AM cron
```

### IP / CIDR Plan

| Resource | CIDR |
|---|---|
| VPC | `10.0.0.0/16` |
| Public Subnet AZ-a | `10.0.1.0/24` |
| Public Subnet AZ-b | `10.0.2.0/24` |
| Private Subnet AZ-a | `10.0.11.0/24` |
| Private Subnet AZ-b | `10.0.12.0/24` |

---

## 3. VPC, Subnets, NAT Gateway

### 3a. Create the VPC

Go to: **VPC → Your VPCs → Create VPC**

| Field | Value |
|---|---|
| Resources to create | **VPC only** |
| Name tag | `mini-jira-vpc` |
| IPv4 CIDR | `10.0.0.0/16` |
| Tenancy | Default |

Click **Create VPC**.

### 3b. Create an Internet Gateway

Go to: **VPC → Internet gateways → Create internet gateway**

| Field | Value |
|---|---|
| Name tag | `mini-jira-igw` |

Click **Create internet gateway** → then **Actions → Attach to VPC** → select `mini-jira-vpc` → **Attach internet gateway**.

### 3c. Create the Four Subnets

Go to: **VPC → Subnets → Create subnet**

Select VPC: `mini-jira-vpc`. Then add all four subnets in one create operation (click **Add new subnet** after each):

| Subnet name | Availability Zone | IPv4 CIDR |
|---|---|---|
| `mini-jira-public-a` | AZ ending in `a` (e.g. `eu-north-1a`) | `10.0.1.0/24` |
| `mini-jira-public-b` | AZ ending in `b` (e.g. `eu-north-1b`) | `10.0.2.0/24` |
| `mini-jira-private-a` | `eu-north-1a` | `10.0.11.0/24` |
| `mini-jira-private-b` | `eu-north-1b` | `10.0.12.0/24` |

Click **Create subnet**.

**Enable auto-assign public IP on the two public subnets:**
- Select `mini-jira-public-a` → **Actions → Edit subnet settings** → check **Enable auto-assign public IPv4 address** → **Save**
- Repeat for `mini-jira-public-b`

### 3d. Create a NAT Gateway

> The NAT Gateway goes in a **public** subnet. It lets the private EC2 instances reach the internet (to clone GitHub, call AWS APIs) without having a public IP themselves.

Go to: **VPC → NAT gateways → Create NAT gateway**

| Field | Value |
|---|---|
| Name | `mini-jira-nat` |
| Subnet | `mini-jira-public-a` |
| Connectivity type | **Public** |
| Elastic IP allocation | Click **Allocate Elastic IP** |

Click **Create NAT gateway**. Wait until **State** shows **Available** (1-2 minutes).

### 3e. Create Route Tables

**Public Route Table** (for ALB and NAT GW):

Go to: **VPC → Route tables → Create route table**

| Field | Value |
|---|---|
| Name | `mini-jira-rt-public` |
| VPC | `mini-jira-vpc` |

Click **Create route table**.

- **Routes tab → Edit routes → Add route**:
  - Destination: `0.0.0.0/0` | Target: **Internet Gateway** → `mini-jira-igw` → **Save changes**
- **Subnet associations tab → Edit subnet associations**:
  - Select `mini-jira-public-a` and `mini-jira-public-b` → **Save associations**

**Private Route Table** (for EC2 instances):

Create another route table:

| Field | Value |
|---|---|
| Name | `mini-jira-rt-private` |
| VPC | `mini-jira-vpc` |

- **Routes tab → Edit routes → Add route**:
  - Destination: `0.0.0.0/0` | Target: **NAT Gateway** → `mini-jira-nat` → **Save changes**
- **Subnet associations tab → Edit subnet associations**:
  - Select `mini-jira-private-a` and `mini-jira-private-b` → **Save associations**

---

## 4. DynamoDB Tables & GSIs

Go to: **DynamoDB → Tables → Create table**

### 4a. Tasks Table

| Field | Value |
|---|---|
| Table name | `Tasks` |
| Partition key | `taskId` (String) |
| Sort key | *(leave blank)* |
| Table settings | **Customize settings** |
| Capacity mode | **On-demand** |

Click **Create table**. Wait for **Active**.

**Add 3 GSIs** — click `Tasks` → **Indexes tab → Create index** (wait for Active between each):

**GSI 1 — employee team queries:**

| Field | Value |
|---|---|
| Partition key | `teamId` (String) |
| Sort key | `createdAt` (String) |
| Index name | `teamId-createdAt-index` |
| Attribute projections | **All** |

**GSI 2 — manager all-tasks query:**

| Field | Value |
|---|---|
| Partition key | `entity` (String) |
| Sort key | `createdAt` (String) |
| Index name | `entity-createdAt-index` |
| Attribute projections | **All** |

**GSI 3 — assignee queries (daily digest Lambda):**

| Field | Value |
|---|---|
| Partition key | `assigneeId` (String) |
| Sort key | `createdAt` (String) |
| Index name | `assigneeId-createdAt-index` |
| Attribute projections | **All** |

### 4b. Comments Table

| Field | Value |
|---|---|
| Table name | `Comments` |
| Partition key | `commentId` (String) |
| Capacity mode | **On-demand** |

**GSI:**

| Partition key | Sort key | Index name |
|---|---|---|
| `taskId` (String) | `createdAt` (String) | `taskId-index` |

### 4c. Projects Table

| Field | Value |
|---|---|
| Table name | `Projects` |
| Partition key | `projectId` (String) |
| Capacity mode | **On-demand** |

**GSI:**

| Partition key | Sort key | Index name |
|---|---|---|
| `teamId` (String) | `createdAt` (String) | `teamId-createdAt-index` |

### 4d. ActivityLogs Table

| Field | Value |
|---|---|
| Table name | `ActivityLogs` |
| Partition key | `logId` (String) |
| Capacity mode | **On-demand** |

**Enable TTL** (auto-deletes old logs): After table is Active → **Additional settings tab → Time to live (TTL) → Manage TTL** → attribute name: `expiresAt` → **Save**.

**GSI:**

| Partition key | Sort key | Index name |
|---|---|---|
| `taskId` (String) | `timestamp` (String) | `taskId-timestamp-index` |

---

## 5. Cognito User Pool

Go to: **Cognito → User pools → Create user pool**

**Step 1 — Sign-in experience**
- Sign-in options: **Email**

**Step 2 — Security requirements**
- Password policy: **Cognito defaults**
- MFA: **No MFA**

**Step 3 — Sign-up experience**
- Self-registration: **Enable**
- Required attributes: `email`
- Custom attributes → **Add custom attribute** twice:
  - Name: `role` · Type: String
  - Name: `teamId` · Type: String

**Step 4 — Message delivery**
- Email provider: **Send email with Cognito**

**Step 5 — Integrate your app**
- User pool name: `mini-jira-pool`
- Uncheck **"Use the Cognito Hosted UI"**
- App client name: `mini-jira-client`
- Client secret: **Don't generate a client secret**
- Authentication flows — check both:
  - `ALLOW_USER_PASSWORD_AUTH`
  - `ALLOW_REFRESH_TOKEN_AUTH`

**Step 6 — Review and create**

**Save these two values** (needed in step 11):
- **User Pool ID** — format: `eu-north-1_xxxxxxxx`
- **App Client ID** — format: `xxxxxxxxxxxxxxxxxxxxxxxxxx`

---

## 6. S3 Buckets

Go to: **S3 → Create bucket**

### 6a. Originals Bucket (user-uploaded images)

| Field | Value |
|---|---|
| Bucket name | `mini-jira-originals-YOURNAME-2026` *(globally unique)* |
| Region | Your region |
| Block all public access | **Checked** (images served via presigned URLs) |

After creating → **Permissions tab → Cross-origin resource sharing (CORS) → Edit** → paste:

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

### 6b. Resized Bucket (Lambda thumbnails)

| Field | Value |
|---|---|
| Bucket name | `mini-jira-resized-YOURNAME-2026` |
| Region | Same |
| Block all public access | **Checked** |

No CORS needed.

---

## 7. SNS Topics

Go to: **SNS → Topics → Create topic**

### 7a. Task Assignments Topic

| Field | Value |
|---|---|
| Type | **Standard** |
| Name | `TaskAssignmentsTopic` |

Click **Create topic**. **Copy and save the ARN.**

**Email subscription** → **Create subscription**:
- Protocol: **Email** · Endpoint: your email address
- Confirm the subscription email in your inbox.

### 7b. Daily Digest Topic

| Field | Value |
|---|---|
| Type | **Standard** |
| Name | `DailyDigestTopic` |

**Save the ARN.** Add and confirm an email subscription.

### 7c. CloudWatch Alerts Topic

| Field | Value |
|---|---|
| Type | **Standard** |
| Name | `mini-jira-alerts` |

**Save the ARN.** Add and confirm an email subscription (can be the same email).

---

## 8. SQS Queue & DLQ

Go to: **SQS → Create queue**

### 8a. Dead Letter Queue — create FIRST

| Field | Value |
|---|---|
| Type | **Standard** |
| Name | `TaskAssignmentsQueue-DLQ` |
| Visibility timeout | 30 seconds |
| Message retention | 14 days |

Click **Create queue**. **Save the ARN.**

### 8b. Main Queue

| Field | Value |
|---|---|
| Type | **Standard** |
| Name | `TaskAssignmentsQueue` |
| Visibility timeout | 30 seconds |
| Message retention | 4 days |

**Dead-letter queue section**:
- Enabled: **Yes**
- Choose queue: `TaskAssignmentsQueue-DLQ`
- Maximum receives: `3`

Click **Create queue**. **Save the ARN and Queue URL.**

---

## 9. SNS → SQS Subscription

**Step 1** — Go to: **SQS → TaskAssignmentsQueue → Subscribe to Amazon SNS topic** → choose `TaskAssignmentsTopic` → **Save**.

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

---

## 10. IAM Roles

### 10a. Lambda Execution Role

Go to: **IAM → Roles → Create role**
- Trusted entity: **AWS service** → **Lambda**

Attach these managed policies:
- `AWSLambdaBasicExecutionRole`
- `AmazonDynamoDBFullAccess`
- `AmazonS3FullAccess`
- `AmazonSNSFullAccess`
- `AmazonSQSFullAccess`
- `CloudWatchFullAccess`

Role name: `mini-jira-lambda-role`

### 10b. EC2 Instance Role

Go to: **IAM → Roles → Create role**
- Trusted entity: **AWS service** → **EC2**

Attach these managed policies:
- `AmazonSSMManagedInstanceCore` *(enables Session Manager — no SSH key needed)*
- `CloudWatchAgentServerPolicy`
- `CloudWatchFullAccess`
- `AmazonDynamoDBFullAccess`
- `AmazonS3FullAccess`
- `AmazonSNSFullAccess`
- `AmazonSQSFullAccess`
- `AmazonCognitoPowerUser`
- `AmazonSSMReadOnlyAccess`

Role name: `mini-jira-ec2-role`

**Create an Instance Profile** — after creating the role, note that when you attach a role to an EC2 launch template, AWS automatically creates an instance profile. No extra steps needed.

---

## 11. SSM Parameter Store

Go to: **Systems Manager → Parameter Store → Create parameter**

Settings for every parameter:
- **Tier**: Standard *(free)*
- **Type**: SecureString

| Parameter Name | Value |
|---|---|
| `/mini-jira/PORT` | `3000` |
| `/mini-jira/NODE_ENV` | `production` |
| `/mini-jira/AWS_REGION` | `eu-north-1` |
| `/mini-jira/COGNITO_USER_POOL_ID` | *(from step 5)* |
| `/mini-jira/COGNITO_CLIENT_ID` | *(from step 5)* |
| `/mini-jira/DYNAMODB_TASKS_TABLE` | `Tasks` |
| `/mini-jira/DYNAMODB_COMMENTS_TABLE` | `Comments` |
| `/mini-jira/DYNAMODB_PROJECTS_TABLE` | `Projects` |
| `/mini-jira/DYNAMODB_ACTIVITY_LOGS_TABLE` | `ActivityLogs` |
| `/mini-jira/S3_ORIGINALS_BUCKET` | `mini-jira-originals-YOURNAME-2026` |
| `/mini-jira/S3_RESIZED_BUCKET` | `mini-jira-resized-YOURNAME-2026` |
| `/mini-jira/SNS_TOPIC_ARN` | *(TaskAssignmentsTopic ARN from step 7a)* |
| `/mini-jira/SNS_DIGEST_TOPIC_ARN` | *(DailyDigestTopic ARN from step 7b)* |
| `/mini-jira/CW_NAMESPACE` | `MiniJira` |
| `/mini-jira/ENV` | `production` |
| `/mini-jira/FRONTEND_URL` | `https://PLACEHOLDER` *(update in step 18 after CloudFront is ready)* |

---

## 12. Lambda Functions

### Package the Lambdas on your local machine

```bash
cd /path/to/mini-jira-aws

# Image resize Lambda
cd lambdas/image-resize
npm install
zip -r ../../image-resize.zip .
cd ../..

# Assignment Worker Lambda (drains SQS → writes ActivityLogs → CloudWatch metric)
cd lambdas/assignment-worker
npm install
zip -r ../../assignment-worker.zip .
cd ../..

# Daily Digest Lambda
cd lambdas/daily-digest
npm install
zip -r ../../daily-digest.zip .
cd ../..
```

> **Windows**: use `Compress-Archive` in PowerShell or 7-Zip. The zip must contain files at its root — not inside a subfolder.

> **sharp on image-resize**: `sharp` includes native binaries. If the Lambda fails with a runtime error, rebuild in CloudShell (see [Troubleshooting](#24-troubleshooting)).

---

### 12a. image-resize Lambda

Go to: **Lambda → Create function → Author from scratch**

| Field | Value |
|---|---|
| Function name | `mini-jira-image-resize` |
| Runtime | **Node.js 20.x** |
| Architecture | x86_64 |
| Execution role | Use existing → `mini-jira-lambda-role` |

**Upload code**: Code tab → **Upload from → .zip file** → select `image-resize.zip` → **Save**

**Environment variables** (Configuration tab → Environment variables → Edit):

| Key | Value |
|---|---|
| `S3_RESIZED_BUCKET` | `mini-jira-resized-YOURNAME-2026` |
| `AWS_REGION` | `eu-north-1` |
| `DYNAMODB_TASKS_TABLE` | `Tasks` |

**General configuration**: Timeout → `0 min 30 sec`

**S3 trigger** (Configuration tab → Triggers → Add trigger):
- Source: **S3**
- Bucket: `mini-jira-originals-YOURNAME-2026`
- Event types: **PUT**
- Prefix: `task-images/`
- Acknowledge the recursive warning → **Add**

---

### 12b. assignment-worker Lambda

Go to: **Lambda → Create function → Author from scratch**

| Field | Value |
|---|---|
| Function name | `mini-jira-assignment-worker` |
| Runtime | **Node.js 20.x** |
| Execution role | `mini-jira-lambda-role` |

Upload `assignment-worker.zip`.

**Environment variables:**

| Key | Value |
|---|---|
| `DYNAMODB_ACTIVITY_LOGS_TABLE` | `ActivityLogs` |
| `AWS_REGION` | `eu-north-1` |

**SQS trigger** (Configuration tab → Triggers → Add trigger):
- Source: **SQS**
- SQS queue: `TaskAssignmentsQueue`
- Batch size: `1`
- Click **Add**

---

### 12c. daily-digest Lambda

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
| `SNS_DIGEST_TOPIC_ARN` | *(DailyDigestTopic ARN from step 7b)* |
| `AWS_REGION` | `eu-north-1` |
| `ENV` | `production` |

**General configuration**: Timeout → `1 min 0 sec`

---

## 13. EventBridge Rule

Go to: **EventBridge → Rules → Create rule**

| Field | Value |
|---|---|
| Name | `mini-jira-daily-digest` |
| Event bus | **default** |
| Rule type | **Schedule** |

**Schedule pattern**:
- Select **A fine-grained schedule (cron expression)**
- Cron expression: `0 9 * * ? *`  *(runs at 09:00 UTC every day)*

**Target**:
- Target types: **AWS service**
- Select a target: **Lambda function**
- Function: `mini-jira-daily-digest`

Click **Next → Next → Create rule**.

---

## 14. Security Groups

### 14a. ALB Security Group

Go to: **EC2 → Security Groups → Create security group**

| Field | Value |
|---|---|
| Name | `mini-jira-alb-sg` |
| Description | Mini-Jira ALB |
| VPC | `mini-jira-vpc` |

**Inbound rules:**

| Type | Port | Source | Description |
|---|---|---|---|
| HTTP | 80 | `0.0.0.0/0` | HTTP from internet |
| HTTPS | 443 | `0.0.0.0/0` | HTTPS from internet |

Click **Create security group**.

### 14b. EC2 Security Group

Go to: **EC2 → Security Groups → Create security group**

| Field | Value |
|---|---|
| Name | `mini-jira-ec2-sg` |
| Description | Mini-Jira EC2 backend |
| VPC | `mini-jira-vpc` |

**Inbound rules:**

| Type | Port | Source | Description |
|---|---|---|---|
| Custom TCP | 3000 | **`mini-jira-alb-sg`** (select the security group, not 0.0.0.0/0) | Node.js API — from ALB only |

> **Important**: setting the source to the ALB security group means EC2 instances can only be reached through the ALB, not directly from the internet.

Click **Create security group**.

---

## 15. Application Load Balancer & Target Group

### 15a. Create the Target Group

Go to: **EC2 → Target Groups → Create target group**

| Field | Value |
|---|---|
| Target type | **Instances** |
| Target group name | `mini-jira-tg` |
| Protocol | **HTTP** |
| Port | **3000** |
| VPC | `mini-jira-vpc` |
| Health check protocol | HTTP |
| Health check path | `/api/health` |
| Healthy threshold | 2 |
| Unhealthy threshold | 3 |
| Timeout | 5 seconds |
| Interval | 30 seconds |

Click **Next → Create target group**. *(Leave targets blank — the ASG will register them automatically.)*

### 15b. Create the Application Load Balancer

Go to: **EC2 → Load Balancers → Create load balancer → Application Load Balancer**

| Field | Value |
|---|---|
| Name | `mini-jira-alb` |
| Scheme | **Internet-facing** |
| IP address type | IPv4 |
| VPC | `mini-jira-vpc` |
| Mappings | Select **both AZs** → choose `mini-jira-public-a` for AZ-a, `mini-jira-public-b` for AZ-b |
| Security groups | Remove default → select `mini-jira-alb-sg` |

**Listeners and routing:**
- Protocol: **HTTP** · Port: **80** · Default action: **Forward** → `mini-jira-tg`

Click **Create load balancer**.

**Save the ALB DNS name** shown on the load balancer detail page — it looks like `mini-jira-alb-xxxxxxxxxx.eu-north-1.elb.amazonaws.com`.

---

## 16. Launch Template & Auto Scaling Group

### 16a. Create the Launch Template

Go to: **EC2 → Launch Templates → Create launch template**

| Field | Value |
|---|---|
| Name | `mini-jira-lt` |
| Template version description | `v1` |
| AMI | **Amazon Linux 2023 AMI** (search "Amazon Linux 2023" — choose the latest Free tier eligible one) |
| Instance type | `t3.micro` |
| Key pair | Create new: `mini-jira-key` (RSA, .pem) — download and keep safe |
| Security groups | `mini-jira-ec2-sg` |

**Advanced details:**
- IAM instance profile: `mini-jira-ec2-role`
- User data — paste the full script below:

```bash
#!/bin/bash
set -euo pipefail
exec > >(tee /var/log/userdata.log | logger -t userdata) 2>&1

REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)
APP_DIR="/home/ec2-user/mini-jira-aws"
REPO_URL="https://github.com/MahmoudGhoraba/mini-jira-aws.git"
BRANCH="master"

echo "=== [1/8] System update ==="
dnf update -y

echo "=== [2/8] Install Node.js 20 ==="
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs git
node --version && npm --version

echo "=== [3/8] Install PM2 ==="
npm install -g pm2

echo "=== [4/8] Clone repository ==="
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR" && git fetch origin && git reset --hard "origin/$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

echo "=== [5/8] Fetch config from SSM Parameter Store ==="
ENV_FILE="$APP_DIR/backend/.env"
aws ssm get-parameters-by-path \
  --path "/mini-jira/" \
  --with-decryption \
  --region "$REGION" \
  --query "Parameters[*].[Name,Value]" \
  --output text | awk '{
    split($1, parts, "/");
    key = parts[length(parts)];
    val = $0; sub("^" $1 "\t", "", val);
    print key "=" val
  }' > "$ENV_FILE"

cat >> "$ENV_FILE" <<EOF
PORT=3000
NODE_ENV=production
AWS_REGION=$REGION
EOF

echo "Config written ($( wc -l < "$ENV_FILE" ) entries)"

echo "=== [6/8] Build React frontend ==="
cd "$APP_DIR/frontend"
npm ci
npm run build
echo "Frontend built — $(du -sh dist | cut -f1)"

echo "=== [7/8] Install backend dependencies ==="
cd "$APP_DIR/backend"
npm ci --omit=dev

echo "=== [8/8] Start with PM2 ==="
pm2 delete backend 2>/dev/null || true
pm2 start server.js \
  --name backend \
  --instances 2 \
  --exec-mode cluster \
  --max-memory-restart 400M \
  --log /var/log/mini-jira-backend.log \
  --error /var/log/mini-jira-backend-error.log
pm2 startup systemd -u ec2-user --hp /home/ec2-user
pm2 save

echo "=== Bootstrap complete. Backend + frontend running on :3000 ==="
pm2 status
```

Click **Create launch template**.

### 16b. Create the Auto Scaling Group

Go to: **EC2 → Auto Scaling Groups → Create Auto Scaling group**

**Step 1 — Choose launch template**
- Name: `mini-jira-asg`
- Launch template: `mini-jira-lt` (latest version)

**Step 2 — Choose instance launch options**
- VPC: `mini-jira-vpc`
- Availability Zones and subnets: select **both private subnets**
  - `mini-jira-private-a`
  - `mini-jira-private-b`

**Step 3 — Configure advanced options**
- Load balancing: **Attach to an existing load balancer**
- Choose from your load balancer target groups: `mini-jira-tg`
- Health checks: check **Turn on Elastic Load Balancing health checks**
- Health check grace period: `300` seconds

**Step 4 — Configure group size and scaling**
- Desired capacity: **2**
- Minimum capacity: **2**
- Maximum capacity: **4**
- Scaling policies: **None** *(simple fixed-size for demo)*

**Step 5 — Add notifications** — skip

**Step 6 — Add tags**

| Key | Value |
|---|---|
| `Name` | `mini-jira-backend` |

**Step 7 — Review → Create Auto Scaling group**

The ASG will now launch 2 EC2 instances (one per AZ) in the private subnets. Go to **EC2 → Instances** and wait until both show **Running** and **2/2 checks passed** (takes ~5 minutes for user data to complete).

**Verify the Target Group is healthy:**

Go to: **EC2 → Target Groups → mini-jira-tg → Targets tab**

Wait until both targets show **Healthy**. If they show **Unhealthy**:
- The user data script is still running — wait another 3 minutes
- Check the instance logs: **EC2 → Instances → select instance → Actions → Monitor and troubleshoot → Get system log**

---

## 17. CloudFront Distribution

Go to: **CloudFront → Create distribution**

**Origin:**

| Field | Value |
|---|---|
| Origin domain | Paste your **ALB DNS name** (from step 15b) — do NOT pick from the dropdown |
| Protocol | **HTTP only** |
| HTTP port | `80` |
| Name | `alb-origin` |

**Default cache behavior:**

| Field | Value |
|---|---|
| Viewer protocol policy | **Redirect HTTP to HTTPS** |
| Allowed HTTP methods | **GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE** |
| Cache policy | **CachingDisabled** |
| Origin request policy | **AllViewer** |

> CachingDisabled is correct — the backend serves both the API and the React SPA. Caching the SPA through CloudFront at the CDN level is not needed since the app is already built and served as static files from EC2.

**Settings:**

| Field | Value |
|---|---|
| Price class | **Use only North America and Europe** |
| Default root object | *(leave blank)* |

Click **Create distribution**.

Wait until status changes from **Deploying** to **Enabled** (~5 minutes).

**Save the Distribution domain name** — looks like `dxxxxxxxxxxxx.cloudfront.net`.

**Test:**
Open `https://dxxxxxxxxxxxx.cloudfront.net/api/health` — must return `{"status":"ok"}`.
Open `https://dxxxxxxxxxxxx.cloudfront.net` — must open the login page.

---

## 18. Update SSM with CloudFront URL

Now that you have the CloudFront domain, update the placeholder you set in step 11.

Go to: **Systems Manager → Parameter Store → `/mini-jira/FRONTEND_URL` → Edit**
- Value: `https://dxxxxxxxxxxxx.cloudfront.net`
- Click **Save changes**

**Force both EC2 instances to reload the updated config:**

Go to: **EC2 → Instances** → connect to each instance via **Session Manager**:

```bash
sudo su - ec2-user
cd /home/ec2-user/mini-jira-aws/backend

REGION=eu-north-1
aws ssm get-parameters-by-path \
  --path "/mini-jira/" \
  --with-decryption \
  --region "$REGION" \
  --query "Parameters[*].[Name,Value]" \
  --output text | awk '{
    split($1, parts, "/");
    key = parts[length(parts)];
    val = $0; sub("^" $1 "\t", "", val);
    print key "=" val
  }' > .env

cat >> .env <<'EOF'
PORT=3000
NODE_ENV=production
EOF

pm2 reload backend
pm2 logs backend --lines 10
```

Repeat on the second instance.

---

## 19. CloudWatch Dashboard

The assignment requires a dashboard with **four widgets**: tasks created per day, tasks closed per day per team, average time-to-close, and EC2 CPU utilization.

Go to: **CloudWatch → Dashboards → Create dashboard**
- Dashboard name: `MiniJira-Dashboard`
- Click **Create dashboard**

Add each widget using **Add widget → Line** (or **Number** for single-value metrics):

### Widget 1 — Tasks Created Per Day

- Click **Add widget** → **Line**
- **Browse** tab → **MiniJira/Tasks** namespace → select `TaskCreated` metric
- Period: **1 Day**
- Statistic: **Sum**
- Title: `Tasks Created Per Day`
- Click **Create widget**

### Widget 2 — Tasks Closed Per Day Per Team

- **Add widget** → **Line**
- **MiniJira/Tasks** namespace → select `TaskClosed` metric
- Group by dimension: `TeamId`
- Period: **1 Day** · Statistic: **Sum**
- Title: `Tasks Closed Per Day Per Team`

### Widget 3 — Average Time to Close (minutes)

- **Add widget** → **Number**
- **MiniJira/Tasks** namespace → select `TimeToCloseMs` metric
- Period: **1 Day** · Statistic: **Average**
- Title: `Avg Time to Close (ms)`

> The `TimeToCloseMs` metric is emitted by the backend whenever a task moves to DONE status.

### Widget 4 — EC2 CPU Utilization

- **Add widget** → **Line**
- **EC2 → Per-Instance Metrics** → search your ASG instances → select **CPUUtilization** for both instances
- Period: **5 Minutes** · Statistic: **Average**
- Title: `EC2 CPU Utilization`

Click **Save dashboard**.

---

## 20. CloudWatch Alarms

Go to: **CloudWatch → Alarms → All alarms → Create alarm**

### Alarm 1 — Overdue Tasks Threshold

- Click **Select metric → MiniJira/Tasks → OverdueTasks → Select metric**
- Period: **1 Day**
- Threshold: **Greater than** `5`
- Notification: select the `mini-jira-alerts` SNS topic (from step 7c)
- Alarm name: `mini-jira-overdue-tasks`
- Click **Create alarm**

### Alarm 2 — EC2 High CPU

- **Select metric → EC2 → Per-Instance Metrics** → search your instance IDs → select **CPUUtilization** for one instance → **Select metric**
- Period: **5 minutes**
- Threshold: **Greater than** `80`
- Notification: `mini-jira-alerts` topic
- Alarm name: `mini-jira-high-cpu`

### Alarm 3 — ALB 5xx Errors

- **Select metric → ApplicationELB → Per AppELB Metrics** → find `mini-jira-alb` → select **HTTPCode_ELB_5XX_Count** → **Select metric**
- Period: **5 minutes**
- Threshold: **Greater than** `0`
- Notification: `mini-jira-alerts` topic
- Alarm name: `mini-jira-alb-5xx`

---

## 21. Demo User Setup

The assignment requires this exact scenario: **Manager Ali**, **Sara** on the Frontend team, **Omar** on the Backend team.

Go to: **Cognito → User pools → mini-jira-pool → Users → Create user**

### Manager — Ali

| Field | Value |
|---|---|
| Invitation | Don't send invitation |
| Email address | `ali@minijira.com` |
| Email address verified | **Check** |
| Temporary password | `Ali@Manager2026!` |

After creating, click the user → **Edit** to add custom attributes:
- `custom:role` = `manager`
- `custom:teamId` = *(leave blank or set to `all`)*

> **Set permanent password**: In the app, log in as Ali — it will prompt for a new password. Set it to `Ali@Manager2026!` again or something you'll remember. Or in the Console: **Actions → Reset password** and follow the flow.

### Employee — Sara (Frontend team)

| Field | Value |
|---|---|
| Email address | `sara@minijira.com` |
| Email address verified | **Check** |
| Temporary password | `Sara@Employee2026!` |

Custom attributes:
- `custom:role` = `employee`
- `custom:teamId` = `frontend`

### Employee — Omar (Backend team)

| Field | Value |
|---|---|
| Email address | `omar@minijira.com` |
| Email address verified | **Check** |
| Temporary password | `Omar@Employee2026!` |

Custom attributes:
- `custom:role` = `employee`
- `custom:teamId` = `backend`

> After creating all three users, sign in through the live app for each one and complete the mandatory password change (Cognito's `FORCE_CHANGE_PASSWORD` flow). Each will be asked to set a new permanent password on first login.

> **TeamId values must match exactly**: when Manager Ali creates a task and selects a team, the `teamId` sent to the backend must exactly match the `custom:teamId` in Cognito. If Sara's `custom:teamId` is `frontend`, the task must also have `teamId = "frontend"`.

---

## 22. Verification Checklist

Work through this before demo day.

### Networking
- [ ] VPC `mini-jira-vpc` exists with 4 subnets (2 public, 2 private)
- [ ] NAT Gateway state: **Available**
- [ ] Both private subnet route tables route `0.0.0.0/0` → NAT Gateway
- [ ] Both public subnet route tables route `0.0.0.0/0` → Internet Gateway

### Compute
- [ ] Both EC2 instances: state **Running**, status checks **2/2 passed**
- [ ] ALB state: **Active**
- [ ] Both targets in `mini-jira-tg`: **Healthy**
- [ ] `curl http://mini-jira-alb-xxx.elb.amazonaws.com/api/health` returns `{"status":"ok"}`

### Application
- [ ] `https://YOUR_CF_DOMAIN/api/health` returns `{"status":"ok"}`
- [ ] `https://YOUR_CF_DOMAIN` opens the login page

### Data
- [ ] All 4 DynamoDB tables: **Active**
- [ ] All GSIs on Tasks table: **Active** (not Backfilling)
- [ ] Both S3 buckets exist
- [ ] All 16 SSM parameters exist under `/mini-jira/`
- [ ] `/mini-jira/FRONTEND_URL` = your CloudFront URL (not the placeholder)

### Event-driven services
- [ ] All 3 Lambda functions: code uploaded (check **Last modified**)
- [ ] `mini-jira-image-resize` has S3 trigger on originals bucket
- [ ] `mini-jira-assignment-worker` has SQS trigger on `TaskAssignmentsQueue`
- [ ] `mini-jira-daily-digest` has EventBridge trigger
- [ ] EventBridge rule `mini-jira-daily-digest` is **Enabled**

### Monitoring
- [ ] CloudWatch dashboard `MiniJira-Dashboard` has 4 widgets
- [ ] All 3 alarms exist in **OK** state
- [ ] All 3 SNS topics have confirmed email subscriptions

### Demo scenario
- [ ] Log in as Ali → board loads with zero tasks
- [ ] Ali creates Task A → assigns to Sara (frontend team) with image → Task A appears on board
- [ ] Ali creates Task B → assigns to Omar (backend team) → Task B appears
- [ ] Log out → log in as Sara → only Task A visible
- [ ] Log out → log in as Omar → only Task B visible
- [ ] Log in as Ali → both tasks visible → team filter works

---

## 23. Demo Day Script

Walk through these scenes in order. Each one showcases a different AWS service.

### Scene 1 — Authentication (Cognito)
Open `https://YOUR_CF_DOMAIN`. Log in as **Ali**.
> *"Cognito issues a JWT ID token. The `custom:role` and `custom:teamId` claims inside it are read by the backend on every request using `aws-jwt-verify` — the token signature is verified against Cognito's public JWKS. No database call needed for auth."*

### Scene 2 — High Availability (VPC + ALB + ASG)
Open **EC2 → Load Balancers → mini-jira-alb → Monitoring tab**. Show requests hitting both targets.
> *"The app runs on two EC2 instances in separate Availability Zones — eu-north-1a and eu-north-1b — behind an Application Load Balancer. The ALB is in public subnets; the EC2 instances are in private subnets and reach the internet only through the NAT Gateway. If one AZ goes down the other keeps serving traffic."*

### Scene 3 — Create Project (DynamoDB)
Projects page → **New Project** → fill in, select a team → **Create**.
> *"Stored in DynamoDB with PAY_PER_REQUEST billing. A `teamId-createdAt-index` GSI lets the backend query projects by team in O(log n) without a full scan."*

### Scene 4 — Create Task with Image Upload (S3 + Lambda)
Dashboard → **New Task** → fill all fields → attach a photo → assign to Sara (Frontend team) → **Create**.
- Open **S3 → originals bucket** → show the file under `task-images/`
- Wait 10 seconds → open **S3 → resized bucket** → show the thumbnail
> *"The S3 PUT event triggers the image-resize Lambda. It uses the `sharp` library to produce a 400×400 JPEG thumbnail and saves it to the resized bucket. The task card fetches it via a presigned URL — no public bucket needed."*

### Scene 5 — Task Assignment (SNS + SQS + Lambda + ActivityLogs)
Open the task detail → create a second task assigned to **Omar** (Backend team).
- Open **SQS → TaskAssignmentsQueue → Monitoring tab** → show messages received and deleted
- Show email inbox → assignment notification email
- Open **DynamoDB → ActivityLogs → Explore items** → show the `TASK_ASSIGNMENT` entry
> *"One `SNS.publish()` call fans out to two subscribers: an email endpoint (assigns notifies the employee) and an SQS queue. The assignment-worker Lambda drains the queue, writes to ActivityLogs, and publishes a `TasksAssignedPerTeam` custom metric to CloudWatch."*

### Scene 6 — Team Isolation (Server-side enforcement)
Log out → log in as **Sara**. Show only Task A.
Log out → log in as **Omar**. Show only Task B.
> *"The `teamId` in Sara's JWT is compared in the service layer before the DynamoDB query. The query itself uses the `teamId-createdAt-index` GSI — Sara's request never reads Backend team data at the database level. The backend returns 403 even if an employee guesses a task ID from another team."*

### Scene 7 — Kanban Drag & Drop (DynamoDB UpdateItem)
Log back in as Ali. Drag Task A from **To Do** to **In Progress**.
Open **DynamoDB → Tasks → Explore items** → find the task → show `status` updated.
> *"Each drag calls `PATCH /api/tasks/:id/status`. The backend runs a DynamoDB `UpdateItem` with a condition expression and writes a `STATUS_CHANGED` audit entry to ActivityLogs."*

### Scene 8 — Task Edit
Click a task → pencil icon → edit title, priority, deadline → **Save changes**.
> *"Full task editing — title, description, priority, assignee, deadline — via `PATCH /api/tasks/:id`. Manager-only."*

### Scene 9 — Audit Trail
In browser visit: `https://YOUR_CF_DOMAIN/api/tasks/TASK_ID/history`
Show the JSON: TASK_CREATED → TASK_ASSIGNMENT → STATUS_CHANGED entries.

### Scene 10 — Daily Digest Lambda (EventBridge + CloudWatch)
**Lambda → mini-jira-daily-digest → Test** → create empty event `{}` → **Invoke**.
Check email for digest. Then **CloudWatch → Metrics → MiniJira/Tasks** → show `OverdueTasks` metric.
> *"EventBridge triggers this at 9:00 AM UTC daily. It does a paginated DynamoDB scan, groups overdue tasks by assignee, and sends one digest email per person via SNS."*

### Scene 11 — CloudWatch Monitoring
Open **CloudWatch → Dashboards → MiniJira-Dashboard**.
Walk through all 4 widgets: tasks created, tasks closed per team, avg time-to-close, EC2 CPU.
Open **CloudWatch → Alarms** — show all alarms in OK state.
> *"Custom metrics go to the `MiniJira/Tasks` namespace. Three alarms — overdue tasks, high CPU, and ALB 5xx — all publish to an SNS topic that sends an alert email."*

---

## 24. Troubleshooting

### Targets show Unhealthy in the target group

1. **EC2 → Instances** → confirm both instances are **Running**
2. Connect via **Session Manager** → `pm2 list` → is `backend` **online**?
3. `pm2 logs backend --lines 50` → read errors
4. `curl http://localhost:3000/api/health` → does it respond locally?
5. If not: `cat /home/ec2-user/mini-jira-aws/backend/.env` → check SSM fetch succeeded
6. Check the instance's security group allows port 3000 from `mini-jira-alb-sg`

### CloudFront returns 502 Bad Gateway

1. Confirm ALB DNS name is correct in the CloudFront origin (not EC2 IP)
2. Confirm ALB security group allows HTTP:80 from `0.0.0.0/0`
3. Test directly: `curl http://YOUR_ALB_DNS/api/health`
4. If ALB responds but CloudFront doesn't: wait 5 more minutes for CloudFront to propagate

### `.env` on EC2 missing variables

SSM fetch may have run before the instance role propagated. Fix manually:

```bash
# On EC2 via Session Manager
sudo su - ec2-user
cd /home/ec2-user/mini-jira-aws/backend
REGION=eu-north-1
aws ssm get-parameters-by-path \
  --path "/mini-jira/" \
  --with-decryption \
  --region "$REGION" \
  --query "Parameters[*].[Name,Value]" \
  --output text | awk '{
    split($1, parts, "/");
    key = parts[length(parts)];
    val = $0; sub("^" $1 "\t", "", val);
    print key "=" val
  }' > .env
echo "PORT=3000" >> .env
echo "NODE_ENV=production" >> .env
pm2 reload backend
```

### Image uploaded but no thumbnail in resized bucket

Check: **Lambda → mini-jira-image-resize → Monitor tab** → look for errors.

Most common cause: `sharp` compiled for wrong OS. Rebuild in CloudShell:

1. Open **CloudShell** (terminal icon in the top menu bar)
2. Run:

```bash
mkdir resize-rebuild && cd resize-rebuild
# Upload your index.js here via CloudShell Actions → Upload file
npm init -y && npm install sharp @aws-sdk/client-s3 @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
zip -r ../image-resize-linux.zip .
```

3. **CloudShell Actions → Download file** → `image-resize-linux.zip`
4. Upload to the Lambda

### SQS messages stuck / going to DLQ

1. **Lambda → mini-jira-assignment-worker → Monitor** → look for invocation errors
2. **SQS → TaskAssignmentsQueue-DLQ** → if messages are here, the worker Lambda is failing
3. Most common: wrong `DYNAMODB_ACTIVITY_LOGS_TABLE` env var, or Lambda lacks DynamoDB permission

### CORS error in browser

The backend CORS setting uses `process.env.FRONTEND_URL`. If that SSM param still has the placeholder value:
1. Update `/mini-jira/FRONTEND_URL` in SSM to the real CloudFront URL
2. Re-run the SSM fetch + `pm2 reload backend` on both EC2 instances (see step 18)

### Cognito user stuck on FORCE_CHANGE_PASSWORD

Log in through the app — it will prompt for a new password automatically. Complete the flow. Alternatively: **Cognito → Users → select user → Actions → Confirm account** (if available).

### GSI returning no results

The GSI may still be backfilling. Check: **DynamoDB → Tasks → Indexes tab** — all indexes must show **Active**. Wait up to 30 minutes if Backfilling.

---

## 25. Quick Reference Card

Fill this in as you go. Keep it handy on demo day.

```
REGION:                eu-north-1
ACCOUNT_ID:            ________________________________

─── VPC ──────────────────────────────────────────────
VPC ID:                vpc-________________________________
Public Subnet AZ-a:    subnet-____________________________
Public Subnet AZ-b:    subnet-____________________________
Private Subnet AZ-a:   subnet-____________________________
Private Subnet AZ-b:   subnet-____________________________
NAT Gateway ID:        nat-________________________________
Internet Gateway:      igw-________________________________

─── Cognito ──────────────────────────────────────────
User Pool ID:          eu-north-1_______________________
App Client ID:         ________________________________

─── S3 Buckets ───────────────────────────────────────
Originals:             mini-jira-originals-_______-2026
Resized:               mini-jira-resized-_________-2026

─── SNS ARNs ─────────────────────────────────────────
TaskAssignmentsTopic:  arn:aws:sns:eu-north-1:ACCT:TaskAssignmentsTopic
DailyDigestTopic:      arn:aws:sns:eu-north-1:ACCT:DailyDigestTopic
Alerts Topic:          arn:aws:sns:eu-north-1:ACCT:mini-jira-alerts

─── SQS ──────────────────────────────────────────────
Queue URL:             https://sqs.eu-north-1.amazonaws.com/ACCT/TaskAssignmentsQueue
DLQ ARN:               arn:aws:sqs:eu-north-1:ACCT:TaskAssignmentsQueue-DLQ

─── Load Balancer ────────────────────────────────────
ALB DNS:               mini-jira-alb-xxx.eu-north-1.elb.amazonaws.com
Target Group:          mini-jira-tg

─── EC2 / ASG ────────────────────────────────────────
ASG Name:              mini-jira-asg
Instance 1 ID:         i-________________________________
Instance 2 ID:         i-________________________________
Key pair file:         ~/Downloads/mini-jira-key.pem

─── CloudFront ───────────────────────────────────────
Distribution ID:       ________________________________
Public URL:            https://_________________.cloudfront.net

─── Lambdas ──────────────────────────────────────────
image-resize:          mini-jira-image-resize
assignment-worker:     mini-jira-assignment-worker
daily-digest:          mini-jira-daily-digest

─── Demo Users ───────────────────────────────────────
Ali (manager):   ali@minijira.com     password: ________________
Sara (frontend): sara@minijira.com    password: ________________
Omar (backend):  omar@minijira.com    password: ________________
```
