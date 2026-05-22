#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# One-time setup: write all Mini-Jira secrets to SSM Parameter Store.
# Run this locally BEFORE deploying the CDK stack.
# EC2 instances fetch these at boot via the bootstrap script.
#
# Usage:
#   chmod +x infra/ssm-put-params.sh
#   REGION=eu-north-1 ./infra/ssm-put-params.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REGION="${REGION:-eu-north-1}"

put() {
  local key="$1" value="$2"
  echo "  Writing /mini-jira/$key"
  aws ssm put-parameter \
    --name "/mini-jira/$key" \
    --value "$value" \
    --type SecureString \
    --overwrite \
    --region "$REGION" \
    --output text > /dev/null
}

echo "Writing Mini-Jira parameters to SSM ($REGION)..."

# ── Replace these values with your actual config ──────────────────────────────
put "COGNITO_USER_POOL_ID"       "eu-north-1_XXXXXXXXX"
put "COGNITO_CLIENT_ID"          "your-app-client-id"
put "DYNAMODB_TASKS_TABLE"       "Tasks"
put "DYNAMODB_COMMENTS_TABLE"    "Comments"
put "DYNAMODB_PROJECTS_TABLE"    "Projects"
put "DYNAMODB_ACTIVITY_LOGS_TABLE" "ActivityLogs"
put "S3_ORIGINALS_BUCKET"        "mini-jira-originals-your-name"
put "S3_RESIZED_BUCKET"          "mini-jira-resized-your-name"
put "SNS_TOPIC_ARN"              "arn:aws:sns:eu-north-1:ACCOUNT_ID:TaskAssignmentsTopic"
put "SNS_DIGEST_TOPIC_ARN"       "arn:aws:sns:eu-north-1:ACCOUNT_ID:DailyDigestTopic"
put "CW_NAMESPACE"               "MiniJira"
put "ENV"                        "production"
put "FRONTEND_URL"               "https://YOUR_CLOUDFRONT_DOMAIN"
# ─────────────────────────────────────────────────────────────────────────────

echo "Done. Verify with:"
echo "  aws ssm get-parameters-by-path --path /mini-jira/ --with-decryption --region $REGION"
