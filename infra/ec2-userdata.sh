#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# EC2 Bootstrap Script — Mini-Jira on AWS
# Runs once at instance launch via ASG Launch Template UserData.
# Installs Node 20, PM2, clones the repo, fetches config from SSM
# Parameter Store, builds the React frontend, and starts the backend.
# ─────────────────────────────────────────────────────────────────────────────
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
dnf install -y nodejs
node --version
npm --version

echo "=== [3/8] Install PM2 ==="
npm install -g pm2

echo "=== [4/8] Clone repository ==="
if [ -d "$APP_DIR" ]; then
  echo "Repo exists — pulling latest"
  cd "$APP_DIR" && git fetch origin && git reset --hard "origin/$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

echo "=== [5/8] Fetch configuration from SSM Parameter Store ==="
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

echo "Config written to $ENV_FILE ($(wc -l < "$ENV_FILE") entries)"

echo "=== [6/8] Build React frontend ==="
cd "$APP_DIR/frontend"
npm ci
# VITE_API_URL uses /api (same-origin — backend serves the frontend)
# Cognito values are read from .env.production committed in the repo
npm run build
echo "Frontend built — $(du -sh dist | cut -f1) in dist/"

echo "=== [7/8] Install backend dependencies ==="
cd "$APP_DIR/backend"
npm ci --omit=dev

echo "=== [8/8] Start application with PM2 ==="
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
