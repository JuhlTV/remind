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
BACKEND_SUBDIR="${BACKEND_SUBDIR:-bewerbung-portal/backend}"
RUN_DB_SETUP="${RUN_DB_SETUP:-1}"
CREATE_OWNER="${CREATE_OWNER:-0}"
RESTART_CMD="${RESTART_CMD:-}"
PRESERVE_PATHS="${PRESERVE_PATHS:-${BACKEND_SUBDIR}/.env .env}"

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

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

for cmd in git npm; do
  if ! command_exists "$cmd"; then
    log "ERROR: Required command not found: $cmd"
    exit 1
  fi
done

log "Deploy start"
log "APP_DIR: $APP_DIR"
log "BRANCH: $BRANCH"

mkdir -p "$APP_DIR"

LOCK_DIR="/tmp/remind-deploy-$(printf '%s' "$APP_DIR" | tr '/ ' '__').lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  log "ERROR: Another deployment appears to be running for APP_DIR=$APP_DIR"
  exit 1
fi

PRESERVE_TMP_DIR="$(mktemp -d /tmp/remind-preserve.XXXXXX)"
cleanup() {
  rm -rf "$PRESERVE_TMP_DIR" >/dev/null 2>&1 || true
  rmdir "$LOCK_DIR" >/dev/null 2>&1 || true
}
trap cleanup EXIT

save_preserved_files() {
  local rel src dst
  for rel in $PRESERVE_PATHS; do
    src="$APP_DIR/$rel"
    if [[ -f "$src" ]]; then
      dst="$PRESERVE_TMP_DIR/$rel"
      mkdir -p "$(dirname "$dst")"
      cp -p "$src" "$dst"
      log "Preserved: $rel"
    fi
  done
}

restore_preserved_files() {
  local rel src dst
  for rel in $PRESERVE_PATHS; do
    src="$PRESERVE_TMP_DIR/$rel"
    if [[ -f "$src" ]]; then
      dst="$APP_DIR/$rel"
      mkdir -p "$(dirname "$dst")"
      cp -p "$src" "$dst"
      log "Restored: $rel"
    fi
  done
}

save_preserved_files

if [[ -d "$APP_DIR/.git" ]]; then
  log "Existing git repo found, updating..."
  git -C "$APP_DIR" remote remove origin >/dev/null 2>&1 || true
  git -C "$APP_DIR" remote add origin "$REPO_AUTH_URL"
  # Ensure a previous sparse/partial checkout does not hide files like CSS/assets.
  git -C "$APP_DIR" sparse-checkout disable >/dev/null 2>&1 || true
  git -C "$APP_DIR" config core.sparseCheckout false >/dev/null 2>&1 || true
  git -C "$APP_DIR" fetch --all --prune
  git -C "$APP_DIR" checkout "$BRANCH" 2>/dev/null || git -C "$APP_DIR" checkout -B "$BRANCH" "origin/$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
  git -C "$APP_DIR" clean -fdx
else
  if [[ -n "$(ls -A "$APP_DIR" 2>/dev/null)" ]]; then
    log "Existing non-empty directory found. Converting to git working tree..."
    git -C "$APP_DIR" init
    git -C "$APP_DIR" remote remove origin >/dev/null 2>&1 || true
    git -C "$APP_DIR" remote add origin "$REPO_AUTH_URL"
    git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
    git -C "$APP_DIR" checkout -B "$BRANCH"
    git -C "$APP_DIR" reset --hard FETCH_HEAD
    # Remove stale untracked files so deployed content matches repository state.
    git -C "$APP_DIR" clean -fd
  else
    log "Empty target directory found, cloning repository..."
    git clone --branch "$BRANCH" --single-branch "$REPO_AUTH_URL" "$APP_DIR"
  fi
fi

restore_preserved_files

required_files=(
  "index.html"
  "site-theme.css"
  "utils.js"
  "bewerbung-portal/public/index.html"
  "bewerbung-portal/public/assets/css/main.css"
)

for rel in "${required_files[@]}"; do
  if [[ ! -f "$APP_DIR/$rel" ]]; then
    log "ERROR: Required file missing after deploy: $rel"
    exit 1
  fi
done

log "Frontend deploy verification passed (HTML/CSS/JS present)."
log "Deployed commit: $(git -C "$APP_DIR" rev-parse --short HEAD)"

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
