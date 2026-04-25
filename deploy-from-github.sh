#!/usr/bin/env bash
set -euo pipefail

# Deploy script for a server that should pull code from GitHub.
# Usage (example):
#   REPO_URL="https://github.com/OWNER/REPO.git" \
#   BRANCH="main" \
#   APP_DIR="/var/www/irgendwas" \
#   BACKEND_SUBDIR="bewerbung-portal/backend" \
#   RUN_DB_SETUP="1" \
#   RESTART_CMD="pm2 restart bewerbung-portal" \
#   bash deploy-from-github.sh
#
# Optional for private repos:
#   GITHUB_TOKEN="ghp_xxx"   (must have repo read permissions)
#
# Optional first-owner creation (one-time):
#   CREATE_OWNER="1"
#   OWNER_USER="owner"
#   OWNER_PASS="YourSecurePassword123!"
#   OWNER_ROLE="website_owner"
#   OWNER_EMAIL="owner@example.com"

: "${REPO_URL:?REPO_URL is required, e.g. https://github.com/OWNER/REPO.git}"

BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/var/www/irgendwas}"
BACKEND_SUBDIR="${BACKEND_SUBDIR:-bewerbung-portal/backend}"
RUN_DB_SETUP="${RUN_DB_SETUP:-0}"
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
