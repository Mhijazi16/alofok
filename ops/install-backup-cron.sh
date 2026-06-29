#!/usr/bin/env bash
# Installs the nightly DB backup cron (02:30 daily). Idempotent.
set -euo pipefail

APP_DIR="${APP_DIR:-/root/alofok}"
SCRIPT="$APP_DIR/ops/backup-db.sh"
LOG="/var/log/alofok-backup.log"
CRON_LINE="30 2 * * * $SCRIPT >> $LOG 2>&1"

chmod +x "$SCRIPT"
# Replace any existing alofok backup line, then add the current one.
# Tolerate root having no crontab yet (crontab -l exits non-zero in that case).
existing="$(crontab -l 2>/dev/null | grep -v "ops/backup-db.sh" || true)"
printf '%s\n%s\n' "$existing" "$CRON_LINE" | grep -v '^[[:space:]]*$' | crontab -
echo "Installed cron:"
crontab -l | grep "ops/backup-db.sh"
echo "Running one backup now to verify..."
"$SCRIPT"
