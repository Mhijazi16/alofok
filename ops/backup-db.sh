#!/usr/bin/env bash
# Nightly Postgres backup for Alofok (Horizon).
# Dumps the `horizon` DB to /root/backups with custom format, keeps 14 days.
# Install via ops/install-backup-cron.sh. Logs to /var/log/alofok-backup.log.
#
# Optional offsite: set RCLONE_REMOTE (e.g. "b2:my-bucket/alofok") and have
# rclone configured; the dump is then copied offsite after each run.
set -euo pipefail

APP_DIR="${APP_DIR:-/root/alofok}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"

mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/horizon-$TS.dump"

# Use the compose project so we hit the right container regardless of name.
cd "$APP_DIR"
docker compose exec -T db pg_dump -U postgres -Fc horizon > "$OUT"

# Integrity: a custom-format dump starts with the "PGDMP" magic.
if ! head -c5 "$OUT" | grep -q "PGDMP"; then
    echo "$(date -Is) ERROR: dump $OUT failed integrity check" >&2
    rm -f "$OUT"
    exit 1
fi

SIZE="$(du -h "$OUT" | cut -f1)"
echo "$(date -Is) OK: wrote $OUT ($SIZE)"

# Rotate old dumps.
find "$BACKUP_DIR" -name 'horizon-*.dump' -mtime "+$RETENTION_DAYS" -delete

# Optional offsite copy.
if [ -n "$RCLONE_REMOTE" ] && command -v rclone >/dev/null 2>&1; then
    rclone copy "$OUT" "$RCLONE_REMOTE" && echo "$(date -Is) OK: pushed to $RCLONE_REMOTE"
fi
