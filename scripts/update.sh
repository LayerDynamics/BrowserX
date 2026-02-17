#!/usr/bin/env bash
# ============================================================
# update.sh — Rolling update from pre-built GHCR images.
#
# Used by GitHub Actions after images are pushed to GHCR.
# Performs a zero-downtime rolling restart:
#   1. Restart browserx-api and wait for health
#   2. Restart doc-site
#   3. Reload nginx
#
# Usage:
#   ./scripts/update.sh [DROPLET_IP] [SSH_USER]
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "${SCRIPT_DIR}")"
ENV_FILE="${ROOT_DIR}/.env"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

DROPLET_IP="${1:-${DROPLET_IP:?Set DROPLET_IP in .env or pass as argument}}"
SSH_USER="${2:-${DO_SSH_USER:-root}}"
APP_DIR="/opt/browserx"

echo "==> Rolling update on ${SSH_USER}@${DROPLET_IP}"
echo ""

ssh "${SSH_USER}@${DROPLET_IP}" 'bash -s' <<'REMOTE_SCRIPT'
set -e
cd /opt/browserx

echo "--- Pulling latest images from GHCR..."
docker compose -f docker-compose.yml -f docker-compose.override.yml pull

echo "--- Restarting browserx-api..."
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  up -d --no-deps browserx-api

echo "--- Waiting for browserx-api to become healthy..."
MAX_ATTEMPTS=24
attempt=0
until curl -fsS http://localhost:8080/health > /dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [[ ${attempt} -ge ${MAX_ATTEMPTS} ]]; then
    echo "ERROR: browserx-api did not become healthy within 2 minutes"
    docker compose logs --tail=50 browserx-api
    exit 1
  fi
  echo "  Attempt ${attempt}/${MAX_ATTEMPTS} — waiting 5s..."
  sleep 5
done
echo "  browserx-api is healthy."

echo "--- Restarting doc-site..."
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  up -d --no-deps doc-site

echo "--- Reloading nginx..."
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  exec -T nginx nginx -s reload || \
  docker compose -f docker-compose.yml -f docker-compose.override.yml \
    up -d --no-deps nginx

echo "--- Cleaning up old images..."
docker system prune -f

echo ""
echo "Update complete!"
docker compose ps
REMOTE_SCRIPT

echo ""
echo "==> Update complete! http://${DROPLET_IP}"
