# Mini-Jira on AWS — Complete Action Plan
**Deadline: 22 May 2026 at 11:59 PM**

This document is ordered by criticality. Complete Phase 1 before anything else — those are showstoppers. Phases 2–4 are improvements that add marks and polish.

---

## Legend
- 🔴 **CRITICAL** — demo will fail or requirement is missing without this
- 🟡 **IMPORTANT** — loses marks in evaluation, easy to fix
- 🟢 **POLISH** — impressive bonus, do if time allows

---

## Phase 1 — Critical Fixes (Do These First)

These are items that will cause the demo to fail or lose significant marks.

---

### 🔴 Step 1: Fix Frontend Deployment (Biggest Gap)

**Problem:** The CDK stack deploys only the Express API backend. The React frontend has no production hosting. Clicking the CloudFront URL right now returns the API health check JSON, not the web app. The CI pipeline builds the frontend but never deploys it anywhere.

**Solution Option A — Serve frontend from Express backend (fastest, 20 min):**

In `backend/server.js`, add static file serving AFTER importing app:

```js
// backend/server.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import app from './src/app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// Serve the built React frontend
const distPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(distPath));

// SPA fallback — any non-API route returns index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

Then update `ec2-userdata.sh` to also build the frontend:

```bash
# Add this BEFORE the PM2 start step (step 7)
echo "=== [6b/7] Build frontend ==="
cd "$APP_DIR/frontend"
npm ci
VITE_API_URL="" VITE_COGNITO_USER_POOL_ID="$(grep COGNITO_USER_POOL_ID $ENV_FILE | cut -d= -f2)" \
VITE_COGNITO_CLIENT_ID="$(grep COGNITO_CLIENT_ID $ENV_FILE | cut -d= -f2)" \
npm run build
```

**Why VITE_API_URL="":** When the frontend is served by the same server as the backend, API calls go to the same origin — no absolute URL needed. Leave VITE_API_URL empty and the Vite config defaults to relative paths.

Update `frontend/src/services/api.js` line 6:
```js
baseURL: import.meta.env.VITE_API_URL || '/api',
```

**Solution Option B — S3 + CloudFront static hosting (proper, 60 min):**

Add to `infra/cdk/lib/mini-jira-stack.ts` before the Outputs section:

```typescript
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';

// Frontend S3 bucket
const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  autoDeleteObjects: true,
});

// OAC for CloudFront → S3 access
const oac = new cloudfront.S3OriginAccessControl(this, 'FrontendOAC');

// Add S3 behavior to existing distribution (static assets)
// Note: CDK doesn't allow modifying the distribution after creation easily,
// so create a NEW distribution for the frontend or use the same one with
// a separate origin.
```

**Recommendation: Use Option A.** It's faster, works within the existing CDK stack without redeploy, and is perfectly valid for a university demo.

---

### 🔴 Step 2: Enable S3 Bucket Versioning (1 line, spec requirement)

**Problem:** The assignment explicitly requires "old versions are retained" for image uploads. The CDK stack does not enable S3 versioning on the originals bucket.

**File:** `infra/cdk/lib/mini-jira-stack.ts`

Find the section where you would create the S3 buckets. The CDK currently defines DynamoDB tables but NOT the S3 buckets (they were created manually). You need to either:

**Option A — Add to CDK stack:**

Add after the DynamoDB tables section:

```typescript
// ─── S3 Buckets ─────────────────────────────────────────────────────────────
const originalsBucket = new s3.Bucket(this, 'OriginalsBucket', {
  bucketName: `mini-jira-originals-${this.account}`,
  versioned: true,                                    // REQUIRED BY SPEC
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  encryption: s3.BucketEncryption.S3_MANAGED,
  lifecycleRules: [{
    noncurrentVersionExpiration: cdk.Duration.days(90),
  }],
  removalPolicy: cdk.RemovalPolicy.RETAIN,
});

const resizedBucket = new s3.Bucket(this, 'ResizedBucket', {
  bucketName: `mini-jira-resized-${this.account}`,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  encryption: s3.BucketEncryption.S3_MANAGED,
  removalPolicy: cdk.RemovalPolicy.RETAIN,
});
```

**Option B — Enable versioning manually on existing bucket (fastest):**

Run this once in your terminal:
```bash
aws s3api put-bucket-versioning \
  --bucket mini-jira-originals-laksh-2026 \
  --versioning-configuration Status=Enabled \
  --region eu-north-1
```

Verify it worked:
```bash
aws s3api get-bucket-versioning --bucket mini-jira-originals-laksh-2026
# Should return: { "Status": "Enabled" }
```

---

### 🔴 Step 3: Add Users and Teams to DynamoDB (Spec Requires These Tables)

**Problem:** The assignment spec says "Design tables for Users, Teams, Projects, Tasks, and Comments." You have no Users or Teams tables in DynamoDB — users are Cognito-only, teams are derived by scanning Cognito attributes.

**Step 3a — Create tables (run once):**

```bash
# Create Users table
aws dynamodb create-table \
  --table-name Users \
  --attribute-definitions AttributeName=userId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-north-1

# Create Teams table
aws dynamodb create-table \
  --table-name Teams \
  --attribute-definitions AttributeName=teamId,AttributeType=S \
  --key-schema AttributeName=teamId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-north-1
```

**Step 3b — Add to CDK stack** (so it's in code):

In `infra/cdk/lib/mini-jira-stack.ts`, add after the projectsTable definition:

```typescript
const usersTable = new dynamodb.Table(this, 'UsersTable', {
  tableName:    'Users',
  partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
  billingMode:  dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: cdk.RemovalPolicy.RETAIN,
});

const teamsTable = new dynamodb.Table(this, 'TeamsTable', {
  tableName:    'Teams',
  partitionKey: { name: 'teamId', type: dynamodb.AttributeType.STRING },
  billingMode:  dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: cdk.RemovalPolicy.RETAIN,
});
```

**Step 3c — Seed the tables with your demo data** (run once):

```bash
# Seed a few teams so they appear in DynamoDB during the demo
aws dynamodb put-item --table-name Teams --region eu-north-1 \
  --item '{"teamId":{"S":"frontend"},"name":{"S":"Frontend"},"createdAt":{"S":"2026-05-22T00:00:00Z"}}'

aws dynamodb put-item --table-name Teams --region eu-north-1 \
  --item '{"teamId":{"S":"backend"},"name":{"S":"Backend"},"createdAt":{"S":"2026-05-22T00:00:00Z"}}'

aws dynamodb put-item --table-name Teams --region eu-north-1 \
  --item '{"teamId":{"S":"qa"},"name":{"S":"QA"},"createdAt":{"S":"2026-05-22T00:00:00Z"}}'
```

> **Note for the demo:** The app still works without this (teams are derived from Cognito), but the evaluator may specifically check DynamoDB tables in the console. Having the tables present with data is the safe choice.

---

### 🔴 Step 4: Verify CORS is Set to CloudFront URL in Production

**Problem:** `app.js` uses `FRONTEND_URL` env var for CORS origin. If it's not set to the CloudFront domain in SSM, every API call from production will fail with a CORS error.

**Step 4a — Find your CloudFront domain:**

```bash
aws cloudfront list-distributions \
  --query "DistributionList.Items[*].{Id:Id,Domain:DomainName}" \
  --output table
```

**Step 4b — Update SSM parameter:**

```bash
aws ssm put-parameter \
  --name "/mini-jira/FRONTEND_URL" \
  --value "https://YOUR_CLOUDFRONT_DOMAIN.cloudfront.net" \
  --type SecureString \
  --overwrite \
  --region eu-north-1
```

**Step 4c — Restart PM2 on EC2 to pick up the new value:**

```bash
# Using SSM Run Command (no SSH needed)
aws ssm send-command \
  --instance-ids YOUR_INSTANCE_ID \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["cd /home/ec2-user/mini-jira-aws/backend && aws ssm get-parameters-by-path --path /mini-jira/ --with-decryption --region eu-north-1 --query Parameters[*].[Name,Value] --output text | awk '"'"'{split($1,parts,\"/\"); key=parts[length(parts)]; val=$0; sub(\"^\" $1 \"\\t\",\"\",val); print key \"=\" val}'"'"' > .env && pm2 reload backend --update-env"]'
```

---

### 🔴 Step 5: Verify the Full End-to-End Flow Works Before Demo

Run through this checklist in a real browser against the production URL:

```
[ ] CloudFront URL opens the React app (not JSON)
[ ] Login page loads and accepts credentials
[ ] Manager can create a task and assign it to Sara (Frontend team)
[ ] Employee Sara logs in and sees ONLY her task
[ ] Employee Omar logs in and sees ONLY his task
[ ] Manager Ali logs in and sees BOTH tasks
[ ] Drag a task from "To Do" → "In Progress" — it saves
[ ] Open task detail panel — comments load
[ ] Add a comment — it appears immediately
[ ] Upload an image on a task — thumbnail appears
[ ] Delete a task as manager — it disappears from board
[ ] CloudWatch dashboard shows metrics in AWS console
[ ] SNS email arrives after task creation (check inbox)
```

---

## Phase 2 — Spec Compliance Fixes (Do These for Full Marks)

---

### 🟡 Step 6: Add Rate Limiting to the Backend

**File:** `backend/src/app.js`

Install the package:
```bash
cd backend && npm install express-rate-limit
```

Add to `app.js` after the helmet line:

```js
import rateLimit from 'express-rate-limit';

// Global rate limit — protects all routes
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,                   // 200 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
}));

// Stricter limit on upload endpoint
const uploadLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Upload rate limit exceeded.' },
});
app.use('/api/upload', uploadLimit);
```

---

### 🟡 Step 7: Fix Upload Route — Restrict to Managers

**Problem:** Any authenticated user can call `POST /api/upload/task-image` and write files to S3.

**File:** `backend/src/modules/upload/upload.router.js`

```js
import express from 'express';
import { upload } from '../../lib/s3.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';   // ADD THIS
import { uploadController } from './upload.controller.js';

const router = express.Router();

router.post(
  '/task-image',
  authMiddleware,
  requireRole('manager'),                 // ADD THIS LINE
  upload.single('image'),
  uploadController.uploadTaskImage
);

export default router;
```

---

### 🟡 Step 8: Fix the 401 Auto-Logout in Frontend

**Problem:** When a Cognito token expires, the frontend never redirects to login — the user stays "authenticated" according to Zustand/localStorage even though all API calls return 401.

**File:** `frontend/src/services/api.js`

Replace the current response interceptor with:

```js
import { useAuthStore } from '../store/auth.store';

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Auto-logout on 401 — token expired or revoked
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
      return Promise.reject(err);
    }

    const message =
      err.response?.data?.error ||
      err.response?.data?.message ||
      err.message ||
      'Unknown error';
    err.displayMessage = message;
    return Promise.reject(err);
  }
);
```

---

### 🟡 Step 9: Add VITE_API_URL to GitHub Actions Secrets

**Problem:** The CI build step uses `${{ secrets.VITE_API_URL }}` but if this secret is not set in GitHub, the production build bakes in an empty `VITE_API_URL` and all API calls go to `/api` (which only works if the frontend is served by the same server — see Step 1).

**Action:**

1. Go to your GitHub repo → Settings → Secrets and variables → Actions
2. Add these repository secrets:

| Secret Name | Value |
|---|---|
| `VITE_API_URL` | `` (empty — relative path, works with Option A from Step 1) OR `https://YOUR_CLOUDFRONT.cloudfront.net/api` |
| `VITE_COGNITO_USER_POOL_ID` | `eu-north-1_CrMpMTx8z` |
| `VITE_COGNITO_CLIENT_ID` | `7cs236u7nsfs9gi5ac43lj8s47` |
| `AWS_ACCESS_KEY_ID` | Your AWS access key |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret key |

---

### 🟡 Step 10: Verify All Lambda Functions Are Deployed

Check each Lambda is deployed and has correct env vars:

```bash
# List all Lambda functions
aws lambda list-functions --region eu-north-1 \
  --query "Functions[*].{Name:FunctionName,Runtime:Runtime}" \
  --output table
```

You should see:
- `image-resize-function` (or similar)
- `assignment-worker`
- `daily-digest`

**For each Lambda, verify environment variables:**

```bash
aws lambda get-function-configuration \
  --function-name assignment-worker \
  --query "Environment.Variables" \
  --region eu-north-1
```

**Assignment worker must have:**
```
DYNAMODB_ACTIVITY_LOGS_TABLE = ActivityLogs
AWS_REGION = eu-north-1
```

**Daily digest must have:**
```
SNS_DIGEST_TOPIC_ARN = arn:aws:sns:eu-north-1:YOUR_ACCOUNT:DailyDigestTopic
DYNAMODB_TASKS_TABLE = Tasks
AWS_REGION = eu-north-1
ENV = production
```

**Image resize must have:**
```
S3_RESIZED_BUCKET = mini-jira-resized-laksh-2026
DYNAMODB_TASKS_TABLE = Tasks
AWS_REGION = eu-north-1
THUMBNAIL_WIDTH = 400
THUMBNAIL_HEIGHT = 400
```

---

### 🟡 Step 11: Verify S3 Trigger is Wired to Image-Resize Lambda

The image-resize Lambda is triggered by S3 PUT events. Verify this exists:

```bash
aws s3api get-bucket-notification-configuration \
  --bucket mini-jira-originals-laksh-2026 \
  --region eu-north-1
```

If the output is empty `{}`, add the trigger manually:

```bash
# First get the Lambda ARN
LAMBDA_ARN=$(aws lambda get-function \
  --function-name image-resize-function \
  --query "Configuration.FunctionArn" \
  --output text \
  --region eu-north-1)

# Allow S3 to invoke the Lambda
aws lambda add-permission \
  --function-name image-resize-function \
  --statement-id s3-trigger \
  --action lambda:InvokeFunction \
  --principal s3.amazonaws.com \
  --source-arn arn:aws:s3:::mini-jira-originals-laksh-2026 \
  --region eu-north-1

# Add the S3 event notification
aws s3api put-bucket-notification-configuration \
  --bucket mini-jira-originals-laksh-2026 \
  --notification-configuration "{
    \"LambdaFunctionConfigurations\": [{
      \"LambdaFunctionArn\": \"$LAMBDA_ARN\",
      \"Events\": [\"s3:ObjectCreated:Put\"],
      \"Filter\": {
        \"Key\": {
          \"FilterRules\": [{
            \"Name\": \"prefix\",
            \"Value\": \"task-images/\"
          }]
        }
      }
    }]
  }"
```

---

### 🟡 Step 12: Verify SQS Queue is Subscribed to SNS Topic

The assignment worker Lambda drains SQS, but only if SQS is subscribed to the SNS topic.

```bash
# Check SNS subscriptions
aws sns list-subscriptions-by-topic \
  --topic-arn arn:aws:sns:eu-north-1:YOUR_ACCOUNT:TaskAssignmentsTopic \
  --region eu-north-1
```

You should see TWO subscriptions:
1. `Protocol: email` — assignee email notification
2. `Protocol: sqs` — feeds the assignment-worker Lambda

If the SQS subscription is missing:

```bash
# Get SQS queue ARN
QUEUE_ARN=$(aws sqs get-queue-attributes \
  --queue-url YOUR_SQS_QUEUE_URL \
  --attribute-names QueueArn \
  --query "Attributes.QueueArn" \
  --output text \
  --region eu-north-1)

# Subscribe SQS to SNS
aws sns subscribe \
  --topic-arn arn:aws:sns:eu-north-1:YOUR_ACCOUNT:TaskAssignmentsTopic \
  --protocol sqs \
  --notification-endpoint $QUEUE_ARN \
  --region eu-north-1
```

Also verify the Lambda has SQS as event source:

```bash
aws lambda list-event-source-mappings \
  --function-name assignment-worker \
  --region eu-north-1
```

---

### 🟡 Step 13: Verify EventBridge Rule Exists for Daily Digest

```bash
aws events list-rules \
  --name-prefix "DailyDigest" \
  --region eu-north-1 \
  --output table
```

If missing, create it:

```bash
# Create scheduled rule — 9:00 AM UTC daily
aws events put-rule \
  --name "DailyDigestRule" \
  --schedule-expression "cron(0 9 * * ? *)" \
  --state ENABLED \
  --region eu-north-1

# Get Lambda ARN
LAMBDA_ARN=$(aws lambda get-function \
  --function-name daily-digest \
  --query "Configuration.FunctionArn" \
  --output text \
  --region eu-north-1)

# Add Lambda permission for EventBridge
aws lambda add-permission \
  --function-name daily-digest \
  --statement-id eventbridge-trigger \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --region eu-north-1

# Wire rule to Lambda
aws events put-targets \
  --rule "DailyDigestRule" \
  --targets "Id=1,Arn=$LAMBDA_ARN" \
  --region eu-north-1
```

---

### 🟡 Step 14: Set Up CloudWatch Dashboard and Alarm

Run the setup script (make sure SNS_ALARM_TOPIC_ARN is set):

```bash
cd infra
SNS_ALARM_TOPIC_ARN=arn:aws:sns:eu-north-1:YOUR_ACCOUNT:TaskAssignmentsTopic \
REGION=eu-north-1 \
node setup-cloudwatch.cjs
```

Verify the dashboard was created:

```bash
aws cloudwatch list-dashboards --region eu-north-1
```

Verify the alarm:

```bash
aws cloudwatch describe-alarms \
  --alarm-names "MiniJira-OverdueTasks-High" \
  --region eu-north-1 \
  --query "MetricAlarms[0].{State:StateValue,Threshold:Threshold}"
```

---

### 🟡 Step 15: Run the DynamoDB Migration Script

This backfills the `entity = "TASK"` field on any existing tasks so they appear in the manager's view:

```bash
cd infra
AWS_REGION=eu-north-1 node db-migration.mjs
```

Expected output:
```
[ Tasks table ]
  ✓ entity-createdAt-index already exists — skipping
  ✓ assigneeId-createdAt-index already exists — skipping
[ ActivityLogs table ]
  ✓ taskId-timestamp-index already exists — skipping
[ Backfill entity field on Tasks ]
  ✓ Backfill complete — N tasks updated
✅ All migrations complete.
```

---

## Phase 3 — Demo Day Preparation

---

### 🟡 Step 16: Create the Three Demo Accounts in Cognito

You need these accounts ready before the demo. Create them in the AWS Cognito console or via CLI.

**Using AWS CLI:**

```bash
# Manager Ali
aws cognito-idp admin-create-user \
  --user-pool-id eu-north-1_CrMpMTx8z \
  --username ali@demo.com \
  --temporary-password "Demo1234!" \
  --user-attributes \
    Name=email,Value=ali@demo.com \
    Name=name,Value="Ali (Manager)" \
    Name="custom:role",Value=manager \
  --region eu-north-1

# Employee Sara (Frontend team)
aws cognito-idp admin-create-user \
  --user-pool-id eu-north-1_CrMpMTx8z \
  --username sara@demo.com \
  --temporary-password "Demo1234!" \
  --user-attributes \
    Name=email,Value=sara@demo.com \
    Name=name,Value="Sara" \
    Name="custom:role",Value=employee \
    Name="custom:teamId",Value=frontend \
  --region eu-north-1

# Employee Omar (Backend team)
aws cognito-idp admin-create-user \
  --user-pool-id eu-north-1_CrMpMTx8z \
  --username omar@demo.com \
  --temporary-password "Demo1234!" \
  --user-attributes \
    Name=email,Value=omar@demo.com \
    Name=name,Value="Omar" \
    Name="custom:role",Value=employee \
    Name="custom:teamId",Value=backend \
  --region eu-north-1
```

**Set permanent passwords (so no forced reset during demo):**

```bash
for USER in ali@demo.com sara@demo.com omar@demo.com; do
  aws cognito-idp admin-set-user-password \
    --user-pool-id eu-north-1_CrMpMTx8z \
    --username $USER \
    --password "Demo1234!" \
    --permanent \
    --region eu-north-1
done
```

**Subscribe demo emails to SNS task-assignment topic:**

```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:eu-north-1:YOUR_ACCOUNT:TaskAssignmentsTopic \
  --protocol email \
  --notification-endpoint ali@demo.com \
  --region eu-north-1
```

> Then check the inbox and click "Confirm subscription" in the email AWS sends.

---

### 🟢 Step 17: Test the Daily Digest Manually Before Demo

The EventBridge rule fires at 9 AM. To test it now without waiting:

```bash
aws lambda invoke \
  --function-name daily-digest \
  --payload '{}' \
  --region eu-north-1 \
  output.json && cat output.json
```

Expected: `{"statusCode":200,"body":"Processed N overdue tasks, 0 send failures"}`

---

### 🟡 Step 18: Verify EC2 Instances Are Running and Healthy

```bash
# Check ASG instance health
aws autoscaling describe-auto-scaling-groups \
  --query "AutoScalingGroups[?contains(AutoScalingGroupName,'MiniJiraStack')].Instances[*].{Id:InstanceId,Health:HealthStatus,AZ:AvailabilityZone}" \
  --output table

# Check ALB target health
TG_ARN=$(aws elbv2 describe-target-groups \
  --query "TargetGroups[?contains(TargetGroupName,'MiniJira')].TargetGroupArn" \
  --output text)

aws elbv2 describe-target-health \
  --target-group-arn $TG_ARN \
  --output table
```

Both instances should show `healthy`. If any are `unhealthy`:

```bash
# Check the backend logs on a specific instance
aws ssm send-command \
  --instance-ids INSTANCE_ID \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["pm2 logs backend --lines 50 --nostream"]' \
  --region eu-north-1 \
  --output text
```

---

### 🟡 Step 19: Push Final Code and Wait for CI/CD

After all code changes are committed:

```bash
git add -A
git commit -m "Fix frontend deployment, rate limiting, CORS, upload auth"
git push origin master
```

Watch the GitHub Actions pipeline complete successfully. The deploy job runs `pm2 reload backend --update-env` on all EC2 instances and invalidates the CloudFront cache.

After CI completes (~5 minutes), verify:

```bash
# Backend health check
curl https://YOUR_CLOUDFRONT.cloudfront.net/api/health
# Expected: {"status":"ok","service":"taskflow-api","timestamp":"..."}
```

---

## Phase 4 — Polish (Do If Time Allows)

---

### 🟢 Step 20: Add an Activity Log View in the Frontend

The backend endpoint `GET /api/tasks/:id/history` already returns the full audit trail. Add a simple timeline to the `TaskDetailModal`:

In `frontend/src/components/tasks/TaskDetailModal.jsx`, add before the comments section:

```jsx
import { useEffect, useState } from 'react';
import api from '../../services/api';

// Inside the component:
const [history, setHistory] = useState([]);

useEffect(() => {
  api.get(`/tasks/${currentTask.taskId}/history`)
    .then(res => setHistory(res.data))
    .catch(() => {});
}, [currentTask.taskId]);

// In the JSX, add after the status selector:
{history.length > 0 && (
  <div>
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
      Activity
    </p>
    <div className="space-y-2">
      {history.map((entry) => (
        <div key={entry.logId} className="flex items-start gap-2 text-xs text-muted-foreground">
          <div className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-1.5 shrink-0" />
          <span>
            <span className="text-foreground font-medium">{entry.action.replace('_', ' ')}</span>
            {' · '}
            {new Date(entry.timestamp).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  </div>
)}
```

This takes 15 minutes and directly demonstrates the audit trail during the demo.

---

### 🟢 Step 21: Fix KanbanBoard to Use Optimistic Update

**Problem:** After drag-and-drop, there is a visual flash because the board refetches from the server before updating.

**File:** `frontend/src/components/kanban/KanbanBoard.jsx`

Replace the `handleDragEnd` function:

```js
import { useUpdateTaskStatus } from '../../hooks/useTasks';

// Inside component:
const updateStatus = useUpdateTaskStatus();

const handleDragEnd = async ({ active, over }) => {
  setActiveTask(null);
  if (!over) return;

  const taskId = active.id;
  const newStatus = over.id;
  const task = tasks.find((t) => t.taskId === taskId);

  if (!task || task.status === newStatus) return;
  if (!STATUSES.includes(newStatus)) return;

  // Optimistic update — UI moves immediately, server sync in background
  updateStatus.mutate({ taskId, status: newStatus });
};
```

Remove the `reloadTasks` prop since `useUpdateTaskStatus` handles invalidation.

---

### 🟢 Step 22: Add Architecture Diagram to README

The assignment requires "Detailed architecture diagram illustrating the high availability setup using AWS standard icons."

If you don't have this yet:
1. Go to [draw.io](https://app.diagrams.net/) or [Lucidchart](https://lucidchart.com)
2. Import AWS icon set
3. Draw: Internet → CloudFront → ALB (in VPC) → two EC2 instances in two AZs → DynamoDB, S3, SNS, SQS, Lambda, EventBridge
4. Export as PNG and add to `README.md`:

```markdown
## Architecture Diagram

![Architecture](./architecture-diagram.png)
```

---

## Final Pre-Demo Checklist

Run through this the morning of the demo:

```
INFRASTRUCTURE
[ ] EC2 instances are running (not stopped)
[ ] ALB target health shows "healthy" for both instances
[ ] CloudFront distribution is Enabled
[ ] CloudFront URL opens the React app in a browser

AUTHENTICATION
[ ] Ali (manager) can log in — sees both tasks
[ ] Sara (employee, frontend team) can log in — sees only frontend tasks
[ ] Omar (employee, backend team) can log in — sees only backend tasks
[ ] Logging out and back in works

CORE FEATURES
[ ] Manager can create a task with image, title, priority, deadline, assignee
[ ] Image thumbnail appears on the task card
[ ] Drag-and-drop moves tasks between columns
[ ] Task detail panel opens, shows comments
[ ] Employee can add a comment
[ ] Employee can update status (not another team's task)
[ ] Manager can delete a task

AWS SERVICES (for evaluator demo)
[ ] SNS email arrives after task creation
[ ] CloudWatch dashboard shows data at: https://eu-north-1.console.aws.amazon.com/cloudwatch/home#dashboards:name=MiniJira
[ ] CloudWatch alarm is visible in the alarms list
[ ] Lambda functions visible in Lambda console
[ ] SQS queue visible, showing processed message count
[ ] EventBridge rule visible and enabled
[ ] DynamoDB tables visible: Tasks, Projects, Comments, ActivityLogs, Users, Teams
[ ] S3 buckets visible with uploaded images
[ ] S3 originals bucket shows Versioning: Enabled

DELIVERABLES
[ ] GitHub repo link is public
[ ] README.md has architecture diagram
[ ] README.md has the live CloudFront URL
[ ] Demo video recorded (if required)
[ ] Google Form submitted
[ ] EC2 instances are STOPPED (not terminated) after submission
```

---

## Quick Reference — Key AWS Resource Names

Update this table with your actual values:

| Resource | Name / ARN |
|---|---|
| Cognito User Pool | `eu-north-1_CrMpMTx8z` |
| Cognito Client ID | `7cs236u7nsfs9gi5ac43lj8s47` |
| S3 Originals Bucket | `mini-jira-originals-laksh-2026` |
| S3 Resized Bucket | `mini-jira-resized-laksh-2026` |
| SNS Task Topic | `TaskAssignmentsTopic` |
| SNS Digest Topic | `DailyDigestTopic` |
| Lambda: Image Resize | `image-resize-function` |
| Lambda: Assignment Worker | `assignment-worker` |
| Lambda: Daily Digest | `daily-digest` |
| CloudFront URL | `https://____________.cloudfront.net` |
| AWS Region | `eu-north-1` |

---

*Generated from the full senior technical review on 2026-05-22.*
*Estimated total time for Phase 1+2: 3–4 hours.*
*Phase 3 (demo prep): 1 hour.*
*Phase 4 (polish): 1–2 hours if time allows.*
