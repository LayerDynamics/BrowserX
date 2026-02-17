#!/usr/bin/env bash
# ============================================================
# deploy.sh — Full deployment to Digital Ocean Droplet.
#
# Builds Docker images locally, pushes to GHCR, copies
# compose files to the Droplet, and starts the stack.
#
# Usage:
#   ./scripts/deploy.sh [TAG]
# Examples:
#   ./scripts/deploy.sh             # uses "latest"
#   ./scripts/deploy.sh v1.0.0      # uses "v1.0.0"
#
# Requires .env with: DROPLET_IP, GHCR_USERNAME, GHCR_TOKEN
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "${SCRIPT_DIR}")"
ENV_FILE="${ROOT_DIR}/.env"

# Load .env if present
if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

DROPLET_IP="${DROPLET_IP:?Set DROPLET_IP in .env or environment}"
SSH_USER="${DO_SSH_USER:-root}"
REGISTRY_USER="${GHCR_USERNAME:?Set GHCR_USERNAME in .env}"
TAG="${1:-latest}"
APP_DIR="/opt/browserx"
REGISTRY="ghcr.io/${REGISTRY_USER}"

echo "==> BrowserX Deploy"
echo "    Target:   ${SSH_USER}@${DROPLET_IP}:${APP_DIR}"
echo "    Registry: ${REGISTRY}"
echo "    Tag:      ${TAG}"
echo ""

# ── 1. Build images ──────────────────────────────────────────
echo "--- Building Docker images..."
cd "${ROOT_DIR}"
docker compose build

# ── 2. Tag for GHCR ─────────────────────────────────────────
echo "--- Tagging images for GHCR..."
docker tag browserx-browserx-api:latest "${REGISTRY}/browserx-api:${TAG}"
docker tag browserx-browserx-api:latest "${REGISTRY}/browserx-api:latest"
docker tag browserx-doc-site:latest     "${REGISTRY}/browserx-doc-site:${TAG}"
docker tag browserx-doc-site:latest     "${REGISTRY}/browserx-doc-site:latest"

# ── 3. Push to GHCR ─────────────────────────────────────────
echo "--- Pushing to ghcr.io..."
echo "${GHCR_TOKEN:?Set GHCR_TOKEN in .env}" \
  | docker login ghcr.io -u "${REGISTRY_USER}" --password-stdin
docker push "${REGISTRY}/browserx-api:${TAG}"
docker push "${REGISTRY}/browserx-api:latest"
docker push "${REGISTRY}/browserx-doc-site:${TAG}"
docker push "${REGISTRY}/browserx-doc-site:latest"

# ── 4. Copy deployment files to Droplet ──────────────────────
echo "--- Copying compose + nginx config to Droplet..."
ssh "${SSH_USER}@${DROPLET_IP}" "mkdir -p ${APP_DIR}/nginx"
scp "${ROOT_DIR}/docker-compose.yml" \
    "${SSH_USER}@${DROPLET_IP}:${APP_DIR}/docker-compose.yml"
scp "${ROOT_DIR}/nginx/browserx.conf" \
    "${SSH_USER}@${DROPLET_IP}:${APP_DIR}/nginx/browserx.conf"

# ── 5. Deploy on Droplet ─────────────────────────────────────
echo "--- Deploying on Droplet..."
ssh "${SSH_USER}@${DROPLET_IP}" "
  set -e
  cd '${APP_DIR}'

  cat > docker-compose.override.yml <<'OVERRIDE_EOF'
services:
  browserx-api:
    image: ${REGISTRY}/browserx-api:${TAG}
    build: ~
  doc-site:
    image: ${REGISTRY}/browserx-doc-site:${TAG}
    build: ~
OVERRIDE_EOF

  echo '--- Pulling images from GHCR...'
  docker compose -f docker-compose.yml -f docker-compose.override.yml pull

  echo '--- Starting services...'
  docker compose -f docker-compose.yml -f docker-compose.override.yml \
    up -d --remove-orphans

  echo '--- Cleaning up old images...'
  docker system prune -f

  echo ''
  echo 'Deploy complete!'
  docker compose ps
"

echo ""
echo "==> Deployment complete!"
echo "==> Site:   http://${DROPLET_IP}"
echo "==> Health: curl http://${DROPLET_IP}/health"
