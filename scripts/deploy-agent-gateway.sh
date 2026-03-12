#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== Build agent-gateway image =="
sudo /usr/local/bin/buildctl \
  --addr unix:///run/buildkit/buildkitd.sock \
  build \
  --frontend dockerfile.v0 \
  --local context=. \
  --local dockerfile=. \
  --opt filename=docker/agent-gateway/Dockerfile \
  --output type=image,name=docker.io/library/agent-gateway:latest \
  --export-cache type=inline \
  --import-cache type=registry,ref=docker.io/library/agent-gateway:latest || true

echo "== Apply Kubernetes manifests =="
kubectl apply -k kubernetes/overlays/lab

echo "== Wait for rollout =="
kubectl rollout status deployment/agent-gateway -n cloudmart --timeout=120s

echo "== Health check =="
curl -fsS http://agent.cloudmart.lab/healthz
echo
