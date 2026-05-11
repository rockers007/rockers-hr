#!/usr/bin/env bash
# Off-box backup: ship the latest pg_dump from /opt/rockers-hr/backups
# to OCI Object Storage. Cron runs this every day.
#
# Usage from VM cron (see deploy.sh which installs the crontab line):
#   0 3 * * *  /opt/rockers-hr/infrastructure/oci/scripts/backup.sh
#
# Requires `oci` CLI installed (deploy.sh installs it via OCI's
# official install script) and ~/.oci/config configured for an IAM
# user with PUT / DELETE permission on the backup bucket. The CLI
# is preferred over s3-compat because OCI's signed-request auth is
# already wired up via ~/.oci/config — no extra credentials to leak.

set -euo pipefail

ROOT=/opt/rockers-hr
LOG="$ROOT/backups/backup.log"
BACKUPS_DIR="$ROOT/backups"
ENV_FILE="$ROOT/infrastructure/oci/.env.production"

# Read BACKUP_BUCKET from env, fall back to AWS_S3_BUCKET-backups.
# shellcheck disable=SC1090
[[ -f $ENV_FILE ]] && source <(grep -E '^(AWS_S3_BUCKET|BACKUP_BUCKET|BACKUP_NAMESPACE|BACKUP_RETENTION_DAYS)=' "$ENV_FILE")

BUCKET="${BACKUP_BUCKET:-${AWS_S3_BUCKET:-rockers-hr}-backups}"
NAMESPACE="${BACKUP_NAMESPACE:-}"   # set in .env if you want — or `oci os ns get` is auto-resolved
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-90}"

log() { printf '[%s] %s\n' "$(date -Is)" "$*" >> "$LOG"; }

# Find the freshest backup file emitted by the in-compose backup
# container. The container's loop writes one .sql.gz per day named
# rockers_hr_<UTC stamp>.sql.gz.
LATEST="$(find "$BACKUPS_DIR" -maxdepth 1 -name 'rockers_hr_*.sql.gz' -printf '%T@ %p\n' \
            | sort -nr | head -n1 | awk '{print $2}')"

if [[ -z "${LATEST:-}" ]]; then
    log "ERROR: no backup file found in $BACKUPS_DIR — is the backup container running?"
    exit 1
fi

OBJECT_NAME="$(basename "$LATEST")"
log "Uploading $OBJECT_NAME to bucket $BUCKET"

# Use OCI CLI — picks up the namespace automatically from the
# tenancy in ~/.oci/config when --namespace is omitted.
NS_ARG=()
[[ -n "$NAMESPACE" ]] && NS_ARG=(--namespace-name "$NAMESPACE")

if oci os object put "${NS_ARG[@]}" \
        --bucket-name "$BUCKET" \
        --file "$LATEST" \
        --name "$OBJECT_NAME" \
        --force \
        >> "$LOG" 2>&1; then
    log "OK: $OBJECT_NAME uploaded ($(du -h "$LATEST" | awk '{print $1}'))"
else
    log "ERROR: upload failed for $OBJECT_NAME"
    exit 2
fi

# Prune objects in the bucket older than $RETENTION_DAYS.
# Object Storage keeps objects forever; we have to enumerate and delete
# manually. Cheap because the list is small.
CUTOFF=$(date -u -d "${RETENTION_DAYS} days ago" +%Y-%m-%dT%H:%M:%S)
log "Pruning objects older than $CUTOFF"

oci os object list "${NS_ARG[@]}" --bucket-name "$BUCKET" \
        --query "data[?\"time-modified\" < '${CUTOFF}'].name" \
        --raw-output 2>>"$LOG" \
    | tr -d '[]"' | tr ',' '\n' | sed '/^\s*$/d' \
    | while read -r OBJ; do
        OBJ="${OBJ## }"; OBJ="${OBJ%% }"
        [[ -z "$OBJ" ]] && continue
        log "Pruning old object: $OBJ"
        oci os object delete "${NS_ARG[@]}" --bucket-name "$BUCKET" --object-name "$OBJ" --force >>"$LOG" 2>&1 || \
            log "WARN: prune failed for $OBJ"
    done

log "Backup cycle complete."
