#!/usr/bin/env bash
# One-command deploy script. Run this on the OCI VM after the
# repository has been cloned to /opt/rockers-hr and .env.production
# has been filled in. Idempotent — safe to re-run after a code pull.
#
#   sudo /opt/rockers-hr/infrastructure/oci/scripts/deploy.sh
#
# What it does:
#   1. Verifies prerequisites (docker, docker compose, certbot).
#   2. Renders nginx default.conf with the real domain.
#   3. Pulls the latest code (git pull) if --pull is passed.
#   4. Builds backend + frontend images.
#   5. Brings the docker compose stack up.
#   6. Issues / renews TLS cert via certbot.
#   7. Reloads nginx so the new cert is live.
#   8. Tail-blocks for 10s of healthchecks and prints status.

set -euo pipefail

ROOT=/opt/rockers-hr
INFRA=$ROOT/infrastructure/oci
ENV_FILE=$INFRA/.env.production
COMPOSE_FILE=$INFRA/docker-compose.production.yml
CONF_TEMPLATE=$INFRA/nginx/conf.d/default.conf

PULL=false
case "${1:-}" in
    --pull) PULL=true ;;
esac

red()   { printf '\033[0;31m%s\033[0m\n' "$*"; }
green() { printf '\033[0;32m%s\033[0m\n' "$*"; }
info()  { printf '\033[0;34m[deploy] %s\033[0m\n' "$*"; }

[[ "$EUID" -eq 0 ]] || { red "Run as root (sudo)."; exit 1; }
[[ -f "$ENV_FILE" ]] || { red "$ENV_FILE missing — copy .env.production.example and fill it."; exit 1; }

# Load DOMAIN, ACME_EMAIL — needed for nginx + certbot.
# shellcheck disable=SC1090
source <(grep -E '^(DOMAIN|ACME_EMAIL)=' "$ENV_FILE" | sed 's/^/export /')
[[ -n "${DOMAIN:-}" ]]      || { red 'DOMAIN not set in .env.production'; exit 1; }
[[ -n "${ACME_EMAIL:-}" ]]  || { red 'ACME_EMAIL not set in .env.production'; exit 1; }

# 1. Prereqs
info "Checking prerequisites…"
for bin in docker git certbot; do
    command -v "$bin" >/dev/null || { red "Missing: $bin (install via cloud-init or apt)"; exit 1; }
done
docker compose version >/dev/null || { red "docker compose plugin missing"; exit 1; }
green "✓ prerequisites ok"

# 2. Pull (optional)
if $PULL; then
    info "git pull…"
    git -C "$ROOT" pull --ff-only
fi

# 3. Render nginx config from the placeholder template.
info "Rendering nginx config for DOMAIN=$DOMAIN…"
sed "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" "$CONF_TEMPLATE" > "$INFRA/nginx/conf.d/default.conf.rendered"
mv "$INFRA/nginx/conf.d/default.conf.rendered" "$INFRA/nginx/conf.d/default.conf"

# 4. Issue cert if missing — has to happen BEFORE the production
# nginx config is loaded, otherwise nginx won't start (cert paths
# don't exist yet). Use webroot mode against a throwaway nginx
# config that only serves /.well-known.
if [[ ! -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem ]]; then
    info "Issuing first TLS cert via certbot (webroot)…"
    mkdir -p /var/www/certbot
    certbot certonly \
        --webroot -w /var/www/certbot \
        -d "$DOMAIN" \
        --email "$ACME_EMAIL" \
        --agree-tos --no-eff-email --non-interactive
fi
green "✓ TLS cert in place"

# 5. Build + bring the stack up.
info "Building images + starting stack…"
cd "$INFRA"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

# 6. Wait for backend health, then summarise.
info "Waiting up to 60s for backend to be healthy…"
for i in $(seq 1 12); do
    sleep 5
    STATUS=$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps --format json backend \
                | grep -oE '"Health":"[^"]+"' | cut -d'"' -f4 || true)
    [[ "$STATUS" == "healthy" ]] && break
    info "  waiting… (status=$STATUS)"
done

info "Stack status:"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

green ""
green "Deploy finished. Public URL: https://$DOMAIN"
green "Tail logs with:"
green "  docker compose -f $COMPOSE_FILE --env-file $ENV_FILE logs -f"
