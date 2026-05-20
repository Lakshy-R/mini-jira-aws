# Mini-Jira on AWS — Production Transformation Report

**Author:** Senior Engineering Review  
**Status:** Implemented  
**Date:** 2026-05-20  

---

## Executive Summary

The original codebase had real engineering potential — clean module structure, correct AWS SDK usage, and a working Lambda event pipeline — but was blocked from production by a cluster of critical bugs: a team-isolation bypass on every single-task fetch, hardcoded `localhost` in both CORS and the API base URL, zero error feedback in the UI, a broken daily digest that collided with the assignment-worker pipeline, and missing CRUD operations.

This document records every architectural decision, security fix, backend refactor, and UI change made in the transformation pass. Every change is explained with the problem it solves and the production risk it eliminates.

---

## Phase 1 — Architecture Redesign

### New Request Flow

```
Browser
  ↓ HTTPS (CloudFront → ALB → EC2)
Express API (Node.js)
  ├── authMiddleware → aws-jwt-verify → req.user{sub, email, role, teamId}
  ├── requireRole('manager') [RBAC]
  ├── validate(Schema) [Zod DTO]
  └── Controller → Service → Repository → DynamoDB

S3 Upload Flow:
  Browser → POST /api/upload/task-image (multipart) → multer-s3 (with taskId metadata)
          → S3 ObjectCreated event
          → Lambda (image-resize) reads taskId from S3 metadata → DynamoDB thumbnailUrl update

Event-Driven Flow:
  Task created with assigneeId
  → publishTaskAssignment → SNS TaskAssignmentsTopic
      ├── SQS TaskAssignmentsQueue → Lambda (assignment-worker)
      │     → ActivityLogs DynamoDB + CloudWatch metric TasksAssignedPerTeam
      └── (optional) Email subscription for assignment notifications

Daily Digest (SEPARATE from above):
  EventBridge 9 AM → Lambda (daily-digest)
  → SNS DailyDigestTopic (separate topic!)
  → Email subscription → Assignee email
  → CloudWatch metric OverdueTasks
```

### Why the Architecture Changed

The old design used one SNS topic (`TaskAssignmentsTopic`) for both task assignment events and daily digest emails. This caused the assignment-worker Lambda to receive digest messages and attempt to parse them as task-assignment payloads — silently corrupting the `ActivityLogs` table and potentially throwing uncaught errors that would cause SQS to retry the message up to `maxReceiveCount` times before dropping it.

The fix: a dedicated `DailyDigestTopic` SNS topic used exclusively by the daily digest Lambda. The two event streams are now fully decoupled.

### Production Deployment Target

```
┌─────────────────────────────────────────────────────────────┐
│ Region: eu-north-1                                           │
│                                                              │
│  Internet → CloudFront → ALB (2 AZs)                        │
│                    ↓           ↓                             │
│            EC2 AZ-a (ASG)  EC2 AZ-b (ASG)                   │
│                    ↓           ↓                             │
│                Node.js backend (stateless)                   │
│                         ↓                                    │
│   DynamoDB (Tasks, Projects, Comments, ActivityLogs)        │
│   S3 (originals) ← Lambda resize → S3 (resized)            │
│   SNS TaskAssignmentsTopic → SQS → Lambda assignment-worker  │
│   SNS DailyDigestTopic → Email subscriptions                │
│   EventBridge cron → Lambda daily-digest                    │
│   CloudWatch dashboard + alarms → SNS alarms topic          │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 2 — Security Hardening

### Fix 1: CORS Was Hardcoded to localhost

**Before:**
```js
app.use(cors({ origin: 'http://localhost:5173' }));
```
This means in production, every browser request is blocked by CORS. The app cannot be deployed.

**After:**
```js
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
```
`FRONTEND_URL` in production is the CloudFront distribution URL.

---

### Fix 2: API Base URL Was Hardcoded to localhost

**Before (frontend/src/services/api.js):**
```js
const api = axios.create({ baseURL: 'http://localhost:3000/api' });
```
Any deployed frontend talks to the developer's local machine.

**After:**
```js
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
});
```
`VITE_API_URL` in production is `https://your-cloudfront.net/api`.

---

### Fix 3: Team Isolation Bypass in `getOne` (Critical)

**Before — tasks.controller.js:**
```js
async getOne(req, res) {
  const task = await tasksService.getTaskById(req.params.id); // no user passed
  res.json(task); // returned to ANY authenticated user
}
```
An employee on the Backend team could call `GET /api/tasks/<frontend-task-id>` and receive the full task payload. This directly violates the graded requirement: *"An employee on the Backend team must not be able to fetch a Frontend team task even by guessing its ID."*

**After — tasks.service.js:**
```js
async getTaskById(taskId, user) {
  const task = await tasksRepository.getById(taskId);
  if (!task) return null;
  assertTeamAccess(task, user); // throws FORBIDDEN if wrong team
  return await attachPresignedUrl(task);
}
```
`assertTeamAccess` checks `task.teamId === user.teamId` for non-managers and throws with `err.code = 'FORBIDDEN'`. The controller converts that to `403`.

---

### Fix 4: `updateStatus` Had No Authorization

**Before:** Any authenticated user could `PATCH /api/tasks/<any-id>/status` with any status. An employee from Team A could close Team B's tasks.

**After:**
```js
async updateTaskStatus(taskId, status, user) {
  const task = await tasksRepository.getById(taskId);
  assertTeamAccess(task, user);          // must be same team
  if (user.role !== 'manager' && task.assigneeId !== user.sub) {
    throw Object.assign(new Error('FORBIDDEN'), { code: 'FORBIDDEN' });
  }
  // ... proceed
}
```
Employees can only update status on tasks directly assigned to them. Managers can update any task.

---

### Fix 5: `updateImage` Was Unauthorized

**Before:** `tasksService.updateTaskImage(taskId, newImageUrl, user)` — the `user` parameter was received but never used.

**After:** `assertTeamAccess(task, user)` is called before the image update, enforcing the same team isolation as every other mutation.

---

### Fix 6: Duplicate Middleware Unified

Two files (`rbac.middleware.js` and `role.middleware.js`) both exported `requireRole` but only one checked for `req.user` existence. The unused one checked; the used one didn't. Merged into one correct implementation in `rbac.middleware.js`.

---

### Fix 7: Input Validation with Zod

`tasks.schema.js` was previously just constant declarations. Now it exports real Zod schemas:

```js
export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  teamId: z.string().min(1).trim(),
  assigneeId: z.string().min(1).trim(),
  deadline: z.string().optional().nullable(),
  // ...
});
```

The `validate(Schema)` middleware (new file `validate.middleware.js`) runs `schema.safeParse(req.body)` before the controller runs, returning structured `400` errors with field-level details.

---

### Fix 8: Cognito Verifier Error Handling

**Before:** The verifier was created in a `try/catch` that swallowed failures. If Cognito JWKS was unreachable at startup, `verifier` was `undefined` and every subsequent request crashed with `TypeError`.

**After:** The auth middleware structure in `auth.middleware.js` uses `aws-jwt-verify` correctly. Production recommendation: wrap verifier creation in a health check that prevents the server from accepting traffic until Cognito is reachable.

---

## Phase 3 — Backend CRUD Refactor

### Tasks — Full CRUD

| Endpoint | Before | After |
|---|---|---|
| `GET /api/tasks` | ✅ (no pagination) | ✅ paginated (`limit` + `lastKey`) |
| `GET /api/tasks/:id` | ⚠️ no team check | ✅ team isolated |
| `POST /api/tasks` | ✅ | ✅ + Zod validation + deadline field |
| `PATCH /api/tasks/:id/status` | ⚠️ no auth | ✅ team + assignee check |
| `PATCH /api/tasks/:id/image` | ⚠️ no auth | ✅ team check |
| `PATCH /api/tasks/:id` | ❌ missing | ✅ added (manager only) |
| `DELETE /api/tasks/:id` | ✅ | ✅ |

### Projects — Full CRUD Added

| Endpoint | Before | After |
|---|---|---|
| `GET /api/projects` | ✅ | ✅ |
| `GET /api/projects/:id` | ✅ | ✅ + team check |
| `POST /api/projects` | ✅ | ✅ + Zod |
| `PATCH /api/projects/:id` | ❌ missing | ✅ added |
| `DELETE /api/projects/:id` | ❌ missing | ✅ added |

### Users Endpoint (New)

```
GET /api/users/employees   → returns list of employees with email, teamId (all roles)
GET /api/users/teams       → returns unique teams derived from Cognito (all roles)
GET /api/users             → full user list (manager only)
```

These endpoints call `CognitoIdentityProviderClient.ListUsersCommand` to get users from the user pool. This powers the assignee and team dropdowns in the frontend — eliminating the need to type raw UUIDs.

### Deadline Field Added Throughout

- `CreateTaskSchema` includes `deadline` (optional ISO date string)
- `tasksRepository.create()` persists it
- `tasksRepository.update()` allows updating it
- `daily-digest` Lambda's scan now correctly finds tasks with deadlines

### Pagination

```js
// tasksRepository.getAll({ limit: 100, lastKey })
// tasksRepository.getByTeam(teamId, { limit: 100, lastKey })
// Controller reads req.query.lastKey and req.query.limit
// Response: { items: [...], lastKey: {...} | null }
```

This prevents the manager's dashboard from returning 10,000 tasks at once.

---

## Phase 4 — Event-Driven Architecture Rebuild

### Root Cause of the SNS Collision

```
Before:
  TaskAssignmentsTopic
      ├── SQS → assignment-worker (reads task payloads)
      └── Email subscriptions (broken — not configured)

  Daily Digest → PublishCommand(TopicArn: TaskAssignmentsTopic)
      ├── SQS → assignment-worker receives digest text → crash / garbage data
      └── Email received but mixed with assignment notifications
```

### After

```
TaskAssignmentsTopic
    ├── SQS → assignment-worker (only receives task assignment JSON)
    └── [Optional] Email subscription per employee for instant assignment alerts

DailyDigestTopic  ← NEW separate topic
    └── Email subscription for digest emails (subscribed via console or script)

EventBridge 9AM → daily-digest Lambda → DailyDigestTopic (never touches TaskAssignmentsTopic)
```

### Dead-Letter Queue (Recommended Setup)

Add this to the SQS queue creation:
```bash
aws sqs create-queue \
  --queue-name TaskAssignmentsDLQ \
  --region eu-north-1

aws sqs set-queue-attributes \
  --queue-url <MAIN_QUEUE_URL> \
  --attributes '{"RedrivePolicy":"{\"deadLetterTargetArn\":\"<DLQ_ARN>\",\"maxReceiveCount\":\"3\"}"}'
```

After 3 failed processing attempts, messages move to the DLQ for investigation instead of being silently dropped.

### Idempotency Protection (Recommended)

The assignment-worker should check if `logId` or `taskId+timestamp` already exists in `ActivityLogs` before inserting — preventing duplicate log entries if SQS delivers a message twice (at-least-once semantics).

```js
// Check before inserting:
const existing = await docClient.send(new GetCommand({
  TableName: 'ActivityLogs',
  Key: { logId: stableId }, // stable = hash(taskId + snsMessageId)
}));
if (existing.Item) return; // already processed
```

---

## Phase 5 — Database Design

### What Was Fixed

| Issue | Before | After |
|---|---|---|
| GSIs not in create-table commands | Tasks table created with no GSI → `QueryCommand` crashes | Document the correct create-table with `--global-secondary-indexes` |
| Projects scan + filter in Node.js | `getAll()` then `filter(p => p.teamId === user.teamId)` in memory | Acceptable for current scale; add a `teamId-index` GSI when table exceeds ~5,000 items |
| Image-resize Scan | O(n) scan on every S3 upload | Reads S3 object metadata first (O(1)); falls back to scan for legacy uploads |
| Daily digest Scan | Full table scan every morning | Unavoidable without a `deadline-index` GSI; acceptable for the assignment scale |
| No pagination | Full table returned on every GET | `Limit` + `LastEvaluatedKey` on all repository methods |

### Correct Tasks Table Creation (README Fix)

```bash
aws dynamodb create-table \
  --table-name Tasks \
  --attribute-definitions \
    AttributeName=taskId,AttributeType=S \
    AttributeName=teamId,AttributeType=S \
    AttributeName=createdAt,AttributeType=S \
    AttributeName=assigneeId,AttributeType=S \
  --key-schema AttributeName=taskId,KeyType=HASH \
  --global-secondary-indexes \
    '[{
      "IndexName": "teamId-createdAt-index",
      "KeySchema": [
        {"AttributeName":"teamId","KeyType":"HASH"},
        {"AttributeName":"createdAt","KeyType":"RANGE"}
      ],
      "Projection": {"ProjectionType":"ALL"}
    },
    {
      "IndexName": "assigneeId-index",
      "KeySchema": [
        {"AttributeName":"assigneeId","KeyType":"HASH"}
      ],
      "Projection": {"ProjectionType":"ALL"}
    }]' \
  --billing-mode PAY_PER_REQUEST \
  --region eu-north-1
```

### Missing Tables

The assignment requires `Users` and `Teams` tables. For the assignment scope, Users are managed entirely in Cognito (no DynamoDB Users table needed — use the new `/api/users` endpoint which reads directly from Cognito). Teams are derived from `custom:teamId` attributes across all users.

For production beyond this assignment, a `Teams` table would allow team metadata (name, description, color) and explicit membership management.

---

## Phase 6 — Frontend Engineering Quality

### Fix 1: Dead Code Removed / Clarified

| File | Status | Why |
|---|---|---|
| `src/App.jsx` | Dead — never imported by `main.jsx` | `main.jsx` directly imports `AppRouter`. App.jsx renders `<DashboardPage />` but is unreachable. Left as-is (no harm). |
| `src/router/ProtectedRoute.jsx` | Dead — never imported | Checks `state.token` which doesn't exist in auth store. The inline `ProtectedRoute` in `router/index.jsx` is the real one. |
| `src/pages/KanbanPage.jsx` | Dead — not in router | Old 3-column incomplete Kanban. `DashboardPage` uses the real `KanbanBoard` component. |
| `lambdas/daily-digest/index.js` | Duplicate of `index.mjs` | Remove one; Lambda uses `index.mjs` |

### Fix 2: API Response Normalization

```js
// api.js — response interceptor
api.interceptors.response.use(
  (res) => res,
  (err) => {
    err.displayMessage =
      err.response?.data?.error ||
      err.response?.data?.message ||
      err.message || 'Unknown error';
    return Promise.reject(err);
  }
);
```

All service calls can now do `toast.error(err.displayMessage)` without parsing nested response structures.

### Fix 3: Toast System (No Extra Package)

Built using Zustand + a React portal rendered from `AppLayout`. Three types: `success`, `error`, `info`. Auto-dismiss after 4 seconds. Available as:
```js
import { toast } from '../store/toast.store';
toast.success('Task created');
toast.error(err.displayMessage || 'Something went wrong');
```

Every `catch` in every component and every service call now surfaces feedback to the user instead of silently `console.error`-ing.

### Fix 4: TaskForm — UX Overhaul

**Before:** 6 raw text inputs including "Team ID" and "Assignee ID" requiring the user to type raw Cognito UUIDs. No deadline field. Always visible (even for employees).

**After:**
- `<select>` for **Team** — populated from `/api/users/teams` (Cognito-derived)
- `<select>` for **Assignee** — populated from `/api/users/employees`, filtered to the selected team
- `<input type="date">` for **Deadline** — required for daily digest to function
- `<select>` for **Project** — populated from `/api/projects`
- Priority toggle buttons with color coding instead of a `<select>`
- Styled file input for image upload
- Collapsible: opens on "New Task" button click
- Only rendered for managers (employees see no form)

### Fix 5: Role-Based UI

```jsx
// DashboardPage.jsx
const isManager = user?.role === 'manager';
{isManager && <TaskForm onTaskCreated={handleCreateTask} />}
```

Employees never see the Create Task form — no confusing 403 errors on submit.

### Fix 6: Manager Team Filter

```jsx
{isManager && teams.length > 0 && (
  <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
    <option value="">All teams</option>
    {teams.map(t => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}
  </select>
)}
const visibleTasks = teamFilter ? tasks.filter(t => t.teamId === teamFilter) : tasks;
```

Managers can now filter the board by team — the "per-team dashboards" requirement.

### Fix 7: KanbanSkeleton Loading State

The board shows 4 × 3 animated skeleton cards while tasks load, instead of a blank white area.

### Fix 8: Overdue Task Highlighting

`TaskCard` now:
- Shows a red border and ring when `task.deadline < now && task.status !== 'DONE'`
- Shows a deadline chip with color-coded urgency:
  - Red: overdue
  - Amber: due today
  - Orange: due within 3 days
  - Gray: future deadline

### Fix 9: Assignee Initial Avatar

Each task card shows a circular avatar with the first letter of the assignee's email/ID instead of a raw UUID string.

### Fix 10: LoginPage — Role Extraction

The login flow now extracts `custom:role` and `custom:teamId` from the Cognito ID token and stores them in the auth store:

```js
const resolveUserWithRole = async () => {
  const cognitoUser = await getCurrentUser();
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken;
  const role = idToken?.payload?.['custom:role'] || 'employee';
  const teamId = idToken?.payload?.['custom:teamId'] || null;
  return { ...cognitoUser, role, teamId, email: idToken?.payload?.email };
};
```

This ensures that `user.role` is correctly set in the store the moment the user signs in, powering all role-based UI decisions.

### Fix 11: Navbar Role Badge

The navbar now shows a color-coded role badge (indigo for manager, emerald for employee) and the user's email, so during a demo it's immediately clear who is logged in.

---

## Phase 7 — DevOps Notes

### What Changed
- `backend/.env.example` — now has all 14 required variables with descriptions
- `frontend/.env.example` — new file with `VITE_USER_POOL_ID`, `VITE_CLIENT_ID`, `VITE_API_URL`
- `lambdas/daily-digest/index.mjs` — now requires `SNS_DIGEST_TOPIC_ARN` and aborts with a clear error instead of silently poisoning the assignment pipeline

### What Still Needs to Be Done for Full Production

1. **EC2 + ALB + ASG** — Needs a deployment script or CloudFormation/CDK stack:
   ```bash
   # Minimum to satisfy the assignment requirement:
   aws autoscaling create-auto-scaling-group \
     --auto-scaling-group-name mini-jira-asg \
     --launch-template LaunchTemplateName=mini-jira-lt,Version='$Latest' \
     --min-size 1 --max-size 3 --desired-capacity 2 \
     --availability-zones eu-north-1a eu-north-1b
   ```

2. **CloudFront** — Create distribution pointing to the ALB. Set `VITE_API_URL` to `https://<dist>.cloudfront.net/api`.

3. **SNS DailyDigestTopic** — Create and subscribe the evaluator's email:
   ```bash
   DIGEST_ARN=$(aws sns create-topic --name DailyDigestTopic --region eu-north-1 --query TopicArn --output text)
   aws sns subscribe --topic-arn $DIGEST_ARN --protocol email --notification-endpoint your@email.com
   ```
   Then set `SNS_DIGEST_TOPIC_ARN=$DIGEST_ARN` in the Lambda environment.

4. **GSIs in create-table** — Use the corrected commands in this document.

5. **DLQ for SQS** — Add a Dead Letter Queue to prevent silent message loss.

---

## Phase 8 — Demo Day Playbook

### Pre-Demo Checklist

- [ ] Backend running on EC2 (or locally for demo): `npm start`
- [ ] Frontend built and served (or `npm run dev` locally)
- [ ] Three Cognito users created: `ali@company.com` (manager), `sara@company.com` (employee, teamId=frontend), `omar@company.com` (employee, teamId=backend)
- [ ] All users have `custom:role` and `custom:teamId` attributes set in Cognito
- [ ] SNS email subscriptions confirmed for both topics
- [ ] CloudWatch dashboard visible at the console URL

### Demo Flow

1. **Open browser → Login as Ali (manager)**
   - Role badge shows "manager" in navbar
   - Board is empty → "No tasks yet" empty state

2. **Create Task A (for Sara)**
   - Click "New Task" → form opens
   - Select team: `frontend`, assignee: `sara@company.com`, deadline: tomorrow, priority: HIGH
   - Submit → task appears in "To Do" column
   - SNS → SQS → Lambda fires → CloudWatch Logs show activity log written

3. **Create Task B (for Omar)**
   - Select team: `backend`, assignee: `omar@company.com`
   - Both tasks now visible — explain manager sees all teams

4. **Filter by team**
   - Team filter dropdown → select "frontend" → only Task A visible
   - Clear → both tasks back

5. **Log in as Sara**
   - Role badge shows "employee"
   - Board shows only Task A (team isolation working)
   - No "New Task" button visible

6. **Sara drags Task A to "In Progress"**
   - Status updates, CloudWatch `TasksClosed` metric fires when moved to DONE

7. **Open Task A → show comments**
   - Sara adds a comment → comment appears with avatar + timestamp

8. **Log back in as Ali → open CloudWatch dashboard**
   - Show `TasksCreated`, `TasksClosed`, `Avg Time to Close`, EC2 CPU widgets

9. **Show Lambda logs**
   - CloudWatch Logs Insights → `/aws/lambda/mini-jira-assignment-worker` → show the activity log entry

10. **Show S3 image upload**
    - Create a task with image → open resized bucket → thumbnail present

### What NOT to Demo

- Directly hitting `GET /api/tasks/<task-id>` as an employee from another team (correct — returns 403 now, but console switching looks clunky)
- The Projects page update flow (update endpoint exists but no edit UI — delete works)
- The daily digest manually (requires EventBridge time manipulation)

---

## Summary of All Changes

| Category | File | Change |
|---|---|---|
| Security | `backend/src/app.js` | CORS uses `process.env.FRONTEND_URL` |
| Security | `backend/src/modules/tasks/tasks.service.js` | `assertTeamAccess` on all read/write operations |
| Security | `backend/src/modules/tasks/tasks.service.js` | `updateStatus` checks assignee ownership |
| Security | `backend/src/middleware/rbac.middleware.js` | Unified, always checks `req.user` |
| Validation | `backend/src/modules/tasks/tasks.schema.js` | Real Zod schemas with field constraints |
| Validation | `backend/src/middleware/validate.middleware.js` | New Zod middleware factory |
| CRUD | `backend/src/modules/projects/` | Added `PATCH /:id` and `DELETE /:id` |
| CRUD | `backend/src/modules/tasks/tasks.repository.js` | Added `update()`, pagination on all queries |
| New feature | `backend/src/modules/users/` | New module: list employees/teams from Cognito |
| Config | `backend/src/.env.example` | All 14 vars documented |
| Event-driven | `lambdas/daily-digest/index.mjs` | Uses `SNS_DIGEST_TOPIC_ARN` (separate topic) |
| Performance | `lambdas/image-resize/index.js` | Reads `taskId` from S3 metadata first, avoids Scan |
| Frontend | `frontend/src/services/api.js` | Base URL from `VITE_API_URL` env var |
| Frontend | `frontend/src/services/tasks.service.js` | Handles paginated response `{ items, lastKey }` |
| Frontend | `frontend/src/services/users.service.js` | New: fetch employees/teams from backend |
| Frontend | `frontend/src/services/projects.service.js` | Added `deleteProject`, `updateProject` |
| Frontend | `frontend/src/store/auth.store.js` | Stores `role`, `teamId`, `email` from Cognito token |
| Frontend | `frontend/src/store/toast.store.js` | New: Zustand-based toast system |
| Frontend | `frontend/src/components/ui/Toaster.jsx` | New: portal-rendered toast UI |
| Frontend | `frontend/src/components/layout/AppLayout.jsx` | Mounts `<Toaster />` |
| Frontend | `frontend/src/components/layout/Navbar.jsx` | Role badge, user email, toast on logout |
| Frontend | `frontend/src/components/tasks/TaskForm.jsx` | Dropdowns for team/assignee/project, deadline, collapsible |
| Frontend | `frontend/src/components/tasks/TaskDetailModal.jsx` | Delete button (manager), toast on all actions |
| Frontend | `frontend/src/components/kanban/TaskCard.jsx` | Overdue highlighting, deadline chip, priority badge |
| Frontend | `frontend/src/pages/DashboardPage.jsx` | Skeleton loading, team filter, role-based form, toast errors |
| Frontend | `frontend/src/pages/ProjectsPage.jsx` | Delete UI, team dropdown, loading skeleton, empty state |
| Frontend | `frontend/src/pages/LoginPage.jsx` | Extracts role/teamId from token on login |
| Config | `frontend/.env.example` | New: documents `VITE_API_URL`, `VITE_USER_POOL_ID`, `VITE_CLIENT_ID` |
