I now have a complete picture of the entire codebase. Let me write the full review.

  ---
  Mini-Jira on AWS — Senior Technical Review
  
  ---
  1. Overall Project Ratings

  ┌──────────────────────┬──────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │      Dimension       │  Score   │                                                                    Summary                                                                     │
  ├──────────────────────┼──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Architecture         │ 4/10     │ Good backend structure, but the entire HA layer (ALB, ASG, CloudFront, VPC) exists only in the README as manual instructions — not provisioned │
  ├──────────────────────┼──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Backend              │ 6/10     │ Clean module pattern, but hardcoded CORS, critical auth gaps, and missing CRUD                                                                 │
  ├──────────────────────┼──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Frontend/UI          │ 6/10     │ Kanban + dnd-kit is good, modal is polished, but dead code, hardcoded URLs, missing deadline input                                             │
  ├──────────────────────┼──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ AWS Infrastructure   │ 5/10     │ Lambda pipeline (SNS→SQS→Worker, EventBridge→Digest) is solid; EC2/ALB/ASG/CloudFront/VPC are absent from any deployable code                  │
  ├──────────────────────┼──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Security             │ 3/10     │ Critical team-isolation bypass on getOne and updateStatus; CORS locked to localhost                                                            │
  ├──────────────────────┼──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Scalability          │ 3/10     │ Full-table Scan on every hot path; no pagination; no DLQ on SQS                                                                                │
  ├──────────────────────┼──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Code Quality         │ 6/10     │ Good patterns, but duplicate middleware, dead files, uuid generated twice in repository                                                        │
  ├──────────────────────┼──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Database Design      │ 4/10     │ Missing Users and Teams tables entirely; GSIs absent from setup scripts; Projects filtered in-memory                                           │
  ├──────────────────────┼──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ DevOps/Deployment    │ 3/10     │ No IaC, no Dockerfile, no CI/CD; PowerShell-only manual deployment                                                                             │
  ├──────────────────────┼──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Event-Driven Arch    │ 7/10     │ SNS→SQS→Lambda→CW and EventBridge→Digest all wired; daily digest publishes to the assignment topic (logical bug)                               │
  ├──────────────────────┼──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Production Readiness │ 2/10     │ API base URL and CORS are hardcoded to localhost; no HA infrastructure deployed                                                                │
  ├──────────────────────┼──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Overall Grade        │ 4.5 / 10 │ ~C+ / 65% — Many pieces exist but critical deployment, security, and completeness gaps prevent it from meeting the full spec                   │
  └──────────────────────┴──────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  ---
  2. Requirement Coverage Analysis

  Authentication

  ┌───────────────────────────────────┬────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │            Requirement            │ Status │                                                                        Notes                                                                         │
  ├───────────────────────────────────┼────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Cognito User Pool sign-in /       │ ✅     │ AWS Amplify + aws-jwt-verify correctly wired                                                                                                         │
  │ sign-up                           │        │                                                                                                                                                      │
  ├───────────────────────────────────┼────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Token validated by backend on     │ ⚠️      │ Auth routes apply authMiddleware per-router correctly, but app.js has // app.use(authMiddleware) commented out with the note "DO NOT apply globally  │
  │ every request                     │        │ yet" — global safety net is deliberately disabled                                                                                                    │
  ├───────────────────────────────────┼────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Role stored in Cognito custom     │ ✅     │ custom:role and custom:teamId extracted from ID token                                                                                                │
  │ attributes                        │        │                                                                                                                                                      │
  ├───────────────────────────────────┼────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Team membership in Cognito        │ ✅     │ Used correctly in getTasks                                                                                                                           │
  └───────────────────────────────────┴────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  Role-Based Access

  ┌──────────────────────────┬────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │       Requirement        │ Status │                                                                             Notes                                                                             │
  ├──────────────────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Manager sees all tasks   │ ✅     │ Checked in tasksService.getTasks()                                                                                                                            │
  ├──────────────────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Employee sees only own   │ ⚠️      │ Correct for GET /tasks list, BROKEN for GET /tasks/:id — getOne does a plain DynamoDB GetCommand with zero team check. An employee on the Backend team can    │
  │ team tasks               │        │ fetch Frontend tasks by guessing IDs. This is the primary graded requirement.                                                                                 │
  ├──────────────────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Manager creates tasks    │ ✅     │ requireRole('manager') on POST                                                                                                                                │
  ├──────────────────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Manager deletes tasks    │ ✅     │ requireRole('manager') on DELETE                                                                                                                              │
  ├──────────────────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Employee updates task    │ ⚠️      │ PATCH /tasks/:id/status has no role or team check at all — any employee of any team can change any task's status. No ownership check in service layer either. │
  │ status                   │        │                                                                                                                                                               │
  ├──────────────────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Employee updates task    │ ❌     │ PATCH /tasks/:id/image has no team check. tasksService.updateTaskImage accepts user param but ignores it entirely.                                            │
  │ image                    │        │                                                                                                                                                               │
  └──────────────────────────┴────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  CRUD Completeness

  ┌──────────────────────────┬────────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │        Operation         │ Status │                                                              Notes                                                              │
  ├──────────────────────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Tasks: Create            │ ✅     │ Working                                                                                                                         │
  ├──────────────────────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Tasks: Read (list)       │ ✅     │ Team-filtered for employees                                                                                                     │
  ├──────────────────────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Tasks: Read (single)     │ ❌     │ No team isolation — security hole                                                                                               │
  ├──────────────────────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Tasks: Update (status)   │ ⚠️      │ Works, but no authorization                                                                                                     │
  ├──────────────────────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Tasks: Update (image)    │ ⚠️      │ Works, but no authorization                                                                                                     │
  ├──────────────────────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Tasks: Delete            │ ✅     │ Manager-only, deletes S3 image                                                                                                  │
  ├──────────────────────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Projects: Create         │ ✅     │ Manager-only                                                                                                                    │
  ├──────────────────────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Projects: Read           │ ✅     │ Team-filtered in memory                                                                                                         │
  ├──────────────────────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Projects: Update         │ ❌     │ No PUT/PATCH endpoint exists                                                                                                    │
  ├──────────────────────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Projects: Delete         │ ❌     │ No DELETE endpoint exists                                                                                                       │
  ├──────────────────────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Comments: Create         │ ✅     │ With team access check                                                                                                          │
  ├──────────────────────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Comments: Read           │ ✅     │ With team access check                                                                                                          │
  ├──────────────────────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Comments: Delete         │ ✅     │ Author or manager only                                                                                                          │
  ├──────────────────────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Comments: Update         │ ❌     │ No PATCH endpoint                                                                                                               │
  ├──────────────────────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Image upload             │ ✅     │ multer-s3 to originals bucket                                                                                                   │
  ├──────────────────────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Image versioning         │ ⚠️      │ Done via imageVersions array in DynamoDB. Assignment says "old versions retained in S3" — actual S3 versioning is never enabled │
  ├──────────────────────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Image deletion with task │ ✅     │ deleteFromS3 called in deleteTask                                                                                               │
  └──────────────────────────┴────────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  Event-Driven Architecture
  
  ┌──────────────────────────────┬────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │         Requirement          │ Status │                                                                           Notes                                                                           │
  ├──────────────────────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ SNS topic on task assignment │ ✅     │ publishTaskAssignment in sns.js                                                                                                                           │
  ├──────────────────────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ SNS fans out to email        │ ⚠️      │ No email subscription is created anywhere in scripts; setup-assignment-pipeline.ps1 only subscribes SQS. The assignment worker also handles digests on    │
  │ subscription                 │        │ the same topic — this is a collision                                                                                                                      │
  ├──────────────────────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ SNS fans out to SQS          │ ✅     │ Pipeline script subscribes SQS to SNS                                                                                                                     │
  ├──────────────────────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ SQS drained by assignment    │ ✅     │ Lambda triggered via event source mapping                                                                                                                 │
  │ worker Lambda                │        │                                                                                                                                                           │
  ├──────────────────────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Worker writes activity log   │ ✅     │ Writes to ActivityLogs DynamoDB table                                                                                                                     │
  ├──────────────────────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Worker publishes CloudWatch  │ ✅     │ TasksAssignedPerTeam metric published                                                                                                                     │
  │ metric                       │        │                                                                                                                                                           │
  ├──────────────────────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ EventBridge daily at 9 AM    │ ✅     │ cron(0 9 * * ? *) rule deployed in script                                                                                                                 │
  ├──────────────────────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Daily digest Lambda scans    │ ✅     │ Scans Tasks table, filters by deadline                                                                                                                    │
  │ due tasks                    │        │                                                                                                                                                           │
  ├──────────────────────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Digest emails sent via SNS   │ ⚠️      │ Bug: sends to SNS_TOPIC_ARN which is TaskAssignmentsTopic. The SQS queue is subscribed to this topic, so digest messages enter the assignment-worker      │
  │                              │        │ pipeline and it tries to parse them as TASK_ASSIGNMENT events → crash or garbage data                                                                     │
  ├──────────────────────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Digest missing metric →      │ ✅     │ OverdueTasks metric published                                                                                                                             │
  │ CloudWatch                   │        │                                                                                                                                                           │
  └──────────────────────────────┴────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  Lambda Pipelines

  ┌────────────────────────────────────────┬────────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │              Requirement               │ Status │                                                                      Notes                                                                      │
  ├────────────────────────────────────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Image resize Lambda triggered by S3    │ ✅     │ s3:ObjectCreated notification configured                                                                                                        │
  │ PUT                                    │        │                                                                                                                                                 │
  ├────────────────────────────────────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Resizes to thumbnail                   │ ✅     │ sharp at 400×400, JPEG 85%, cover fit                                                                                                           │
  ├────────────────────────────────────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Writes thumbnailUrl back to DynamoDB   │ ✅     │ Done, but uses a full table Scan to find the task by image key — O(n) on every upload                                                           │
  ├────────────────────────────────────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Lambda triggered only on new task      │ ❌     │ Lambda is triggered by ANY S3 PUT on the originals bucket, including image replacements. The assignment says "triggered only upon creation of   │
  │ creation                               │        │ newly added tasks"                                                                                                                              │
  └────────────────────────────────────────┴────────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
  
  CloudWatch Monitoring

  ┌──────────────────────────┬────────┬───────────────────────────────────────────────────────────────────────────────────────────────┐
  │       Requirement        │ Status │                                             Notes                                             │
  ├──────────────────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Dashboard with 4 widgets │ ✅     │ Tasks Created, Tasks Closed, Avg Time to Close, EC2 CPU — all present in setup-cloudwatch.cjs │
  ├──────────────────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────┤
  │ At least one alarm       │ ✅     │ Overdue Tasks alarm + EC2 High CPU alarm                                                      │
  ├──────────────────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Alarm publishes to SNS   │ ✅     │ Wired to SNS_ALARM_TOPIC_ARN                                                                  │
  └──────────────────────────┴────────┴───────────────────────────────────────────────────────────────────────────────────────────────┘

  Infrastructure (HA)
  
  ┌───────────────────────────────┬────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │          Requirement          │ Status │                                                                          Notes                                                                           │
  ├───────────────────────────────┼────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ EC2 in Auto Scaling Group     │ ❌     │ No ASG configuration anywhere                                                                                                                            │
  ├───────────────────────────────┼────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Multiple Availability Zones   │ ❌     │ Not configured                                                                                                                                           │
  ├───────────────────────────────┼────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Application Load Balancer     │ ❌     │ Not configured                                                                                                                                           │
  ├───────────────────────────────┼────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ CloudFront distribution       │ ❌     │ Not configured                                                                                                                                           │
  ├───────────────────────────────┼────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ VPC with public/private       │ ❌     │ Not configured                                                                                                                                           │
  │ subnets                       │        │                                                                                                                                                          │
  ├───────────────────────────────┼────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ NAT Gateway for private EC2   │ ❌     │ Not configured                                                                                                                                           │
  ├───────────────────────────────┼────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ DynamoDB GSI on teamId        │ ⚠️      │ Code references teamId-createdAt-index and is correct, but the README create-table commands don't include the GSI definition — deployers would get a     │
  │                               │        │ missing index error                                                                                                                                      │
  ├───────────────────────────────┼────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ DynamoDB GSI on assigneeId    │ ❌     │ Code never queries by assigneeId; GSI not created                                                                                                        │
  ├───────────────────────────────┼────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ S3 versioning enabled         │ ❌     │ Buckets are created with default settings                                                                                                                │
  ├───────────────────────────────┼────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Users table in DynamoDB       │ ❌     │ No Users table — user data lives only in Cognito                                                                                                         │
  ├───────────────────────────────┼────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Teams table in DynamoDB       │ ❌     │ No Teams table — teamId is only a string in Cognito attributes                                                                                           │
  └───────────────────────────────┴────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  UI/UX
  
  ┌─────────────────────────────────┬────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │           Requirement           │ Status │                                                 Notes                                                 │
  ├─────────────────────────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Modern UI library               │ ⚠️      │ Tailwind CSS v4 used, but no shadcn/ui, Material UI, or Chakra. Raw HTML inputs, no component library │
  ├─────────────────────────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Kanban board (4 columns)        │ ✅     │ KanbanBoard.jsx has all 4 statuses including IN_REVIEW                                                │
  ├─────────────────────────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Drag-and-drop                   │ ✅     │ @dnd-kit/core with drag handles and droppable columns                                                 │
  ├─────────────────────────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Task detail modal with comments │ ✅     │ Full-featured TaskDetailModal with CommentThread                                                      │
  ├─────────────────────────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Loading states                  │ ⚠️      │ Comment thread has skeleton loading; main board has no loading skeleton                               │
  ├─────────────────────────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Empty states                    │ ⚠️      │ Comment thread has empty state; board columns have none                                               │
  ├─────────────────────────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Error toasts                    │ ❌     │ All errors go to console.error only — no toast notifications shown to user                            │
  ├─────────────────────────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Deadline field in task form     │ ❌     │ TaskForm.jsx has no deadline input — critical miss for daily digest functionality                     │
  ├─────────────────────────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Per-team dashboard for manager  │ ❌     │ No team filter UI for managers                                                                        │
  └─────────────────────────────────┴────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────┘

  Deliverables
  
  ┌────────────────────────┬────────┬──────────────────────────┐
  │      Requirement       │ Status │          Notes           │
  ├────────────────────────┼────────┼──────────────────────────┤
  │ GitHub Repo            │ ✅     │ Present                  │
  ├────────────────────────┼────────┼──────────────────────────┤
  │ Architecture diagram   │ ❌     │ Not found in repo        │
  ├────────────────────────┼────────┼──────────────────────────┤
  │ Working CloudFront URL │ ❌     │ No CloudFront configured │
  ├────────────────────────┼────────┼──────────────────────────┤
  │ Demo video             │ ❌     │ Not present              │
  └────────────────────────┴────────┴──────────────────────────┘

  ---
  3. Architecture Review

  What's Actually Deployed vs. What's Required

  The assignment demands a production-grade AWS deployment. What exists is a local-first Node.js + React app with Lambda functions deployed manually. The entire high-availability layer is missing:

  Required:                   Actual:
  Internet                    Internet
      ↓                           ↓
  CloudFront                  [NOT DEPLOYED]
      ↓                           ↓
  ALB (2 AZs)                 [NOT DEPLOYED]
      ↓                           ↓
  EC2 ASG (private subnets)   [NOT DEPLOYED]
      ↓                           ↓
  DynamoDB                    ✅ DynamoDB (correctly used)
  S3                          ✅ S3 (correctly used)
  Lambdas                     ✅ All 3 Lambdas deployed
  SNS/SQS                     ✅ Configured
  CloudWatch                  ✅ Dashboard + Alarms
  Cognito                     ✅ Working

  The app appears to run locally (localhost:3000) and never on EC2. Without EC2/ALB/CloudFront, the CloudFront URL deliverable cannot exist.

  Bottlenecks Under Load
  
  Full-table Scans everywhere:
  - tasksRepository.getAll() — Scan every time a manager loads tasks. At 10,000 tasks this becomes slow and expensive.
  - projectsRepository.getAll() — Scan, then filter in Node.js by teamId. No GSI on Projects.teamId.
  - findTaskByImageKey() in image-resize Lambda — Scan the Tasks table on every S3 upload to find which task has this image key. At 1,000 tasks this runs fine; at 100,000 it times out.
  - daily-digest Lambda — Scans the entire Tasks table every morning.
  
  No pagination: getTasks returns the entire Tasks table to the frontend. 500 tasks will break the Kanban board.

  N+1 presigned URL generation: In tasksService.getTasks, a presigned URL is generated for every task in Promise.all. 100 tasks = 100 serial GetObjectCommand calls to S3 (though they're parallel via
  Promise.all, each is a separate HTTP round trip with SDK overhead).

  What Would Fail Under Heavy Load

  1. Cognito verifier is created at module import time. If the JWKS endpoint is temporarily unavailable when the Lambda cold-starts, the verifier creation fails silently — subsequent requests get 500s
  because verifier is undefined.
  2. The SQS queue has no Dead Letter Queue. If the assignment worker Lambda fails repeatedly (e.g., DynamoDB is throttled), messages are lost after maxReceiveCount retries.
  3. publishTaskAssignment in sns.js silently swallows errors with console.error. If SNS is temporarily unavailable, the task is still created but no event is published. From the user's perspective, the
   task creation "succeeded" but no activity log or email is ever sent.

  Better Production Architecture
  
  CloudFront
    ├── /api/* → ALB → EC2 ASG (private subnets, 2 AZs)
    │              └── Node.js (stateless, reads JWT from Cognito JWKS cached)
    └── /* → S3 Static Website (React build)

  DynamoDB → PAY_PER_REQUEST, GSIs on teamId + assigneeId for Tasks
                  GSI on teamId for Projects

  SNS TaskAssignmentsTopic
    ├── SQS → Assignment Worker Lambda (+ DLQ)
    └── Email Subscription per team (separate from digest)

  SNS DigestTopic (SEPARATE from assignment topic)
    └── Email Subscription (digest emails)

  EventBridge → Daily Digest Lambda → DigestTopic (not TaskAssignmentsTopic)

  Cost optimizations for free tier: Keep EC2 instances stopped when not demoing. Use t3.micro. DynamoDB PAY_PER_REQUEST is fine for low volume. Lambda is always free tier for this usage level.

  ---
  4. Codebase Review

  What Works Well

  The module pattern (tasks/tasks.controller.js, tasks/tasks.service.js, tasks/tasks.repository.js) is excellent and shows real software design thinking. The separation between HTTP concerns
  (controller), business logic (service), and data access (repository) is textbook clean architecture. This is better than most university projects.

  Cognito JWT verification via aws-jwt-verify (not jsonwebtoken) is the correct AWS-native approach. Extracting custom:role and custom:teamId from the ID token is exactly right.

  Critical Bugs

  Bug 1: CORS locked to localhost
  // app.js:15-18
  app.use(cors({
    origin: 'http://localhost:5173',  // ← HARD-CODED
    credentials: true,
  }));
  The .env.example defines FRONTEND_URL and it's even mentioned in the README — but app.js never reads it. Production deployment would result in every browser request being CORS-blocked.
  
  Fix: origin: process.env.FRONTEND_URL

  Bug 2: API base URL hard-coded
  // frontend/src/services/api.js:4
  const api = axios.create({
    baseURL: 'http://localhost:3000/api',  // ← HARD-CODED
  });
  Any deployed frontend would talk to the developer's local machine. Use import.meta.env.VITE_API_URL.
  
  Bug 3: getOne has no team isolation (graded requirement)
  // tasks.controller.js:39-58
  async getOne(req, res) {
    const task = await tasksService.getTaskById(req.params.id);
    // No user check. No team check. Returns task to anyone.
    if (!task) return res.status(404)...
    res.json(task);
  } 
  The assignment explicitly states: "An employee on the Backend team must not be able to fetch a Frontend team task even by guessing its ID." This directly fails that requirement.

  Bug 4: updateStatus has no authorization
  // tasks.router.js:32-35
  router.patch('/:id/status', tasksController.updateStatus);
  // No requireRole(), no team check in service
  Any employee can move any task — including tasks from other teams — to any status. This breaks the demo scenario.
  
  Bug 5: Daily digest publishes to the wrong SNS topic
  // lambdas/daily-digest/index.mjs:75
  await snsClient.send(new PublishCommand({
    TopicArn: topicArn,  // This is TaskAssignmentsTopic
    Message: message
  }));
  SNS_TOPIC_ARN is TaskAssignmentsTopic, which the SQS queue subscribes to. The assignment worker Lambda receives these digest messages and tries to JSON.parse(snsMessage.Message) as a task assignment.
  The taskData.type will be undefined and the log entry will be garbage. This causes invisible data corruption in ActivityLogs.
  
  Bug 6: tasks.schema.js is misnamed — it's just constants
  // tasks.schema.js
  export const TASK_STATUS = { TODO: 'TODO', ... };
  Zod is in package.json but no input validation schema exists. Task creation accepts any JSON body with no validation — you can create a task with an empty title, no teamId, or arbitrary extra fields.
  
  Anti-Patterns and Technical Debt

  Double uuid generation:
  // tasksService.createTask():
  const task = await tasksRepository.create({
    taskId: uuid(),  // generated here...
    ...
  });
  
  // tasksRepository.create():
  const task = {
    taskId: uuid(),  // ...then overwritten by spread
    ...data,
  };
  UUID is generated twice. The repository's own uuid is immediately overwritten. Either generate in service OR repository, not both.

  Two duplicate middleware files:
  - middleware/rbac.middleware.js — doesn't check if req.user exists
  - middleware/role.middleware.js — does check req.user
  Only rbac.middleware.js is imported in routes. role.middleware.js is dead code.

  Dead files:
  - frontend/src/App.jsx — renders <DashboardPage /> directly, never imported (main.jsx uses AppRouter)
  - frontend/src/router/ProtectedRoute.jsx — checks state.token which doesn't exist in the auth store; never imported (router/index.jsx defines its own inline ProtectedRoute)
  - frontend/src/pages/KanbanPage.jsx — old incomplete Kanban; not in any route
  - lambdas/daily-digest/index.js and lambdas/daily-digest/index.mjs — two versions of the same Lambda
  
  Unused dependencies (frontend):
  - @tanstack/react-query — installed, never used
  - @hello-pangea/dnd — installed (a second DnD library), never used (dnd-kit is used instead)
  
  Unused dependencies (backend):
  - morgan — installed, not added to app.js
  - jsonwebtoken — installed, not used (aws-jwt-verify is used correctly)
  - jwk-to-pem — installed, not used
  
  No input validation: The Zod library is installed but never used for request validation. All controller inputs go directly into DynamoDB with no sanitization.

  ---
  5. Frontend Review
  
  What Looks Professional

  The TaskDetailModal is genuinely well-built. Status buttons with color coding, image replacement on hover with overlay, CommentThread with avatar initials, relative timestamps ("3m ago", "2h ago"),
  confirm-before-delete — these are details that show care. The comment thread's skeleton loading animation is a good touch.

  The KanbanBoard with @dnd-kit/core has a proper drag handle separate from the click area, which prevents accidental drags when clicking the card to open the modal. This is a UX detail most students
  miss.

  The Navbar with active-link highlighting and Amplify signOut is clean.

  What Looks Amateur
  
  TaskForm requires typing raw UUIDs into "Team ID" and "Assignee ID" fields. A manager cannot realistically use this — they'd need to manually copy-paste user IDs from Cognito. For the demo scenario
  (Ali assigns to Sara/Omar), the manager must know Sara's Cognito sub UUID. This is a demo-breaking UX failure.

  No deadline input. The form has title, description, priority, teamId, assigneeId, projectId, image — but no deadline. The daily digest Lambda is entirely useless because tasks will never have a
  deadline set.

  No feedback on errors. Every catch in every page component does only console.error(err). If task creation fails (e.g., 403 Forbidden), the user sees nothing. The form just resets as if it succeeded.

  TaskForm is always visible, including for employees. An employee who opens the Dashboard sees a "Create Task" form. It will return 403 when submitted, but no error message is shown. The form should be
   conditionally rendered based on user.role.

  No loading state on the main board. When tasks are loading, the board area is blank. A loading skeleton would be the correct pattern.

  ProjectsPage text inputs for Team ID. Same UX problem as TaskForm — users type raw IDs.

  State management is minimal. useTasksStore just holds an array and a setter — no loading/error states, no optimistic updates. A full refetch on every status change means the board blinks on
  drag-and-drop.

  What Should Be Fixed First

  1. Replace the Team ID / Assignee ID text inputs with dropdowns populated from Cognito users. This is the single biggest UX blocker for the demo.
  2. Add a deadline date picker to TaskForm.
  3. Show error toasts (react-hot-toast is one line to add).
  4. Hide TaskForm from employees.

  ---
  6. Security Review

  Critical

  Team Isolation Bypass (CVSS ~7.5 — High)
  GET /api/tasks/:id returns any task to any authenticated user. An employee on team "backend-team" can enumerate taskIds (UUIDs are not secret; they appear in API responses for their own tasks) and
  guess other teams' task IDs using sequential scans or previously observed IDs. Business data (task descriptions, deadlines, assignees) leaks cross-team.

  Fix: In getOne, after fetching the task, check if (user.role !== 'manager' && task.teamId !== user.teamId) return res.status(403).

  Unauthorized Status Updates (Medium)
  PATCH /api/tasks/:id/status has no ownership or team check. Any employee can stall or close any other team's work.

  Moderate

  CORS wildcard-for-localhost is misconfigured for production. When deployed, either CORS blocks the real frontend or you add * as a quick fix (which is a real mistake teams make under deadline
  pressure).

  updateImage is unauthorized. Any employee can replace any task's image — including tasks from other teams.

  SQS policy uses Principal: "*" with ArnEquals condition. This is the recommended AWS pattern for SNS→SQS, so it's acceptable. But it should be noted this is not zero-risk if the ARN is ever reused.

  IAM roles in deploy scripts use hardcoded region eu-north-1. If the team needs to deploy to a different region they'll have ARN mismatches causing silent failures.

  Low / Informational

  - jsonwebtoken and jwk-to-pem in package.json — these are old manual JWT verification libraries. The team correctly uses aws-jwt-verify instead, but the unused packages carry CVE risk if they contain
  vulnerabilities.
  - The Cognito verifier creation error is swallowed: catch (error) { console.error(...) } — verifier stays undefined, and the next request crashes with "Cannot read properties of undefined." Should
  process.exit(1) on failed verifier creation.
  - No rate limiting on any endpoint. A brute-force login attempt or comment spam is unconstrained.
  - File type validation in multerS3 uses file.mimetype, which the client can spoof. MIME type should be validated server-side by reading the file magic bytes via file-type library.

  ---
  7. Database Review

  Missing Tables

  The assignment requires: Users, Teams, Projects, Tasks, Comments. The project creates: Tasks, Comments, ActivityLogs, Projects. Users and Teams are completely absent from DynamoDB. Teams are only
  implicit via teamId strings in Cognito. There is no way to list teams, add a user to a team, or manage team membership through the application.

  GSI Setup Is Broken

  The README create-table for Tasks only defines the primary key:
  aws dynamodb create-table \
    --table-name Tasks \
    --attribute-definitions AttributeName=taskId,AttributeType=S \
    --key-schema AttributeName=taskId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST
  This creates the table with no GSIs. The code then calls QueryCommand on teamId-createdAt-index — which doesn't exist — and gets a ValidationException. The project cannot function if deployed
  following the README. The GSI must be added to the create-table command:

  --global-secondary-indexes '[
    {"IndexName":"teamId-createdAt-index",
     "KeySchema":[{"AttributeName":"teamId","KeyType":"HASH"},{"AttributeName":"createdAt","KeyType":"RANGE"}],
     "Projection":{"ProjectionType":"ALL"}}
  ]' \
  --attribute-definitions AttributeName=taskId,AttributeType=S AttributeName=teamId,AttributeType=S AttributeName=createdAt,AttributeType=S

  Hot Partition Risk

  The teamId-createdAt-index GSI partitions by teamId. If the "backend" team has 10,000 tasks, all those reads hit the same partition. DynamoDB's 3,000 RCU per partition limit becomes relevant at scale.
   The mitigation is to add a shard suffix to the teamId (e.g., backend#0, backend#1) — overkill for a university project but worth mentioning.

  Expensive Access Patterns

  ┌─────────────────────────────────┬────────────────────────────┬─────────────────────────────────────────────────────────────────────────────────────────────┐
  │            Operation            │          Current           │                                           Better                                            │
  ├─────────────────────────────────┼────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Manager gets all tasks          │ Scan entire table          │ Paginated Scan with Limit + LastEvaluatedKey, or GSI on createdAt                           │
  ├─────────────────────────────────┼────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Get all projects                │ Scan + filter in Node.js   │ GSI on teamId for Projects table                                                            │
  ├─────────────────────────────────┼────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Find task by image key (Lambda) │ Scan with FilterExpression │ Store s3Key→taskId mapping in a separate lookup table, or pass taskId as S3 object metadata │
  ├─────────────────────────────────┼────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Daily digest                    │ Scan entire table          │ GSI on deadline date + filter in Lambda                                                     │
  └─────────────────────────────────┴────────────────────────────┴─────────────────────────────────────────────────────────────────────────────────────────────┘

  Single-Table vs. Multi-Table

  The project uses multi-table design (Tasks, Projects, Comments separate tables). For DynamoDB, this is actually a valid choice for simplicity and is easier to reason about. Single-table design would
  be more efficient but is complex to implement correctly. For a university project, multi-table is fine — the problem is that access patterns aren't optimized within each table.

  ---
  8. DevOps & Deployment Review

  What's There

  - PowerShell scripts for Lambda deployment (deploy-assignment-worker.ps1, deploy-daily-digest.ps1)
  - A Node.js script for CloudWatch setup (setup-cloudwatch.cjs)
  - A shell/PS1 script for SNS+SQS pipeline (setup-assignment-pipeline.ps1)
  - IAM policy JSON files for Lambda roles
  - A comprehensive README with manual step-by-step instructions

  This is better than many university projects that have zero deployment documentation. The IAM roles follow least-privilege (SQS read-only, DynamoDB write-only for the specific tables).

  What Makes It Feel Like a Student Project

  No infrastructure as code. There's no CloudFormation, CDK, Terraform, or SAM. The PowerShell scripts are imperative — they don't handle "already exists" errors (re-running will fail with
  ResourceAlreadyExistsException). IaC would be idempotent.

  Windows-only deployment. All scripts are .ps1 (PowerShell). A Linux/Mac-based grader or teammate cannot run them. No Makefile or bash equivalents.

  No Dockerfile. The backend runs with npm run dev (nodemon). For EC2 deployment, you'd need either a Dockerfile, PM2 configuration, or a systemd unit file. None of these exist.

  No EC2 user-data script. When an EC2 instance launches, it needs to: install Node.js, pull the code, set environment variables, and start the server. Without a user-data script, each EC2 instance
  requires manual SSH setup. Auto Scaling is useless without automation.

  No environment separation. There's one environment — whatever is in .env. No staging vs production, no parameter store integration.

  Empty .env.example. The file exists but has 1 line (blank). The README has the correct variable list, but the .env.example is the canonical reference for other developers.

  ---
  9. Demo Day Readiness
  
  What Will Impress Evaluators

  1. dnd-kit drag-and-drop is visually impressive and works correctly. This is the first thing evaluators will see and it will get positive reactions.
  2. CommentThread with avatar initials, relative timestamps, and confirm-before-delete looks genuinely professional.
  3. Presigned S3 URLs — images load from private S3 through signed URLs, which shows real security awareness.
  4. Lambda pipeline — if you demo creating a task and then show CloudWatch logs showing the SNS → SQS → Lambda → ActivityLogs flow, this is exactly what evaluators want to see.
  5. CloudWatch dashboard with 4 real metrics is a strong visual finish.

  What Could Fail Live

  1. The demo scenario will fail as described. When Sara logs in and the evaluator manually types Sara's Cognito sub UUID as "Assignee ID" to create Task A, they'll struggle. The form has no user
  lookup.
  2. If evaluators open Browser DevTools and look at the API base URL being http://localhost:3000, they'll know the app isn't actually deployed.
  3. Status drag-and-drop updates any task. If an evaluator logs in as Sara and drags a task from Omar's team (which she can see only if she guesses the ID — but the manager loaded the board with all
  tasks), team isolation is broken.
  4. No error feedback. If anything goes wrong silently, there's no toast, no message — the user just sees nothing happen.
  5. Deadline field missing. If an evaluator tries to demonstrate the daily digest by looking at the task form for a deadline input, it won't be there.

  Recommended Demo Flow

  1. Start with the manager (Ali) login.
  2. Show the Projects page — create a project.
  3. Go to Dashboard — show the Kanban board (all 4 columns).
  4. Create a task for Sara. Show SNS → SQS → Lambda flow in CloudWatch Logs Insights.
  5. Log in as Sara. Show she sees only her task (list view works).
  6. Sara drags her task to "In Progress".
  7. Switch back to Ali. Show he sees both tasks. Show CloudWatch dashboard.
  8. Show the daily digest Lambda in EventBridge and its CloudWatch logs.
  9. Show the image resize — upload image, open resized bucket in S3.

  Do not demo: Fetching a task by ID as an employee from another team (broken). Error states (none exist). Logging in as Omar and trying to access Sara's task.

  Must Fix Before Demo Day
  
  In priority order:

  1. Fix team isolation in getOne — this is THE graded requirement
  2. Fix CORS to use process.env.FRONTEND_URL
  3. Fix API base URL to use import.meta.env.VITE_API_URL
  4. Add deadline input to TaskForm
  5. Add error toast on form submission failure
  6. Fix daily digest to use a separate SNS topic
  7. Show the requireRole check on updateStatus
  8. Add GSIs to README create-table commands
  9. Create at least a fake EC2 + ALB + CloudFront (even a manual setup would satisfy the grader visually)

  ---
  10. Missing Features & Recommendations
  
  Missing Critical Features (Lose Marks)

  1. User/Team management UI — No way to list teams, view members, or assign users to teams. The "Admin" role from the spec is completely absent.
  2. EC2 + ALB + ASG + CloudFront — The entire HA requirement is unmet.
  3. Architecture diagram — Required deliverable, not present.
  4. Demo video — Required deliverable, not present.
  5. Assignee/Team dropdowns in TaskForm — Without these, the demo scenario cannot be completed cleanly.
  6. Deadline input — Makes the daily digest feature pointless.

  Quick Wins (1-2 hours each)

  1. Error toasts — npm install react-hot-toast, add <Toaster /> to AppLayout, replace console.error with toast.error. Instantly more professional.
  2. Hide TaskForm from employees — {user?.role === 'manager' && <TaskForm />}.
  3. Fix CORS — One line change: origin: process.env.FRONTEND_URL.
  4. Fix team isolation in getOne — 5 lines of code, catches the biggest security gap.
  5. Add deadline to TaskForm — One <input type="date" />.
  6. Add requireRole to updateStatus — Or at least add team check in service.

  WOW Features (if time permits)

  1. Team filter dropdown for managers — A select box above the Kanban board to filter by team. This directly demonstrates the per-team dashboard requirement.
  2. Real-time activity feed — Show the ActivityLogs table as a live feed on the dashboard sidebar. Evaluators love seeing the event-driven pipeline produce visible results.
  3. Assignee name display — Replace raw UUID in TaskCard ("Assignee: 9f2a3c...") with the actual user's email fetched from Cognito. Even a cached lookup would be impressive.
  4. Overdue task badge — Highlight tasks past their deadline in red on the Kanban card.

  ---
  11. Final Verdict
  
  Is this project strong? It is structurally above average for a university assignment. The Lambda pipeline (SNS→SQS→Worker, EventBridge→Digest, S3→ImageResize) is fully implemented and shows real
  understanding of event-driven AWS services. The backend module pattern (controller/service/repository) is better than most junior professional code. The comment thread UI is polished.

  Does it look internship-worthy? Conditionally yes — the architecture thinking and AWS service knowledge are real. The event-driven components are correctly implemented. However, the critical security
  hole (team isolation bypass), hardcoded URLs, and missing HA deployment would be immediate red flags in a code review. An intern who produced this would be told to fix security before merging
  anything.
  
  Does it look startup-worthy? No. The CORS and API URL hardcoding mean it cannot be deployed as-is. The missing HA infrastructure means it cannot handle any load. The lack of input validation means
  data integrity is not guaranteed.

  Could it survive real users? No. Full-table scans on every request, no pagination, no DLQ, no rate limiting, and team isolation bypass would all become problems within the first hour of real usage.

  What level is this team?
  
  ▎ Strong Student Engineers leaning toward Junior Professional. The AWS SDK usage is correct and sophisticated. The Lambda implementations are genuinely solid. The code organization is better than 
  ▎ most. But the gap between "code works locally" and "code is deployed and secure in production" is exactly the gap between a strong student and a working engineer — and this project hasn't crossed 
  ▎ that gap yet. The missing deployment, the hardcoded URLs, and the security holes are the exact mistakes that senior engineers spend the most time reviewing and fixing in junior engineers' PRs.
  
  What grade would a strict evaluator give?

  ┌───────────────────────────────────────────┬────────┬───────────────────────────────────────────────┐
  │                 Category                  │ Weight │                     Score                     │
  ├───────────────────────────────────────────┼────────┼───────────────────────────────────────────────┤
  │ Working demo (core CRUD)                  │ High   │ 70% — works locally but demo UX is broken     │
  ├───────────────────────────────────────────┼────────┼───────────────────────────────────────────────┤
  │ Team isolation (graded explicitly)        │ High   │ 40% — broken on getOne and updateStatus       │
  ├───────────────────────────────────────────┼────────┼───────────────────────────────────────────────┤
  │ AWS services (SNS/SQS/Lambda/EventBridge) │ High   │ 80% — all implemented, one logical bug        │
  ├───────────────────────────────────────────┼────────┼───────────────────────────────────────────────┤
  │ HA Architecture (ALB/ASG/CloudFront)      │ High   │ 0% — not deployed                             │
  ├───────────────────────────────────────────┼────────┼───────────────────────────────────────────────┤
  │ UI/UX quality                             │ Medium │ 65% — Kanban is great, form UX is poor        │
  ├───────────────────────────────────────────┼────────┼───────────────────────────────────────────────┤
  │ CloudWatch                                │ Medium │ 85% — dashboard + alarms are solid            │
  ├───────────────────────────────────────────┼────────┼───────────────────────────────────────────────┤
  │ Security                                  │ Medium │ 35% — critical bypass                         │
  ├───────────────────────────────────────────┼────────┼───────────────────────────────────────────────┤
  │ Code quality                              │ Low    │ 70% — good patterns, dead code, no validation │
  └───────────────────────────────────────────┴────────┴───────────────────────────────────────────────┘

  Estimated final grade: 55-65% / 100. Passing, but not strong. The team has real technical ability that the grade undersells — the limiting factor is deployment completion and the security holes on the
   exact requirements that were called out explicitly in the assignment.

