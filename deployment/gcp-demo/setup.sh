#!/usr/bin/env bash
set -euo pipefail

# Run as root on a fresh Debian 12 demo VM after copying the repository to /opt/coding-harness.
# This deliberately binds the web app to localhost: use an authenticated IAP SSH tunnel.
PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID}"
APP_DIR=/opt/coding-harness
DATA_DIR=/var/lib/coding-harness
NODE_VERSION=22.19.0
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git xz-utils openssl sudo python3-venv postgresql redis-server nginx

if ! id harness >/dev/null 2>&1; then
  useradd --system --create-home --home-dir /var/lib/coding-harness --shell /bin/bash harness
fi
install -d -o harness -g harness "$DATA_DIR/workspaces" "$DATA_DIR/uploads"
chown -R harness:harness "$APP_DIR"

# Swap helps a 1 GB machine survive dependency installation and the Next.js build.
if ! swapon --show=NAME --noheadings | grep -Fxq /swapfile; then
  if [ ! -e /swapfile ]; then fallocate -l 3G /swapfile; chmod 600 /swapfile; mkswap /swapfile; fi
  swapon /swapfile
fi
if ! grep -q '^/swapfile ' /etc/fstab; then echo '/swapfile none swap sw 0 0' >> /etc/fstab; fi

if [ ! -x /opt/node-v${NODE_VERSION}-linux-x64/bin/node ]; then
  temp_dir=$(mktemp -d)
  trap 'rm -rf "$temp_dir"' EXIT
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" -o "$temp_dir/node.tar.xz"
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt" -o "$temp_dir/SHASUMS256.txt"
  expected=$(awk -v name="node-v${NODE_VERSION}-linux-x64.tar.xz" '$2 == name {print $1}' "$temp_dir/SHASUMS256.txt")
  [ -n "$expected" ] && echo "$expected  $temp_dir/node.tar.xz" | sha256sum -c -
  tar -xJf "$temp_dir/node.tar.xz" -C /opt
fi
ln -sfn "/opt/node-v${NODE_VERSION}-linux-x64" /opt/coding-harness-node
export PATH="/opt/coding-harness-node/bin:$PATH"

systemctl enable --now postgresql redis-server nginx
if [ ! -e /etc/coding-harness.env ]; then
  db_password=$(openssl rand -hex 24)
  jwt_secret=$(openssl rand -hex 32)
  gateway_key="sk-$(openssl rand -hex 24)"
  sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
CREATE USER coding_harness WITH PASSWORD '${db_password}';
CREATE DATABASE coding_harness OWNER coding_harness;
SQL
  umask 077
  cat > /etc/coding-harness.env <<EOF
NODE_ENV=production
HOST=127.0.0.1
PORT=4000
DATABASE_URL=postgresql://coding_harness:${db_password}@127.0.0.1:5432/coding_harness?schema=public
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
JWT_SECRET=${jwt_secret}
WORKSPACES_DIR=${DATA_DIR}/workspaces
UPLOADS_DIR=${DATA_DIR}/uploads
AI_PROVIDER=claude-code
ANTHROPIC_BASE_URL=http://127.0.0.1:4010
ANTHROPIC_AUTH_TOKEN=${gateway_key}
LITELLM_MASTER_KEY=${gateway_key}
VERTEXAI_PROJECT=${PROJECT_ID}
COST_REPORT_PROJECT=${PROJECT_ID}
VERTEXAI_LOCATION=global
ANTHROPIC_MODEL=gemini-3.5-flash
ANTHROPIC_SMALL_FAST_MODEL=gemini-3.5-flash
ANTHROPIC_DEFAULT_HAIKU_MODEL=gemini-3.5-flash
ANTHROPIC_DEFAULT_SONNET_MODEL=gemini-3.5-flash
ANTHROPIC_DEFAULT_OPUS_MODEL=gemini-3.5-flash
CLAUDE_CODE_MODEL=gemini-3.5-flash
DISABLE_NON_ESSENTIAL_MODEL_CALLS=1
CLAUDE_CODE_MAX_BUDGET_USD=5.00
CLAUDE_CODE_MAX_TURNS=20
CLAUDE_CODE_TIMEOUT_MS=900000
EOF
fi
chmod 600 /etc/coding-harness.env
set -a
source /etc/coding-harness.env
set +a
umask 077
cat > /etc/coding-harness-gateway.env <<EOF
LITELLM_MASTER_KEY=${LITELLM_MASTER_KEY}
VERTEXAI_PROJECT=${VERTEXAI_PROJECT}
VERTEXAI_LOCATION=global
EOF
chmod 600 /etc/coding-harness-gateway.env
umask 022

if [ ! -x /opt/coding-harness-litellm/bin/litellm ]; then
  python3 -m venv /opt/coding-harness-litellm
  /opt/coding-harness-litellm/bin/pip install 'litellm[proxy]==1.99.3' google-auth
fi
chmod -R a+rX /opt/coding-harness-litellm

# The native Claude Code installer installs in the unprivileged service user's home.
if [ ! -x "$DATA_DIR/.local/bin/claude" ]; then
  curl -fsSL https://claude.ai/install.sh -o /tmp/coding-harness-claude-install.sh
  chmod 755 /tmp/coding-harness-claude-install.sh
  sudo -u harness env HOME="$DATA_DIR" PATH="$PATH" bash /tmp/coding-harness-claude-install.sh stable
  rm /tmp/coding-harness-claude-install.sh
fi

sudo -u harness env HOME="$DATA_DIR" PATH="$PATH" bash -c 'cd /opt/coding-harness && npm ci && npm run build:shared && npm run db:generate && npm run build:backend && NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_API_URL="" NEXT_PUBLIC_WS_URL="" NEXT_PUBLIC_DEMO_MODE=true npm run build:frontend'
set -a
# shellcheck disable=SC1091
source /etc/coding-harness.env
set +a
runuser -u harness --preserve-environment -- bash -c 'cd /opt/coding-harness/backend && npx prisma migrate deploy'

install -m 644 "$APP_DIR/deployment/gcp-demo/coding-harness-backend.service" /etc/systemd/system/
install -m 644 "$APP_DIR/deployment/gcp-demo/coding-harness-frontend.service" /etc/systemd/system/
install -m 644 "$APP_DIR/deployment/gcp-demo/coding-harness-gateway.service" /etc/systemd/system/
install -m 644 "$APP_DIR/deployment/gcp-demo/nginx.conf" /etc/nginx/sites-available/coding-harness
ln -sfn /etc/nginx/sites-available/coding-harness /etc/nginx/sites-enabled/coding-harness
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl daemon-reload
systemctl enable --now coding-harness-gateway coding-harness-backend coding-harness-frontend
systemctl restart coding-harness-gateway coding-harness-backend coding-harness-frontend nginx
