#!/bin/bash
#
# Update ngrok URL in all config files.
#
# Usage:
#   ./scripts/update-ngrok.sh abc123-1-2-3-4.ngrok-free.app
#   ./scripts/update-ngrok.sh https://abc123-1-2-3-4.ngrok-free.app
#
# What it updates:
#   - .env: GOOGLE_CALLBACK_URL, FRONTEND_URL
#   - backend/.env: GOOGLE_CALLBACK_URL, FRONTEND_URL
#
# After running, restart the backend for changes to take effect.
# You must ALSO add the callback URL to Google Cloud Console:
#   https://<ngrok-url>/api/v1/auth/google/callback
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <ngrok-subdomain>"
  echo "Example: $0 abc123-1-2-3-4.ngrok-free.app"
  echo "Example: $0 https://abc123-1-2-3-4.ngrok-free.app"
  exit 1
fi

# Strip protocol if provided
NGROK_URL="${1#https://}"
NGROK_URL="${NGROK_URL#http://}"
NGROK_URL="${NGROK_URL%/}"  # Remove trailing slash

echo "Updating ngrok URL to: https://$NGROK_URL"

# Find and replace any existing ngrok URL in .env files
for envfile in "$PROJECT_ROOT/.env" "$PROJECT_ROOT/backend/.env"; do
  if [ -f "$envfile" ]; then
    # Update GOOGLE_CALLBACK_URL
    sed -i "s|GOOGLE_CALLBACK_URL=.*|GOOGLE_CALLBACK_URL=https://$NGROK_URL/api/v1/auth/google/callback|" "$envfile"
    # Update FRONTEND_URL
    sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=https://$NGROK_URL|" "$envfile"
    echo "  Updated: $envfile"
  fi
done

echo ""
echo "Done! Next steps:"
echo "  1. Restart the backend: npm run dev:backend"
echo "  2. Add this redirect URI to Google Cloud Console:"
echo "     https://$NGROK_URL/api/v1/auth/google/callback"
echo ""
echo "  Google Console: https://console.cloud.google.com/apis/credentials"
