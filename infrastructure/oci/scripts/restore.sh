#!/usr/bin/env bash
# Restore from a backup file. Use this in two scenarios:
#   1. Building a new VM after a disaster (download from Object Storage)
#   2. Local pg restore from /opt/rockers-hr/backups/<file>.sql.gz
#
# Examples:
#   # Restore latest backup from local backups dir:
#   ./restore.sh latest
#
#   # Restore a specific local file:
#   ./restore.sh /opt/rockers-hr/backups/rockers_hr_20260501_030000.sql.gz
#
#   # Restore from Object Storage (downloads first):
#   ./restore.sh oci://rockers_hr_20260501_030000.sql.gz
#
# WARNING: this DROPS and recreates the database. Stop the backend
# first to avoid concurrent writes during the restore:
#   docker compose -f docker-compose.production.yml stop backend
# After restore:
#   docker compose -f docker-compose.production.yml start backend

set -euo pipefail

ROOT=/opt/rockers-hr
ENV_FILE="$ROOT/infrastructure/oci/.env.production"
COMPOSE="docker compose -f $ROOT/infrastructure/oci/docker-compose.production.yml --env-file $ENV_FILE"

# shellcheck disable=SC1090
source <(grep -E '^(POSTGRES_USER|POSTGRES_PASSWORD|POSTGRES_DB|AWS_S3_BUCKET|BACKUP_BUCKET)=' "$ENV_FILE" | sed 's/^/export /')

BUCKET="${BACKUP_BUCKET:-${AWS_S3_BUCKET}-backups}"

INPUT="${1:-}"
if [[ -z "$INPUT" ]]; then
    echo "Usage: $0 latest | <local-path> | oci://<object-name>"
    exit 1
fi

resolve_path() {
    case "$1" in
        latest)
            find "$ROOT/backups" -maxdepth 1 -name 'rockers_hr_*.sql.gz' -printf '%T@ %p\n' \
                | sort -nr | head -n1 | awk '{print $2}'
            ;;
        oci://*)
            local OBJ="${1#oci://}"
            local DST="$ROOT/backups/$OBJ"
            echo "Downloading $OBJ from Object Storage…" >&2
            oci os object get --bucket-name "$BUCKET" --name "$OBJ" --file "$DST" >&2
            echo "$DST"
            ;;
        *) echo "$1" ;;
    esac
}

FILE="$(resolve_path "$INPUT")"
if [[ ! -f "$FILE" ]]; then
    echo "Backup file not found: $FILE"
    exit 2
fi

echo "Restoring from: $FILE"
echo "Target DB: $POSTGRES_DB on the postgres container"
read -rp "This will DROP and recreate $POSTGRES_DB. Continue? [yes/NO] " ANSWER
[[ "$ANSWER" == "yes" ]] || { echo "Aborted."; exit 0; }

echo "Stopping backend (if running) so writes don't race the restore…"
$COMPOSE stop backend || true

echo "Dropping + recreating database…"
$COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\";"
$COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE \"$POSTGRES_DB\" OWNER \"$POSTGRES_USER\";"

echo "Loading dump…"
gunzip -c "$FILE" | $COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

echo "Restarting backend…"
$COMPOSE start backend
echo "Restore complete. Tail logs with:"
echo "  $COMPOSE logs -f backend"
