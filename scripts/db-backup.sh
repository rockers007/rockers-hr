#!/bin/bash
#
# Daily PostgreSQL backup to AWS S3 with 7-day retention.
#
# Usage:
#   ./scripts/db-backup.sh
#
# Can be triggered by NestJS cron or an external cron job.
# Requires: pg_dump, aws CLI, gzip
#
# Environment variables (reads from .env if present):
#   DATABASE_URL        — PostgreSQL connection string
#   AWS_ACCESS_KEY_ID   — AWS credentials
#   AWS_SECRET_ACCESS_KEY
#   AWS_S3_BUCKET       — Target S3 bucket
#   AWS_REGION          — AWS region
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load .env if present
if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  source "$PROJECT_ROOT/.env"
  set +a
fi

# ─── Config ───
S3_BUCKET="${AWS_S3_BUCKET:?AWS_S3_BUCKET is required}"
S3_PREFIX="db-backups"
RETENTION_DAYS=7
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="rockers_hr_${TIMESTAMP}.sql.gz"
TMP_DIR="${PROJECT_ROOT}/tmp"

mkdir -p "$TMP_DIR"

echo "[$(date)] Starting database backup..."

# ─── Dump ───
# Parse DATABASE_URL or use Docker container
if [ -n "${DATABASE_URL:-}" ]; then
  pg_dump "$DATABASE_URL" --no-owner --no-privileges | gzip > "$TMP_DIR/$BACKUP_FILE"
else
  # Fallback: dump from Docker container
  docker exec rockers-hr-db pg_dump -U postgres rockers_hr | gzip > "$TMP_DIR/$BACKUP_FILE"
fi

FILESIZE=$(du -h "$TMP_DIR/$BACKUP_FILE" | cut -f1)
echo "[$(date)] Backup created: $BACKUP_FILE ($FILESIZE)"

# ─── Upload to S3 ───
aws s3 cp "$TMP_DIR/$BACKUP_FILE" "s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_FILE}" \
  --region "${AWS_REGION:-us-east-1}" \
  --storage-class STANDARD_IA

echo "[$(date)] Uploaded to s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_FILE}"

# ─── Cleanup: remove backups older than 7 days from S3 ───
CUTOFF_DATE=$(date -d "-${RETENTION_DAYS} days" +%Y-%m-%d 2>/dev/null || date -v-${RETENTION_DAYS}d +%Y-%m-%d)

echo "[$(date)] Cleaning up backups older than $CUTOFF_DATE..."

aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" --region "${AWS_REGION:-us-east-1}" | while read -r line; do
  FILE_DATE=$(echo "$line" | awk '{print $1}')
  FILE_NAME=$(echo "$line" | awk '{print $4}')

  if [ -z "$FILE_NAME" ]; then
    continue
  fi

  if [[ "$FILE_DATE" < "$CUTOFF_DATE" ]]; then
    echo "  Deleting old backup: $FILE_NAME (from $FILE_DATE)"
    aws s3 rm "s3://${S3_BUCKET}/${S3_PREFIX}/${FILE_NAME}" --region "${AWS_REGION:-us-east-1}"
  fi
done

# ─── Cleanup local temp file ───
rm -f "$TMP_DIR/$BACKUP_FILE"

echo "[$(date)] Backup complete. Retained last ${RETENTION_DAYS} days."
