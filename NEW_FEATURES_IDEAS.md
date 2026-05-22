# New Feature Ideas — TaskFlow AWS

A prioritized backlog of features that would meaningfully extend the platform beyond its current state. Each item includes a rationale, rough effort estimate, and the AWS services involved.

---

## Priority 1 — High Impact, Feasible Now

### 1. Real-Time Notifications (WebSocket)
**What:** Push live task updates (status changes, new comments, assignments) to all connected clients without polling.  
**Why:** Currently users must refresh to see changes from teammates. Real-time collaboration is a baseline expectation for a Jira-class tool.  
**How:**
- API Gateway WebSocket API as the connection manager
- Lambda `$connect` / `$disconnect` handlers writing connection IDs to a DynamoDB `Connections` table (keyed by teamId + userId)
- Existing SNS events fan out to a new Lambda that queries the connections table and calls `ApiGatewayManagementApi.postToConnection()`
- Frontend Amplify `PubSub` or raw WebSocket URL from Cognito-signed handshake

**Effort:** Medium (3–5 days)  
**AWS Services:** API Gateway WebSocket, Lambda, DynamoDB, SNS

---

### 2. Task Activity Timeline
**What:** A per-task audit log showing every status change, comment, image upload, and assignment with actor + timestamp.  
**Why:** The existing `ActivityLogs` DynamoDB table already records assignments via the SQS worker. Extending it to capture all mutations provides full traceability — critical for accountability in team projects.  
**How:**
- Add a middleware or repository hook that writes an `ActivityLog` item on every task mutation
- New `GET /tasks/:id/activity` endpoint reads from the GSI `taskId-createdAt-index` on `ActivityLogs`
- Frontend renders a vertical timeline inside `TaskDetailModal` with icons per event type

**Effort:** Low-Medium (2–3 days)  
**AWS Services:** DynamoDB (existing table), Lambda (optional async write via SNS)

---

### 3. File Attachments (Multiple Files)
**What:** Allow tasks to have multiple attachments (PDFs, ZIPs, images) rather than a single image.  
**Why:** Real project work involves specs, designs, and reports — not just one screenshot.  
**How:**
- DynamoDB `attachments` list attribute on the Task item (array of `{ key, name, type, size, uploadedAt }`)
- New `POST /tasks/:id/attachments` endpoint that accepts multipart, uploads to S3 originals bucket, appends to the list
- Lambda thumbnail trigger already in place — extend it to skip non-image types
- Frontend: multi-file dropzone in `TaskDetailModal`, gallery grid with download links (presigned URLs)

**Effort:** Medium (3–4 days)  
**AWS Services:** S3, Lambda (existing resize), DynamoDB

---

### 4. @Mention Notifications in Comments
**What:** When a user types `@email` in a comment, that person receives an email notification.  
**Why:** Comments without notifications are effectively a message nobody reads. @mentions are the minimum viable notification contract.  
**How:**
- Parse comment content server-side for `@<email>` patterns
- Publish to the existing `TaskAssignmentsTopic` SNS topic with a new `type: "mention"` attribute
- Lambda subscriber sends email via SES (`ses:SendEmail`) with a deep link to the task
- Email template: plaintext + HTML, unsubscribe link stored in DynamoDB user preferences

**Effort:** Low-Medium (2–3 days)  
**AWS Services:** SNS (existing), SES, Lambda

---

## Priority 2 — High Value, Moderate Effort

### 5. Saved Filters & Personal Views
**What:** Users can save named filter combinations (status, priority, assignee, deadline range) and switch between them from the dashboard.  
**Why:** Power users on large teams need to cut the board down to their slice without re-setting filters every session.  
**How:**
- `UserPreferences` DynamoDB table (PK: `userId`) with a `savedFilters` list attribute
- `GET/PUT /me/preferences` endpoints (authenticated, no admin required)
- Frontend: "Save view" button in the filter bar; saved views displayed as chips that restore the full filter state on click
- Stored in DynamoDB rather than localStorage so they roam across devices

**Effort:** Medium (3–4 days)  
**AWS Services:** DynamoDB, API Gateway

---

### 6. Sprint / Milestone Support
**What:** Group tasks into time-boxed sprints (start date, end date, goal) and show a sprint progress bar on the dashboard.  
**Why:** Kanban alone is unbounded; sprints create the cadence and focus that universities and real teams require.  
**How:**
- New `Sprints` DynamoDB table (PK: `teamId`, SK: `sprintId`); tasks gain an optional `sprintId` attribute
- GSI `teamId-sprintId-index` for efficient "tasks in sprint" queries
- Dashboard filter adds a sprint dropdown; sprint card shows a burn-down metric (tasks closed vs. total)
- EventBridge scheduled rule triggers a "sprint ending soon" SNS notification 24 hours before end date

**Effort:** Medium-High (5–7 days)  
**AWS Services:** DynamoDB, EventBridge (existing pattern), SNS

---

### 7. CloudWatch Dashboard + Alarms
**What:** An embedded CloudWatch dashboard link in the app sidebar for managers, plus automatic alarms for overdue task spikes.  
**Why:** The project already publishes `OverdueTasks`, `TasksCreated`, and `TimeToCloseMs` custom metrics. Surfacing them inside the app completes the observability loop without extra infrastructure.  
**How:**
- Add `cloudwatch:GetDashboard` to the backend IAM role
- New `GET /admin/metrics/summary` endpoint that calls `CloudWatch.getMetricData()` for the last 7 days
- Frontend: `/metrics` protected route (managers only) with Recharts line/bar charts rendering the metric data
- Alarm: `aws cloudwatch put-metric-alarm` for `OverdueTasks > 10` → SNS → email to manager

**Effort:** Low (2 days, metrics already emitted)  
**AWS Services:** CloudWatch (existing metrics), SNS, IAM

---

### 8. Two-Factor Authentication (TOTP)
**What:** Optional TOTP-based MFA via Cognito's built-in MFA support.  
**Why:** Security hardening for a cloud-hosted multi-tenant app. Cognito supports TOTP natively — this is a configuration + frontend flow change, not infrastructure work.  
**How:**
- Enable `SOFTWARE_TOKEN_MFA` on the Cognito User Pool (Terraform one-liner)
- Handle `MFA_SETUP` and `SOFTWARE_TOKEN_MFA` challenge steps in `LoginPage` (Amplify `confirmSignIn` with `TOTP_CODE`)
- Add `/settings/security` page with QR code enrollment flow using `setUpTOTP()` + `verifyTOTPSetup()`

**Effort:** Low-Medium (2–3 days)  
**AWS Services:** Cognito (existing), Amplify v6

---

## Priority 3 — Longer-Term / Architecture Extensions

### 9. Task Search with OpenSearch
**What:** Full-text search across task titles, descriptions, and comments.  
**Why:** DynamoDB scans are expensive and don't support relevance ranking. Once the task count grows past a few hundred, search becomes essential.  
**How:**
- DynamoDB Streams → Lambda → OpenSearch (managed) indexing pipeline
- New `GET /tasks/search?q=` endpoint hits OpenSearch, returns taskIds, then batch-fetches from DynamoDB
- Frontend: command-palette (`⌘K`) with debounced search input and instant results

**Effort:** High (1–2 weeks including OpenSearch provisioning)  
**AWS Services:** OpenSearch Service, DynamoDB Streams, Lambda

---

### 10. Recurring Tasks via EventBridge
**What:** Tasks that auto-create on a schedule (daily standup prep, weekly review, monthly report).  
**Why:** Repetitive task creation is manual overhead; automating it is a natural extension of the existing EventBridge daily-digest pattern.  
**How:**
- `RecurringTaskTemplates` DynamoDB table with a cron expression per template
- EventBridge Scheduler (not just a rule) with a per-template schedule that invokes a Lambda
- Lambda clones the template into a real task and triggers the existing assignment SNS pipeline

**Effort:** Medium (3–4 days)  
**AWS Services:** EventBridge Scheduler, Lambda, DynamoDB, SNS (existing)

---

### 11. Mobile App (React Native + Amplify)
**What:** A native iOS/Android companion app with push notifications via SNS Mobile Push.  
**Why:** Task management on mobile is the primary consumption pattern. The existing Cognito + API Gateway backend is already mobile-ready.  
**How:**
- React Native (Expo) + `@aws-amplify/react-native`
- SNS Platform Applications for APNS / FCM; device token registered on login
- Existing task-assignment Lambda extended to call `SNS.publish()` to the device endpoint
- Offline-first via WatermelonDB sync + API Gateway

**Effort:** Very High (3–4 weeks)  
**AWS Services:** SNS Mobile Push, Cognito (existing), API Gateway (existing)

---

## Quick Wins (< 1 day each)

| Idea | Description |
|------|-------------|
| **Keyboard shortcuts** | `N` to open new task, `Esc` to close modal, `⌘/` for help overlay |
| **Bulk status update** | Checkbox multi-select on task cards + batch update endpoint |
| **Task templates** | Pre-filled forms for common task types (bug, feature, review) |
| **Export to CSV** | Manager can download all tasks as CSV via a presigned S3 URL |
| **Dark/light toggle** | Theme switcher persisted to `UserPreferences` DynamoDB |
| **Deadline reminders** | EventBridge rule checks tasks 24h before deadline, publishes SNS notification |
| **Comment reactions** | Emoji reactions stored as a map attribute on comment items |
| **Task duplication** | "Duplicate task" button in detail modal creates a copy with TODO status |
