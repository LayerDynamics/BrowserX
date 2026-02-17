#!/usr/bin/env bash
# ============================================================
# setup-droplet.sh — One-time initialization of a fresh
# Digital Ocean Droplet (Ubuntu 22.04 LTS).
#
# Run this once after creating your Droplet to install Docker,
# configure the firewall, and set up the app directory.
#
# Usage:   ./scripts/setup-droplet.sh <DROPLET_IP> [SSH_USER]
# Example: ./scripts/setup-droplet.sh 143.244.x.x root
# ============================================================
set -euo pipefail

DROPLET_IP="${1:?Usage: setup-droplet.sh <DROPLET_IP> [SSH_USER]}"
SSH_USER="${2:-root}"
APP_DIR="/opt/browserx"

echo "==> Setting up Droplet at ${SSH_USER}@${DROPLET_IP}"
echo "==> App directory: ${APP_DIR}"
echo ""

ssh -o StrictHostKeyChecking=accept-new "${SSH_USER}@${DROPLET_IP}" 'bash -s' <<'REMOTE_SCRIPT'
set -euo pipefail

echo "--- Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

echo "--- Installing Docker..."
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

echo "--- Installing utilities..."
apt-get install -y -qq curl git unzip

echo "--- Configuring UFW firewall..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "--- Creating app directory..."
mkdir -p /opt/browserx/nginx
chmod 755 /opt/browserx

echo "--- Verifying Docker and Compose..."
docker --version
docker compose version

echo ""
echo "==> Droplet setup complete!"
echo "==> Next: run ./scripts/deploy.sh <TAG>"
REMOTE_SCRIPT
