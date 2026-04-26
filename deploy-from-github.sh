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
STRICT_BACKEND_TOOLS="${STRICT_BACKEND_TOOLS:-0}"
BACKUP_BEFORE_DEPLOY="${BACKUP_BEFORE_DEPLOY:-1}"
BACKUP_DIR="${BACKUP_DIR:-/tmp/remind-backups}"
OVERWRITE_MODE="${OVERWRITE_MODE:-hard}"
AUTO_START_BACKEND="${AUTO_START_BACKEND:-1}"
START_CMD="${START_CMD:-npm run start}"
PID_FILE_NAME="${PID_FILE_NAME:-.backend.pid}"
LOG_FILE_NAME="${LOG_FILE_NAME:-backend.log}"

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

for cmd in git; do
  if ! command_exists "$cmd"; then
    log "ERROR: Required command not found: $cmd"
    exit 1
  fi
done

if command_exists npm; then
  NPM_BIN="npm"
else
  NPM_BIN=""
fi

log "Deploy start"
log "APP_DIR: $APP_DIR"
log "BRANCH: $BRANCH"
log "OVERWRITE_MODE: $OVERWRITE_MODE"
log "AUTO_START_BACKEND: $AUTO_START_BACKEND"

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

create_backup_if_requested() {
  if [[ "$BACKUP_BEFORE_DEPLOY" != "1" ]]; then
    return
  fi

  if [[ -z "$(ls -A "$APP_DIR" 2>/dev/null)" ]]; then
    return
  fi

  mkdir -p "$BACKUP_DIR"
  local backup_name="remind-backup-$(date '+%Y%m%d-%H%M%S').tar.gz"
  local backup_path="$BACKUP_DIR/$backup_name"

  log "Creating backup: $backup_path"
  tar -czf "$backup_path" -C "$APP_DIR" .
  log "Backup created successfully"
}

create_backup_if_requested

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
  if [[ "$OVERWRITE_MODE" == "hard" ]]; then
    git -C "$APP_DIR" clean -fdx
  else
    log "OVERWRITE_MODE=soft -> skipping git clean -fdx"
  fi
else
  if [[ -n "$(ls -A "$APP_DIR" 2>/dev/null)" ]]; then
    log "Existing non-empty directory found. Converting to git working tree..."
    git -C "$APP_DIR" init
    git -C "$APP_DIR" remote remove origin >/dev/null 2>&1 || true
    git -C "$APP_DIR" remote add origin "$REPO_AUTH_URL"
    git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
    git -C "$APP_DIR" checkout -B "$BRANCH"
    git -C "$APP_DIR" reset --hard FETCH_HEAD
    if [[ "$OVERWRITE_MODE" == "hard" ]]; then
      # Remove stale untracked files so deployed content matches repository state.
      git -C "$APP_DIR" clean -fd
    else
      log "OVERWRITE_MODE=soft -> skipping git clean -fd"
    fi
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

if [[ -z "$NPM_BIN" ]]; then
  if [[ "$STRICT_BACKEND_TOOLS" == "1" ]]; then
    log "ERROR: npm is not installed, but STRICT_BACKEND_TOOLS=1 is set."
    exit 1
  fi

  log "WARNING: npm not found on server."
  log "WARNING: Frontend files are deployed, backend install/setup steps are skipped."
  log "WARNING: Install Node.js/npm on host and rerun for full backend deployment."
else
  log "Installing backend dependencies..."
  if [[ -f package-lock.json ]]; then
    "$NPM_BIN" ci --omit=dev
  else
    "$NPM_BIN" install --omit=dev
  fi
fi

if [[ "$RUN_DB_SETUP" == "1" && -n "$NPM_BIN" ]]; then
  log "Running database setup/migration..."
  "$NPM_BIN" run setup-db
fi

if [[ "$CREATE_OWNER" == "1" && -n "$NPM_BIN" ]]; then
  : "${OWNER_USER:?OWNER_USER is required when CREATE_OWNER=1}"
  : "${OWNER_PASS:?OWNER_PASS is required when CREATE_OWNER=1}"
  OWNER_ROLE="${OWNER_ROLE:-website_owner}"
  OWNER_EMAIL="${OWNER_EMAIL:-}"

  log "Creating first owner admin (if username does not already exist)..."
  set +e
  "$NPM_BIN" run create-admin -- "$OWNER_USER" "$OWNER_PASS" "$OWNER_ROLE" "$OWNER_EMAIL"
  status=$?
  set -e

  if [[ $status -ne 0 ]]; then
    log "Owner creation returned non-zero (maybe user already exists). Continuing..."
  fi
fi

if [[ -n "$RESTART_CMD" ]]; then
  log "Restarting service..."
  bash -lc "$RESTART_CMD"
elif [[ "$AUTO_START_BACKEND" == "1" && -n "$NPM_BIN" ]]; then
  PID_FILE="$BACKEND_DIR/$PID_FILE_NAME"
  LOG_FILE="$BACKEND_DIR/$LOG_FILE_NAME"

  if [[ -f "$PID_FILE" ]]; then
    old_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "$old_pid" ]] && kill -0 "$old_pid" >/dev/null 2>&1; then
      log "Stopping previous backend process (PID $old_pid)..."
      kill "$old_pid" >/dev/null 2>&1 || true
      sleep 1
    fi
    rm -f "$PID_FILE"
  fi

  if command_exists nohup; then
    log "Starting backend in background..."
    nohup bash -lc "cd '$BACKEND_DIR' && $START_CMD" >> "$LOG_FILE" 2>&1 &
    new_pid=$!
    echo "$new_pid" > "$PID_FILE"
    log "Backend started. PID: $new_pid"
    log "Backend log: $LOG_FILE"
  else
    log "WARNING: nohup not available, cannot auto-start background process."
  fi
fi

log "Deploy finished successfully"
