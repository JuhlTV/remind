#!/bin/bash
set -euo pipefail

# Deploy script: Pull entire remind.git project from GitHub to server
# Deploys bewerbung-portal backend to APP_DIR
#
# Usage:
#   ./deploy-from-github.sh
#
# Environment variables (all optional with defaults):
#   REPO_URL="https://github.com/JuhlTV/remind.git" (default)
#   BRANCH="main" (default)
#   APP_DIR="/home/remindro/public_html" (default, will be auto-detected by deploy-physgun.sh)
#   RUN_DB_SETUP="1" (default: yes)
#   CREATE_OWNER="1" (optional: create first admin account)
#   OWNER_USER="admin"
#   OWNER_PASS="SecurePassword123!"
#   OWNER_EMAIL="admin@example.com"

REPO_URL="${REPO_URL:-https://github.com/JuhlTV/remind.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/home/remindro/public_html}"
BACKEND_SUBDIR="bewerbung-portal/backend"
RUN_DB_SETUP="${RUN_DB_SETUP:-1}"
CREATE_OWNER="${CREATE_OWNER:-0}"
RESTART_CMD="${RESTART_CMD:-}"

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

build_repo_url() {
  local raw_url="$1"

  if [[ -n "${GITHUB_TOKEN:-}" && "$raw_url" == https://github.com/* ]]; then
    # Embed token for private repo access over HTTPS.
    printf '%s' "https://${GITHUB_TOKEN}@${raw_url#https://}"
    return
  fi

  printf '%s' "$raw_url"
}

REPO_AUTH_URL="$(build_repo_url "$REPO_URL")"

log "Deploy start"
log "APP_DIR: $APP_DIR"
log "BRANCH: $BRANCH"

if [[ -d "$APP_DIR/.git" ]]; then
  log "Existing repo found, updating..."
  git -C "$APP_DIR" fetch --all --prune
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  log "Cloning repository..."
  mkdir -p "$(dirname "$APP_DIR")"
  git clone --branch "$BRANCH" --single-branch "$REPO_AUTH_URL" "$APP_DIR"
fi

BACKEND_DIR="$APP_DIR/$BACKEND_SUBDIR"
if [[ ! -d "$BACKEND_DIR" ]]; then
  log "ERROR: Backend directory not found: $BACKEND_DIR"
  exit 1
fi

cd "$BACKEND_DIR"

log "Installing backend dependencies..."
if [[ -f package-lock.json ]]; then
  npm ci --omit=dev
else
  npm install --omit=dev
fi

if [[ "$RUN_DB_SETUP" == "1" ]]; then
  log "Running database setup/migration..."
  npm run setup-db
fi

if [[ "$CREATE_OWNER" == "1" ]]; then
  : "${OWNER_USER:?OWNER_USER is required when CREATE_OWNER=1}"
  : "${OWNER_PASS:?OWNER_PASS is required when CREATE_OWNER=1}"
  OWNER_ROLE="${OWNER_ROLE:-website_owner}"
  OWNER_EMAIL="${OWNER_EMAIL:-}"

  log "Creating first owner admin (if username does not already exist)..."
  set +e
  npm run create-admin -- "$OWNER_USER" "$OWNER_PASS" "$OWNER_ROLE" "$OWNER_EMAIL"
  status=$?
  set -e

  if [[ $status -ne 0 ]]; then
    log "Owner creation returned non-zero (maybe user already exists). Continuing..."
  fi
fi

if [[ -n "$RESTART_CMD" ]]; then
  log "Restarting service..."
  bash -lc "$RESTART_CMD"
fi

log "Deploy finished successfully"
