#!/usr/bin/env bash
# Reset the local PostgreSQL database (drops and recreates)
# Usage: bash scripts/reset-db.sh

set -euo pipefail

echo "=== Resetting rockers_hr database ==="

docker compose exec postgres psql -U postgres -c "DROP DATABASE IF EXISTS rockers_hr;"
docker compose exec postgres psql -U postgres -c "CREATE DATABASE rockers_hr;"

echo "[OK] Database reset. Run migrations and seed:"
echo "  npm run db:migrate"
echo "  npm run db:seed"
