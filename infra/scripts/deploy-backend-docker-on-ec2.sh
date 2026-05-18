#!/usr/bin/env bash
# Run ON the EC2 instance after cloning this repo (or copying files).
# Usage:
#   sudo bash infra/scripts/deploy-backend-docker-on-ec2.sh
set -euo pipefail

PORT="${PORT:-5020}"
IMAGE_TAG="${IMAGE_TAG:-crop-api:latest}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker not installed. Install with: sudo dnf install -y docker && sudo systemctl enable --now docker"
  exit 1
fi

echo "Building $IMAGE_TAG from $ROOT ..."
sudo docker build -f infra/docker/Dockerfile.backend -t "$IMAGE_TAG" .

sudo docker rm -f crop-api 2>/dev/null || true
sudo docker run -d \
  --name crop-api \
  --restart unless-stopped \
  -p "${PORT}:${PORT}" \
  -e PORT="$PORT" \
  -e FLASK_DEBUG=false \
  "$IMAGE_TAG"

echo "Backend listening on 0.0.0.0:${PORT}"
curl -fsS "http://127.0.0.1:${PORT}/api/health" || echo "(health check failed — models may still be loading)"
