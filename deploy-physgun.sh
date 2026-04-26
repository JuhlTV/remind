#!/usr/bin/env bash
set -euo pipefail

# Physgun-ready deploy wrapper for:
# https://github.com/JuhlTV/remind.git
#
# Upload both scripts to your Physgun server root:
#   - deploy-from-github.sh
#   - deploy-physgun.sh
#
# Then run:
#   chmod +x deploy-from-github.sh deploy-physgun.sh
#   ./deploy-physgun.sh
#
# Optional one-liner update before deploy:
#   AUTO_UPDATE_SCRIPTS=1 ./deploy-physgun.sh
#
# If APP_DIR is not provided, this script auto-detects the target in this order:
#   1) /home/remindro/public_html
#   2) /home/remindro/remind-roleplay.com
#   3) /home/remindro/www
#   4) /home/remindro/public.html (fallback if provider used that folder name)
#
# Optional private repo token:
#   GITHUB_TOKEN="ghp_xxx" ./deploy-physgun.sh
#
# Optional owner creation (first run only):
#   CREATE_OWNER=1 OWNER_USER=owner OWNER_PASS='StrongPass123!' OWNER_ROLE=website_owner OWNER_EMAIL=owner@example.com ./deploy-physgun.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_SCRIPT="$SCRIPT_DIR/deploy-from-github.sh"
SCRIPT_REPO_RAW_BASE="${SCRIPT_REPO_RAW_BASE:-https://raw.githubusercontent.com/JuhlTV/remind/main}"

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

download_file() {
  local url="$1"
  local output="$2"

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$output"
    return
  fi

  if command -v wget >/dev/null 2>&1; then
    wget -qO "$output" "$url"
    return
  fi

  echo "ERROR: neither curl nor wget is available to download deploy scripts"
  exit 1
}

maybe_self_update_scripts() {
  if [[ "${AUTO_UPDATE_SCRIPTS:-0}" != "1" ]]; then
    return
  fi

  log "AUTO_UPDATE_SCRIPTS=1 -> downloading latest deploy scripts"
  download_file "$SCRIPT_REPO_RAW_BASE/deploy-from-github.sh" "$SCRIPT_DIR/deploy-from-github.sh"
  download_file "$SCRIPT_REPO_RAW_BASE/deploy-physgun.sh" "$SCRIPT_DIR/deploy-physgun.sh"
  chmod +x "$SCRIPT_DIR/deploy-from-github.sh" "$SCRIPT_DIR/deploy-physgun.sh"
  log "Deploy scripts updated successfully"
}

maybe_self_update_scripts

if [[ ! -f "$BASE_SCRIPT" ]]; then
  echo "ERROR: deploy-from-github.sh not found in $SCRIPT_DIR"
  exit 1
fi

detect_app_dir() {
  local candidates=(
    "/home/remindro/public_html"
    "/home/remindro/remind-roleplay.com"
    "/home/remindro/www"
    "/home/remindro/public.html"
    "${HOME}/public_html"
    "${HOME}/remind-roleplay.com"
    "${HOME}/www"
  )

  for dir in "${candidates[@]}"; do
    if [[ -d "$dir" ]]; then
      printf '%s' "$dir"
      return
    fi
  done

  # Fallback if none of the expected folders exists yet.
  printf '%s' "/home/remindro/public_html"
}

REPO_URL="${REPO_URL:-https://github.com/JuhlTV/remind.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-$(detect_app_dir)}"
BACKEND_SUBDIR="${BACKEND_SUBDIR:-bewerbung-portal/backend}"
RUN_DB_SETUP="${RUN_DB_SETUP:-1}"
OVERWRITE_MODE="${OVERWRITE_MODE:-hard}"
BACKUP_BEFORE_DEPLOY="${BACKUP_BEFORE_DEPLOY:-1}"

# On most game-hosting panels, restart is done via panel button/startup command.
# Keep this empty by default to avoid killing unrelated processes.
RESTART_CMD="${RESTART_CMD:-}"

export REPO_URL
export BRANCH
export APP_DIR
export BACKEND_SUBDIR
export RUN_DB_SETUP
export OVERWRITE_MODE
export BACKUP_BEFORE_DEPLOY
export RESTART_CMD

# Optional pass-throughs
export GITHUB_TOKEN="${GITHUB_TOKEN:-}"
export CREATE_OWNER="${CREATE_OWNER:-0}"
export OWNER_USER="${OWNER_USER:-}"
export OWNER_PASS="${OWNER_PASS:-}"
export OWNER_ROLE="${OWNER_ROLE:-website_owner}"
export OWNER_EMAIL="${OWNER_EMAIL:-}"

echo "Selected APP_DIR: $APP_DIR"
echo "Overwrite mode: $OVERWRITE_MODE"
echo "Backup before deploy: $BACKUP_BEFORE_DEPLOY"

bash "$BASE_SCRIPT"

echo ""
echo "Deploy complete."
echo "If your process did not auto-restart, restart it now in the Physgun panel."
