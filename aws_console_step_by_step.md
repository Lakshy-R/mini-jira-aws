# 🚀 Mini-Jira AWS Deployment — Step-by-Step Console Walkthrough

> This guide walks you through **every click** in the AWS Console. Follow it in order — each step depends on the ones before it.

> [!IMPORTANT]
> **Before you start**: Pick a region (recommended: `eu-north-1` Stockholm) and **never change it**. Check the region dropdown (top-right corner of the console) on every page.

> [!CAUTION]
> **Cost warning**: 2× t3.micro EC2 instances + 1 NAT Gateway ≈ **~$35/month**. Stop/delete everything when not in use.

---

## 📋 What You'll Need Before Starting

- [ ] An AWS account (check Free Tier at **Console → Billing → Free Tier**)
- [ ] Node.js 20+ installed locally (to package Lambda zips)
- [ ] Git installed locally
- [ ] The `mini-jira-aws` repository cloned on your machine
- [ ] A notepad/text file to save IDs and ARNs as you go (use the Quick Reference Card at the bottom of the deployment guide)

---

## Phase 1: Networking (VPC, Subnets, NAT Gateway, Route Tables)

This phase creates the private network where your app will live.

### Step 1: Create the VPC

1. Open the AWS Console → type **VPC** in the search bar → click **VPC**
2. In the left sidebar, click **Your VPCs**
3. Click the orange **Create VPC** button (top-right)
4. Fill in:

   | Field | What to enter |
   |---|---|
   | Resources to create | Select **VPC only** |
   | Name tag | `mini-jira-vpc` |
   | IPv4 CIDR block | Select **IPv4 CIDR manual input** |
   | IPv4 CIDR | `10.0.0.0/16` |
   | IPv6 CIDR block | **No IPv6 CIDR block** |
   | Tenancy | **Default** |

5. Click **Create VPC**
6. ✅ You should see a green success banner. **Copy the VPC ID** (starts with `vpc-`) to your notepad.

---

### Step 2: Create an Internet Gateway

1. In the VPC dashboard left sidebar → click **Internet gateways**
2. Click **Create internet gateway**
3. Name tag: `mini-jira-igw`
4. Click **Create internet gateway**
5. You'll land on the IGW detail page. Click the **Actions** dropdown → **Attach to VPC**
6. Select `mini-jira-vpc` from the dropdown → click **Attach internet gateway**
7. ✅ State should now show **Attached**

---

### Step 3: Create 4 Subnets

1. Left sidebar → **Subnets** → **Create subnet**
2. At the top, select VPC: **mini-jira-vpc**
3. Now add 4 subnets one by one (click **Add new subnet** after each):

**Subnet 1:**

| Field | Value |
|---|---|
| Subnet name | `mini-jira-public-a` |
| Availability Zone | Pick the one ending in **a** (e.g. `eu-north-1a`) |
| IPv4 subnet CIDR block | `10.0.1.0/24` |

Click **Add new subnet**

**Subnet 2:**

| Field | Value |
|---|---|
| Subnet name | `mini-jira-public-b` |
| Availability Zone | Pick the one ending in **b** (e.g. `eu-north-1b`) |
| IPv4 subnet CIDR block | `10.0.2.0/24` |

Click **Add new subnet**

**Subnet 3:**

| Field | Value |
|---|---|
| Subnet name | `mini-jira-private-a` |
| Availability Zone | Same **a** zone as above (e.g. `eu-north-1a`) |
| IPv4 subnet CIDR block | `10.0.11.0/24` |

Click **Add new subnet**

**Subnet 4:**

| Field | Value |
|---|---|
| Subnet name | `mini-jira-private-b` |
| Availability Zone | Same **b** zone as above (e.g. `eu-north-1b`) |
| IPv4 subnet CIDR block | `10.0.12.0/24` |

4. Click **Create subnet**
5. ✅ All 4 subnets should now appear in the list.

**Enable auto-assign public IP on the two public subnets:**

6. Click the checkbox next to `mini-jira-public-a` → **Actions** → **Edit subnet settings**
7. Check ✅ **Enable auto-assign public IPv4 address** → **Save**
8. Repeat for `mini-jira-public-b`

---

### Step 4: Create a NAT Gateway

> [!NOTE]
> The NAT Gateway sits in a **public** subnet and gives private EC2 instances internet access (for GitHub cloning, AWS API calls) without exposing them publicly.

1. Left sidebar → **NAT gateways** → **Create NAT gateway**
2. Fill in:

   | Field | Value |
   |---|---|
   | Name | `mini-jira-nat` |
   | Subnet | `mini-jira-public-a` |
   | Connectivity type | **Public** |
   | Elastic IP allocation ID | Click **Allocate Elastic IP** (a new IP will be allocated automatically) |

3. Click **Create NAT gateway**
4. ⏳ Wait 1–2 minutes until State shows **Available**

---

### Step 5: Create Route Tables

You need **two** route tables: one for public subnets and one for private subnets.

**Public Route Table:**

1. Left sidebar → **Route tables** → **Create route table**
2. Name: `mini-jira-rt-public` · VPC: `mini-jira-vpc` → **Create route table**
3. You'll land on the route table detail page. Click the **Routes** tab → **Edit routes**
4. Click **Add route**:
   - Destination: `0.0.0.0/0`
   - Target: click the dropdown → **Internet Gateway** → select `mini-jira-igw`
5. Click **Save changes**
6. Now click the **Subnet associations** tab → **Edit subnet associations**
7. Check ✅ both `mini-jira-public-a` and `mini-jira-public-b` → **Save associations**

**Private Route Table:**

8. Go back to **Route tables** → **Create route table**
9. Name: `mini-jira-rt-private` · VPC: `mini-jira-vpc` → **Create route table**
10. **Routes** tab → **Edit routes** → **Add route**:
    - Destination: `0.0.0.0/0`
    - Target: **NAT Gateway** → select `mini-jira-nat`
11. **Save changes**
12. **Subnet associations** tab → **Edit subnet associations**
13. Check ✅ both `mini-jira-private-a` and `mini-jira-private-b` → **Save associations**

> [!TIP]
> **Verify**: Public subnets route `0.0.0.0/0` → Internet Gateway. Private subnets route `0.0.0.0/0` → NAT Gateway. This is the foundation of your entire network security.

---

## Phase 2: Database (DynamoDB Tables)

### Step 6: Create DynamoDB Tables

1. Search **DynamoDB** in the console search bar → click it
2. Left sidebar → **Tables** → **Create table**

**Table 1 — Tasks:**

| Field | Value |
|---|---|
| Table name | `Tasks` |
| Partition key | `taskId` (String) |
| Sort key | Leave blank |
| Table settings | **Customize settings** |
| Read/write capacity settings | **On-demand** |

Click **Create table** → wait for status **Active**

**Add 3 GSIs (Global Secondary Indexes):**

3. Click the `Tasks` table → **Indexes** tab → **Create index**

> [!IMPORTANT]
> Wait for each GSI to show **Active** before creating the next one.

**GSI 1:**

| Field | Value |
|---|---|
| Partition key | `teamId` (String) |
| Sort key | `createdAt` (String) |
| Index name | `teamId-createdAt-index` |
| Attribute projections | **All** |

Click **Create index** → wait for Active

**GSI 2:**

| Field | Value |
|---|---|
| Partition key | `entity` (String) |
| Sort key | `createdAt` (String) |
| Index name | `entity-createdAt-index` |
| Attribute projections | **All** |

**GSI 3:**

| Field | Value |
|---|---|
| Partition key | `assigneeId` (String) |
| Sort key | `createdAt` (String) |
| Index name | `assigneeId-createdAt-index` |
| Attribute projections | **All** |

---

**Table 2 — Comments:**

Go back to **Tables** → **Create table**

| Field | Value |
|---|---|
| Table name | `Comments` |
| Partition key | `commentId` (String) |
| Capacity mode | **On-demand** |

Create one GSI:

| Partition key | Sort key | Index name |
|---|---|---|
| `taskId` (String) | `createdAt` (String) | `taskId-index` |

---

**Table 3 — Projects:**

| Field | Value |
|---|---|
| Table name | `Projects` |
| Partition key | `projectId` (String) |
| Capacity mode | **On-demand** |

GSI:

| Partition key | Sort key | Index name |
|---|---|---|
| `teamId` (String) | `createdAt` (String) | `teamId-createdAt-index` |

---

**Table 4 — ActivityLogs:**

| Field | Value |
|---|---|
| Table name | `ActivityLogs` |
| Partition key | `logId` (String) |
| Capacity mode | **On-demand** |

After creation, enable TTL:
1. Click the `ActivityLogs` table → **Additional settings** tab
2. **Time to live (TTL)** → **Manage TTL**
3. TTL attribute name: `expiresAt` → **Save**

GSI:

| Partition key | Sort key | Index name |
|---|---|---|
| `taskId` (String) | `timestamp` (String) | `taskId-timestamp-index` |

---

## Phase 3: Authentication (Cognito)

### Step 7: Create a Cognito User Pool

1. Search **Cognito** → click it
2. Click **Create user pool**

**Step 1 — Sign-in experience:**
- Sign-in options: check ✅ **Email**
- Click **Next**

**Step 2 — Security requirements:**
- Password policy: **Cognito defaults**
- MFA: **No MFA**
- Click **Next**

**Step 3 — Sign-up experience:**
- Self-registration: **Enable**
- Required attributes: `email` should already be selected
- Scroll down to **Custom attributes** → click **Add custom attribute**:
  - Name: `role` · Type: String
- Click **Add custom attribute** again:
  - Name: `teamId` · Type: String
- Click **Next**

**Step 4 — Message delivery:**
- Email provider: **Send email with Cognito**
- Click **Next**

**Step 5 — Integrate your app:**
- User pool name: `mini-jira-pool`
- **Uncheck** "Use the Cognito Hosted UI"
- Under **Initial app client**:
  - App client name: `mini-jira-client`
  - Client secret: **Don't generate a client secret**
  - Authentication flows: check both:
    - ✅ `ALLOW_USER_PASSWORD_AUTH`
    - ✅ `ALLOW_REFRESH_TOKEN_AUTH`
- Click **Next**

**Step 6 — Review and create** → Click **Create user pool**

> [!IMPORTANT]
> **Save these two values** — you'll need them in Step 12 (SSM Parameters):
> - **User Pool ID** — format: `eu-north-1_xxxxxxxx` (found on the pool overview page)
> - **App Client ID** — click into the pool → **App integration** tab → scroll to **App clients** → copy the Client ID

---

## Phase 4: Storage (S3 Buckets)

### Step 8: Create S3 Buckets

1. Search **S3** → click it → **Create bucket**

**Bucket 1 — Originals (user-uploaded images):**

| Field | Value |
|---|---|
| Bucket name | `mini-jira-originals-YOURNAME-2026` *(replace YOURNAME — must be globally unique)* |
| Region | Your chosen region |
| Block all public access | ✅ **Checked** (keep all blocks on) |

Click **Create bucket**

2. Click into the new bucket → **Permissions** tab → scroll to **Cross-origin resource sharing (CORS)** → **Edit**
3. Paste this JSON:

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

4. Click **Save changes**

**Bucket 2 — Resized (Lambda thumbnails):**

| Field | Value |
|---|---|
| Bucket name | `mini-jira-resized-YOURNAME-2026` |
| Region | Same region |
| Block all public access | ✅ **Checked** |

Click **Create bucket** (no CORS needed for this one)

---

## Phase 5: Messaging (SNS + SQS)

### Step 9: Create SNS Topics

1. Search **SNS** → click **Simple Notification Service**
2. Left sidebar → **Topics** → **Create topic**

**Topic 1 — TaskAssignmentsTopic:**

| Field | Value |
|---|---|
| Type | **Standard** |
| Name | `TaskAssignmentsTopic` |

Click **Create topic** → 📋 **Copy the ARN** to your notepad

3. On the topic page → **Create subscription**:
   - Protocol: **Email**
   - Endpoint: **your real email address**
   - Click **Create subscription**
4. 📧 **Check your email** → click the confirmation link in the AWS email

**Topic 2 — DailyDigestTopic:**

Repeat: Create topic → Standard → Name: `DailyDigestTopic` → 📋 Save ARN → add email subscription → confirm

**Topic 3 — mini-jira-alerts:**

Repeat: Create topic → Standard → Name: `mini-jira-alerts` → 📋 Save ARN → add email subscription → confirm

---

### Step 10: Create SQS Queues

1. Search **SQS** → click it → **Create queue**

> [!WARNING]
> Create the Dead Letter Queue (DLQ) **FIRST** — the main queue depends on it.

**Queue 1 — DLQ (create first):**

| Field | Value |
|---|---|
| Type | **Standard** |
| Name | `TaskAssignmentsQueue-DLQ` |
| Visibility timeout | `30` seconds |
| Message retention period | `14` days |

Click **Create queue** → 📋 Save the ARN

**Queue 2 — Main Queue:**

| Field | Value |
|---|---|
| Type | **Standard** |
| Name | `TaskAssignmentsQueue` |
| Visibility timeout | `30` seconds |
| Message retention period | `4` days |

Scroll down to **Dead-letter queue** section:
- Enabled: **Yes**
- Choose queue: select `TaskAssignmentsQueue-DLQ`
- Maximum receives: `3`

Click **Create queue** → 📋 Save both the **ARN** and the **Queue URL**

---

### Step 11: Connect SNS → SQS

1. Go to **SQS** → click `TaskAssignmentsQueue`
2. Look for **Subscribe to Amazon SNS topic** button (at the bottom or under the SNS subscriptions tab)
3. Select `TaskAssignmentsTopic` → **Save**

**Add an access policy so SNS can write to SQS:**

4. Still on `TaskAssignmentsQueue` → click the **Access policy** tab → **Edit**
5. Replace the entire policy with (fill in your real Account ID and Region):

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

> [!TIP]
> **Find your Account ID**: Click your username in the top-right corner of the console → your 12-digit Account ID is shown there.

6. Click **Save**

---

## Phase 6: Permissions (IAM Roles)

### Step 12: Create IAM Roles

1. Search **IAM** → click it
2. Left sidebar → **Roles** → **Create role**

**Role 1 — Lambda Execution Role:**

- Trusted entity type: **AWS service**
- Use case: **Lambda**
- Click **Next**
- Search and check ✅ these 6 policies:
  1. `AWSLambdaBasicExecutionRole`
  2. `AmazonDynamoDBFullAccess`
  3. `AmazonS3FullAccess`
  4. `AmazonSNSFullAccess`
  5. `AmazonSQSFullAccess`
  6. `CloudWatchFullAccess`
- Click **Next**
- Role name: `mini-jira-lambda-role`
- Click **Create role**

**Role 2 — EC2 Instance Role:**

- Go back to **Roles** → **Create role**
- Trusted entity type: **AWS service**
- Use case: **EC2**
- Click **Next**
- Search and check ✅ these 9 policies:
  1. `AmazonSSMManagedInstanceCore`
  2. `CloudWatchAgentServerPolicy`
  3. `CloudWatchFullAccess`
  4. `AmazonDynamoDBFullAccess`
  5. `AmazonS3FullAccess`
  6. `AmazonSNSFullAccess`
  7. `AmazonSQSFullAccess`
  8. `AmazonCognitoPowerUser`
  9. `AmazonSSMReadOnlyAccess`
- Click **Next**
- Role name: `mini-jira-ec2-role`
- Click **Create role**

---

## Phase 7: Configuration (SSM Parameter Store)

### Step 13: Create SSM Parameters

1. Search **Systems Manager** → click it
2. Left sidebar → **Parameter Store** → **Create parameter**

You need to create **16 parameters**. For each one:
- Tier: **Standard**
- Type: **SecureString**

Create each parameter one at a time:

| # | Parameter Name | Value |
|---|---|---|
| 1 | `/mini-jira/PORT` | `3000` |
| 2 | `/mini-jira/NODE_ENV` | `production` |
| 3 | `/mini-jira/AWS_REGION` | `eu-north-1` |
| 4 | `/mini-jira/COGNITO_USER_POOL_ID` | *(your User Pool ID from Step 7)* |
| 5 | `/mini-jira/COGNITO_CLIENT_ID` | *(your App Client ID from Step 7)* |
| 6 | `/mini-jira/DYNAMODB_TASKS_TABLE` | `Tasks` |
| 7 | `/mini-jira/DYNAMODB_COMMENTS_TABLE` | `Comments` |
| 8 | `/mini-jira/DYNAMODB_PROJECTS_TABLE` | `Projects` |
| 9 | `/mini-jira/DYNAMODB_ACTIVITY_LOGS_TABLE` | `ActivityLogs` |
| 10 | `/mini-jira/S3_ORIGINALS_BUCKET` | *(your originals bucket name from Step 8)* |
| 11 | `/mini-jira/S3_RESIZED_BUCKET` | *(your resized bucket name from Step 8)* |
| 12 | `/mini-jira/SNS_TOPIC_ARN` | *(TaskAssignmentsTopic ARN from Step 9)* |
| 13 | `/mini-jira/SNS_DIGEST_TOPIC_ARN` | *(DailyDigestTopic ARN from Step 9)* |
| 14 | `/mini-jira/CW_NAMESPACE` | `MiniJira` |
| 15 | `/mini-jira/ENV` | `production` |
| 16 | `/mini-jira/FRONTEND_URL` | `https://PLACEHOLDER` *(you'll update this later in Step 21)* |

> [!TIP]
> This is repetitive but important. Double-check every value — a typo here will cause runtime errors on EC2.

---

## Phase 8: Lambda Functions

### Step 14: Package Lambda Zips (on your local machine)

Open **PowerShell** and navigate to your project folder:

```powershell
cd "c:\Users\kamr0\Downloads\software cloud computing project\mini-jira-aws"

# Image resize Lambda
cd lambdas\image-resize
npm install
Compress-Archive -Path .\* -DestinationPath ..\..\image-resize.zip -Force
cd ..\..

# Assignment Worker Lambda
cd lambdas\assignment-worker
npm install
Compress-Archive -Path .\* -DestinationPath ..\..\assignment-worker.zip -Force
cd ..\..

# Daily Digest Lambda
cd lambdas\daily-digest
npm install
Compress-Archive -Path .\* -DestinationPath ..\..\daily-digest.zip -Force
cd ..\..
```

> [!WARNING]
> The zip files must have the code files **at the root level** — not inside a subfolder. If you open the zip, you should see `index.js`, `node_modules/`, `package.json` directly.

---

### Step 15: Create Lambda Functions in AWS Console

1. Search **Lambda** → click it → **Create function**

**Lambda 1 — image-resize:**

| Field | Value |
|---|---|
| Author from scratch | Selected |
| Function name | `mini-jira-image-resize` |
| Runtime | **Node.js 20.x** |
| Architecture | **x86_64** |
| Execution role | **Use an existing role** → `mini-jira-lambda-role` |

Click **Create function**

2. **Code** tab → **Upload from** → **.zip file** → select `image-resize.zip` → **Save**

3. **Configuration** tab → **Environment variables** → **Edit** → add:

   | Key | Value |
   |---|---|
   | `S3_RESIZED_BUCKET` | *(your resized bucket name)* |
   | `AWS_REGION` | `eu-north-1` |
   | `DYNAMODB_TASKS_TABLE` | `Tasks` |

4. **Configuration** tab → **General configuration** → **Edit** → Timeout: `0 min 30 sec` → **Save**

5. **Configuration** tab → **Triggers** → **Add trigger**:
   - Source: **S3**
   - Bucket: *(your originals bucket)*
   - Event types: **PUT**
   - Prefix: `task-images/`
   - Check the recursive invocation acknowledgment → **Add**

---

**Lambda 2 — assignment-worker:**

Create function → same setup:

| Field | Value |
|---|---|
| Function name | `mini-jira-assignment-worker` |
| Runtime | **Node.js 20.x** |
| Execution role | `mini-jira-lambda-role` |

Upload `assignment-worker.zip`

Environment variables:

| Key | Value |
|---|---|
| `DYNAMODB_ACTIVITY_LOGS_TABLE` | `ActivityLogs` |
| `AWS_REGION` | `eu-north-1` |

Add trigger:
- Source: **SQS**
- Queue: `TaskAssignmentsQueue`
- Batch size: `1`
- Click **Add**

---

**Lambda 3 — daily-digest:**

| Field | Value |
|---|---|
| Function name | `mini-jira-daily-digest` |
| Runtime | **Node.js 20.x** |
| Execution role | `mini-jira-lambda-role` |

Upload `daily-digest.zip`

Environment variables:

| Key | Value |
|---|---|
| `DYNAMODB_TASKS_TABLE` | `Tasks` |
| `SNS_DIGEST_TOPIC_ARN` | *(DailyDigestTopic ARN)* |
| `AWS_REGION` | `eu-north-1` |
| `ENV` | `production` |

General configuration → Timeout: `1 min 0 sec`

---

## Phase 9: Scheduled Events (EventBridge)

### Step 16: Create EventBridge Rule

1. Search **EventBridge** → click it
2. Left sidebar → **Rules** → **Create rule**

| Field | Value |
|---|---|
| Name | `mini-jira-daily-digest` |
| Event bus | **default** |
| Rule type | **Schedule** |

Click **Next**

3. Schedule pattern: **A fine-grained schedule (cron expression)**
4. Cron expression: `0 9 * * ? *` *(runs at 09:00 UTC every day)*
5. Click **Next**
6. Target:
   - Target types: **AWS service**
   - Select a target: **Lambda function**
   - Function: `mini-jira-daily-digest`
7. Click **Next** → **Next** → **Create rule**

---

## Phase 10: Security Groups

### Step 17: Create Security Groups

1. Search **EC2** → click it
2. Left sidebar → **Security Groups** → **Create security group**

**Security Group 1 — ALB:**

| Field | Value |
|---|---|
| Security group name | `mini-jira-alb-sg` |
| Description | `Mini-Jira ALB` |
| VPC | `mini-jira-vpc` |

Inbound rules → **Add rule** twice:

| Type | Port Range | Source | Description |
|---|---|---|---|
| HTTP | 80 | `0.0.0.0/0` | HTTP from internet |
| HTTPS | 443 | `0.0.0.0/0` | HTTPS from internet |

Click **Create security group**

**Security Group 2 — EC2:**

| Field | Value |
|---|---|
| Security group name | `mini-jira-ec2-sg` |
| Description | `Mini-Jira EC2 backend` |
| VPC | `mini-jira-vpc` |

Inbound rules → **Add rule**:

| Type | Port Range | Source | Description |
|---|---|---|---|
| Custom TCP | 3000 | **Select the `mini-jira-alb-sg` security group** (type "mini-jira-alb" in the search) | Node.js from ALB only |

> [!IMPORTANT]
> For the EC2 security group, the source must be the **ALB security group**, NOT `0.0.0.0/0`. This ensures EC2 instances are only reachable through the load balancer.

Click **Create security group**

---

## Phase 11: Load Balancer

### Step 18: Create Target Group

1. In EC2 console → left sidebar → **Target Groups** → **Create target group**

| Field | Value |
|---|---|
| Target type | **Instances** |
| Target group name | `mini-jira-tg` |
| Protocol | **HTTP** |
| Port | `3000` |
| VPC | `mini-jira-vpc` |

Health check settings:

| Field | Value |
|---|---|
| Health check protocol | HTTP |
| Health check path | `/api/health` |
| Healthy threshold | `2` |
| Unhealthy threshold | `3` |
| Timeout | `5` seconds |
| Interval | `30` seconds |

2. Click **Next** → **Create target group** *(leave targets blank — the ASG will register instances)*

---

### Step 19: Create Application Load Balancer

1. Left sidebar → **Load Balancers** → **Create load balancer**
2. Choose **Application Load Balancer** → **Create**

| Field | Value |
|---|---|
| Name | `mini-jira-alb` |
| Scheme | **Internet-facing** |
| IP address type | **IPv4** |
| VPC | `mini-jira-vpc` |

3. **Mappings**: Check both AZs → select `mini-jira-public-a` for one AZ and `mini-jira-public-b` for the other
4. **Security groups**: Remove the default SG → select `mini-jira-alb-sg`
5. **Listeners and routing**:
   - Protocol: **HTTP** · Port: **80**
   - Default action: **Forward to** → select `mini-jira-tg`
6. Click **Create load balancer**

📋 **Save the ALB DNS name** — it looks like `mini-jira-alb-xxxxxxxxxx.eu-north-1.elb.amazonaws.com`

---

## Phase 12: Compute (Launch Template + Auto Scaling)

### Step 20: Create Launch Template

1. Left sidebar → **Launch Templates** → **Create launch template**

| Field | Value |
|---|---|
| Launch template name | `mini-jira-lt` |
| Template version description | `v1` |
| AMI | Search **Amazon Linux 2023** → pick the latest Free tier eligible one |
| Instance type | `t3.micro` |
| Key pair | Click **Create new key pair** → Name: `mini-jira-key` → Type: RSA → Format: .pem → **Create** (download and save the .pem file!) |

2. **Network settings**:
   - Security groups: select `mini-jira-ec2-sg`

3. Expand **Advanced details** at the bottom:
   - IAM instance profile: select `mini-jira-ec2-role`
   - Scroll all the way down to **User data** → paste the entire startup script from [DEPLOYMENT_GUIDE.md lines 772-846](file:///c:/Users/kamr0/Downloads/software%20cloud%20computing%20project/mini-jira-aws/DEPLOYMENT_GUIDE.md#L772-L846)

> [!IMPORTANT]
> The User Data script is the **entire bash script** starting with `#!/bin/bash` — it installs Node.js, clones the repo, fetches SSM config, builds the frontend, and starts the backend with PM2. Copy it exactly.

4. Click **Create launch template**

---

### Step 21: Create Auto Scaling Group

1. Left sidebar → **Auto Scaling Groups** → **Create Auto Scaling group**

**Step 1 — Choose launch template:**
- Auto Scaling group name: `mini-jira-asg`
- Launch template: `mini-jira-lt` (latest version)
- Click **Next**

**Step 2 — Choose instance launch options:**
- VPC: `mini-jira-vpc`
- Availability Zones and subnets: select **both private subnets**:
  - ✅ `mini-jira-private-a`
  - ✅ `mini-jira-private-b`
- Click **Next**

**Step 3 — Configure advanced options:**
- Load balancing: **Attach to an existing load balancer**
- Choose from your load balancer target groups: `mini-jira-tg`
- Health checks: check ✅ **Turn on Elastic Load Balancing health checks**
- Health check grace period: `300` seconds
- Click **Next**

**Step 4 — Configure group size and scaling:**
- Desired capacity: `2`
- Minimum capacity: `2`
- Maximum capacity: `4`
- Scaling policies: **None**
- Click **Next**

**Step 5 — Add notifications:** Skip → **Next**

**Step 6 — Add tags:**

| Key | Value |
|---|---|
| `Name` | `mini-jira-backend` |

**Step 7 — Review** → **Create Auto Scaling group**

⏳ **Wait 5–7 minutes** for both EC2 instances to launch and complete the User Data script.

**Verify health:**
- Go to **EC2 → Instances** → both instances should show **Running** with **2/2 checks passed**
- Go to **EC2 → Target Groups → mini-jira-tg → Targets** tab → both targets should show **Healthy**

> [!NOTE]
> If targets show **Unhealthy** after 5 minutes, the user data script may still be running. Wait 3 more minutes. If still unhealthy, check the troubleshooting section.

---

## Phase 13: CDN (CloudFront)

### Step 22: Create CloudFront Distribution

1. Search **CloudFront** → click it → **Create distribution**

**Origin settings:**

| Field | Value |
|---|---|
| Origin domain | **Paste your ALB DNS name** (do NOT select from the dropdown) |
| Protocol | **HTTP only** |
| HTTP port | `80` |
| Origin name | `alb-origin` |

**Default cache behavior:**

| Field | Value |
|---|---|
| Viewer protocol policy | **Redirect HTTP to HTTPS** |
| Allowed HTTP methods | **GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE** |
| Cache policy | **CachingDisabled** |
| Origin request policy | **AllViewer** |

**Settings:**

| Field | Value |
|---|---|
| Price class | **Use only North America and Europe** |
| Default root object | *(leave blank)* |

2. Click **Create distribution**
3. ⏳ Wait ~5 minutes until status changes from **Deploying** to **Enabled**
4. 📋 **Copy the Distribution domain name** — looks like `dxxxxxxxxxxxx.cloudfront.net`

**Test it:**
- Open `https://dxxxxxxxxxxxx.cloudfront.net/api/health` → should return `{"status":"ok"}`
- Open `https://dxxxxxxxxxxxx.cloudfront.net` → should show the login page

---

## Phase 14: Update Configuration with CloudFront URL

### Step 23: Update the SSM FRONTEND_URL Parameter

1. Go to **Systems Manager → Parameter Store**
2. Click `/mini-jira/FRONTEND_URL` → **Edit**
3. Change the value to: `https://dxxxxxxxxxxxx.cloudfront.net` *(your actual CloudFront domain)*
4. Click **Save changes**

**Reload config on both EC2 instances:**

5. Go to **EC2 → Instances** → select the first instance → **Connect** → **Session Manager** → **Connect**
6. Run these commands:

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

7. **Repeat on the second EC2 instance**

---

## Phase 15: Monitoring (CloudWatch)

### Step 24: Create CloudWatch Dashboard

1. Search **CloudWatch** → click it
2. Left sidebar → **Dashboards** → **Create dashboard**
3. Dashboard name: `MiniJira-Dashboard` → **Create dashboard**

**Add 4 widgets:**

**Widget 1 — Tasks Created Per Day:**
- **Add widget** → **Line** → **Next**
- **Browse** tab → find `MiniJira` namespace → `Tasks` → select `TaskCreated`
- Period: **1 Day** · Statistic: **Sum**
- Title: `Tasks Created Per Day` → **Create widget**

**Widget 2 — Tasks Closed Per Day Per Team:**
- **Add widget** → **Line**
- `MiniJira/Tasks` → select `TaskClosed` → group by `TeamId`
- Period: **1 Day** · Statistic: **Sum**
- Title: `Tasks Closed Per Day Per Team`

**Widget 3 — Average Time to Close:**
- **Add widget** → **Number**
- `MiniJira/Tasks` → select `TimeToCloseMs`
- Period: **1 Day** · Statistic: **Average**
- Title: `Avg Time to Close (ms)`

**Widget 4 — EC2 CPU Utilization:**
- **Add widget** → **Line**
- **EC2 → Per-Instance Metrics** → find your 2 instances → select `CPUUtilization`
- Period: **5 Minutes** · Statistic: **Average**
- Title: `EC2 CPU Utilization`

4. Click **Save dashboard**

> [!NOTE]
> The custom MiniJira metrics won't appear until you've created and assigned at least one task through the app. The EC2 CPU metrics should be visible immediately.

---

### Step 25: Create CloudWatch Alarms

1. **CloudWatch** → left sidebar → **Alarms** → **All alarms** → **Create alarm**

**Alarm 1 — Overdue Tasks:**
- **Select metric** → `MiniJira/Tasks` → `OverdueTasks` → **Select metric**
- Period: **1 Day**
- Threshold: **Greater than** `5`
- Notification: select `mini-jira-alerts` SNS topic
- Alarm name: `mini-jira-overdue-tasks`
- **Create alarm**

**Alarm 2 — EC2 High CPU:**
- **Select metric** → `EC2 → Per-Instance Metrics` → find your instance → `CPUUtilization`
- Period: **5 minutes**
- Threshold: **Greater than** `80`
- Notification: `mini-jira-alerts`
- Alarm name: `mini-jira-high-cpu`

**Alarm 3 — ALB 5xx Errors:**
- **Select metric** → `ApplicationELB → Per AppELB Metrics` → find `mini-jira-alb` → `HTTPCode_ELB_5XX_Count`
- Period: **5 minutes**
- Threshold: **Greater than** `0`
- Notification: `mini-jira-alerts`
- Alarm name: `mini-jira-alb-5xx`

---

## Phase 16: Demo Users (Cognito)

### Step 26: Create Demo Users

1. Go to **Cognito → User pools → mini-jira-pool → Users** tab → **Create user**

**User 1 — Ali (Manager):**

| Field | Value |
|---|---|
| Invitation message | **Don't send an invitation** |
| Email address | `ali@minijira.com` |
| Mark email address as verified | ✅ **Check** |
| Temporary password | `Ali@Manager2026!` |

Click **Create user** → click into Ali's user → **User attributes** → edit to add:
- `custom:role` = `manager`
- `custom:teamId` = *(leave blank or `all`)*

**User 2 — Sara (Frontend Employee):**

| Field | Value |
|---|---|
| Email | `sara@minijira.com` |
| Email verified | ✅ |
| Temporary password | `Sara@Employee2026!` |

Attributes: `custom:role` = `employee` · `custom:teamId` = `frontend`

**User 3 — Omar (Backend Employee):**

| Field | Value |
|---|---|
| Email | `omar@minijira.com` |
| Email verified | ✅ |
| Temporary password | `Omar@Employee2026!` |

Attributes: `custom:role` = `employee` · `custom:teamId` = `backend`

> [!IMPORTANT]
> After creating all 3 users, **log in through the live app** for each one. Cognito will force a password change on first login — complete this flow for all 3 users before demo day.

---

## ✅ Final Verification Checklist

Go through this list to confirm everything is working:

### Networking
- [ ] VPC `mini-jira-vpc` exists with 4 subnets
- [ ] NAT Gateway state: **Available**
- [ ] Private subnets route to NAT Gateway
- [ ] Public subnets route to Internet Gateway

### Compute
- [ ] 2 EC2 instances: **Running** with **2/2 checks passed**
- [ ] ALB: **Active**
- [ ] Both targets in `mini-jira-tg`: **Healthy**

### Application
- [ ] `https://YOUR_CF_DOMAIN/api/health` → `{"status":"ok"}`
- [ ] `https://YOUR_CF_DOMAIN` → login page loads

### Data
- [ ] 4 DynamoDB tables: **Active**
- [ ] All GSIs: **Active** (not Backfilling)
- [ ] 2 S3 buckets exist
- [ ] 16 SSM parameters under `/mini-jira/`
- [ ] `FRONTEND_URL` = real CloudFront URL

### Event-Driven
- [ ] 3 Lambda functions deployed
- [ ] image-resize has S3 trigger
- [ ] assignment-worker has SQS trigger
- [ ] daily-digest has EventBridge trigger

### Monitoring
- [ ] Dashboard has 4 widgets
- [ ] 3 alarms exist
- [ ] 3 SNS topics have confirmed email subscriptions

### Demo Scenario
- [ ] Login as Ali → empty board
- [ ] Ali creates Task A → assigns to Sara with image
- [ ] Ali creates Task B → assigns to Omar
- [ ] Login as Sara → only Task A visible
- [ ] Login as Omar → only Task B visible
- [ ] Login as Ali → both tasks visible, team filter works

---

## 🔧 Quick Troubleshooting

| Problem | Fix |
|---|---|
| Targets show **Unhealthy** | Wait 5+ min. Then: Session Manager → `pm2 list` → `pm2 logs backend --lines 50` |
| CloudFront returns **502** | Check ALB DNS is correct in CF origin. Test ALB directly: `curl http://ALB_DNS/api/health` |
| `.env` missing variables | Re-run the SSM fetch script on EC2 (see Step 23) |
| No thumbnail in resized bucket | Check Lambda logs. If `sharp` error, rebuild zip in CloudShell |
| SQS messages going to DLQ | Check assignment-worker Lambda logs for errors |
| CORS error in browser | Update `/mini-jira/FRONTEND_URL` SSM param → reload PM2 |
| User stuck on FORCE_CHANGE_PASSWORD | Log in through the app — it handles the password change flow |

---

## 📌 Order Summary

```
Phase 1:  VPC → IGW → Subnets → NAT GW → Route Tables
Phase 2:  DynamoDB (4 tables + GSIs)
Phase 3:  Cognito User Pool
Phase 4:  S3 Buckets (originals + resized)
Phase 5:  SNS Topics → SQS Queues → SNS→SQS subscription
Phase 6:  IAM Roles (Lambda + EC2)
Phase 7:  SSM Parameter Store (16 params)
Phase 8:  Package & Deploy 3 Lambda functions
Phase 9:  EventBridge cron rule
Phase 10: Security Groups (ALB + EC2)
Phase 11: Target Group → ALB
Phase 12: Launch Template → Auto Scaling Group (2 instances)
Phase 13: CloudFront Distribution
Phase 14: Update FRONTEND_URL → reload EC2s
Phase 15: CloudWatch Dashboard + Alarms
Phase 16: Create demo users in Cognito
```
