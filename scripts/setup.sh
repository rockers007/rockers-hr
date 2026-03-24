#!/usr/bin/env bash
# First-time setup script for Rockers HR
# Usage: bash scripts/setup.sh

set -euo pipefail

echo "=== Rockers HR — First-Time Setup ==="

# 1. Create .env from example if it doesn't exist
if [ ! -f .env ]; then
  cp .env.example .env
  echo "[OK] Created .env from .env.example — edit it with your credentials"
else
  echo "[SKIP] .env already exists"
fi

# 2. Install backend dependencies
if [ -d backend ]; then
  echo "[...] Installing backend dependencies"
  cd backend && npm install && cd ..
  echo "[OK] Backend dependencies installed"
fi

# 3. Install frontend dependencies
if [ -d frontend ]; then
  echo "[...] Installing frontend dependencies"
  cd frontend && npm install && cd ..
  echo "[OK] Frontend dependencies installed"
fi

# 4. Start PostgreSQL via Docker
echo "[...] Starting PostgreSQL"
docker compose up postgres -d
echo "[OK] PostgreSQL is running on port 5432"

echo ""
echo "=== Setup complete ==="
echo "Next steps:"
echo "  1. Edit .env with your real credentials"
echo "  2. Run: npm run db:migrate"
echo "  3. Run: npm run db:seed"
echo "  4. Run: npm run dev:backend  (terminal 1)"
echo "  5. Run: npm run dev:frontend (terminal 2)"
