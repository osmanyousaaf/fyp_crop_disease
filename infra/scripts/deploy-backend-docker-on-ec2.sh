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

# Long random secrets fix PyJWT "InsecureKeyLengthWarning" and weak defaults.
# Reuses /etc/crop-api.env across redeploys so existing JWTs stay valid until you delete that file.
SECRET_FILE="/etc/crop-api.env"
load_or_create_secrets() {
  if [[ -f "$SECRET_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$SECRET_FILE"
    set +a
  fi
  if [[ -z "${JWT_SECRET_KEY:-}" ]] || [[ -z "${FLASK_SECRET_KEY:-}" ]]; then
    if ! command -v openssl >/dev/null 2>&1; then
      echo "openssl not found; install openssl or set JWT_SECRET_KEY and FLASK_SECRET_KEY in the environment."
      exit 1
    fi
    JWT_SECRET_KEY="$(openssl rand -hex 32)"
    FLASK_SECRET_KEY="$(openssl rand -hex 32)"
    umask 077
    printf 'JWT_SECRET_KEY=%s\nFLASK_SECRET_KEY=%s\n' "$JWT_SECRET_KEY" "$FLASK_SECRET_KEY" >"$SECRET_FILE"
    chmod 600 "$SECRET_FILE"
    echo "Created ${SECRET_FILE} with random secrets (64-char hex each). Reused on future deploys."
  fi
}
load_or_create_secrets

echo "Building $IMAGE_TAG from $ROOT ..."
sudo docker build -f infra/docker/Dockerfile.backend -t "$IMAGE_TAG" .

sudo docker rm -f crop-api 2>/dev/null || true
sudo docker run -d \
  --name crop-api \
  --restart unless-stopped \
  -p "${PORT}:${PORT}" \
  -e PORT="$PORT" \
  -e FLASK_DEBUG=false \
  -e FLASK_SECRET_KEY="$FLASK_SECRET_KEY" \
  -e JWT_SECRET_KEY="$JWT_SECRET_KEY" \
  -e TF_CPP_MIN_LOG_LEVEL=2 \
  -e CUDA_VISIBLE_DEVICES=-1 \
  "$IMAGE_TAG"

echo "Backend listening on 0.0.0.0:${PORT}"
echo "Waiting for HTTP (models load in background; first OK may show loading_models) ..."
for i in $(seq 1 120); do
  if response="$(curl -fsS "http://127.0.0.1:${PORT}/api/health" 2>/dev/null)"; then
    echo "$response"
    exit 0
  fi
  sleep 2
done
echo "Health check still failing after ~4m — see: sudo docker logs crop-api"
exit 1
