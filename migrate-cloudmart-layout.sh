#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
TARGET="$ROOT/CMLS"
DRY_RUN="${DRY_RUN:-1}"

log() {
  echo "[INFO] $*"
}

run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[DRY-RUN] $*"
  else
    eval "$@"
  fi
}

ensure_dir() {
  run "mkdir -p \"$1\""
}

move_if_exists() {
  local src="$1"
  local dst="$2"

  if [[ -f "$src" ]]; then
    ensure_dir "$(dirname "$dst")"
    run "mv \"$src\" \"$dst\""
  fi
}

copy_if_exists() {
  local src="$1"
  local dst="$2"

  if [[ -f "$src" ]]; then
    ensure_dir "$(dirname "$dst")"
    run "cp \"$src\" \"$dst\""
  fi
}

archive_if_exists() {
  local src="$1"
  local dst="$TARGET/archive/$2"

  if [[ -f "$src" ]]; then
    ensure_dir "$(dirname "$dst")"
    run "mv \"$src\" \"$dst\""
  fi
}

create_structure() {
  log "Creating target structure"

  ensure_dir "$TARGET/docs"
  ensure_dir "$TARGET/kubernetes/base/namespace"
  ensure_dir "$TARGET/kubernetes/base/agent-gateway"
  ensure_dir "$TARGET/kubernetes/base/ollama"
  ensure_dir "$TARGET/kubernetes/base/monitoring/dashboards"
  ensure_dir "$TARGET/kubernetes/base/localstack"
  ensure_dir "$TARGET/kubernetes/overlays/dev"
  ensure_dir "$TARGET/kubernetes/overlays/lab"
  ensure_dir "$TARGET/docker/agent-gateway"
  ensure_dir "$TARGET/docker/backend"
  ensure_dir "$TARGET/docker/frontend"
  ensure_dir "$TARGET/scripts"
  ensure_dir "$TARGET/archive/aws-original"
  ensure_dir "$TARGET/archive/debug"
  ensure_dir "$TARGET/archive/old-ingress"

  run "touch \"$TARGET/README.md\""
  run "touch \"$TARGET/docs/architecture.md\""
  run "touch \"$TARGET/docs/deployment-order.md\""
  run "touch \"$TARGET/docs/localstack-mapping.md\""
  run "touch \"$TARGET/docs/rollback.md\""

  run "touch \"$TARGET/kubernetes/base/namespace/cloudmart-namespace.yaml\""
  run "touch \"$TARGET/kubernetes/base/agent-gateway/configmap-app.yaml\""
  run "touch \"$TARGET/kubernetes/base/agent-gateway/configmap-env.yaml\""
  run "touch \"$TARGET/kubernetes/base/agent-gateway/deployment.yaml\""
  run "touch \"$TARGET/kubernetes/base/agent-gateway/service.yaml\""
  run "touch \"$TARGET/kubernetes/base/agent-gateway/ingress.yaml\""
  run "touch \"$TARGET/kubernetes/base/agent-gateway/servicemonitor.yaml\""
  run "touch \"$TARGET/kubernetes/base/ollama/service.yaml\""
  run "touch \"$TARGET/kubernetes/base/ollama/endpoints.yaml\""
  run "touch \"$TARGET/kubernetes/base/monitoring/grafana-ingress.yaml\""
  run "touch \"$TARGET/kubernetes/base/monitoring/prometheus-rules.yaml\""
  run "touch \"$TARGET/kubernetes/base/localstack/notes.md\""
  run "touch \"$TARGET/kubernetes/base/localstack/optional-job-init-dynamodb.yaml\""

  run "touch \"$TARGET/kubernetes/overlays/dev/kustomization.yaml\""
  run "touch \"$TARGET/kubernetes/overlays/lab/kustomization.yaml\""

  run "touch \"$TARGET/docker/agent-gateway/Dockerfile\""
  run "touch \"$TARGET/docker/agent-gateway/requirements.txt\""
  run "touch \"$TARGET/docker/backend/Dockerfile\""
  run "touch \"$TARGET/docker/frontend/Dockerfile\""

  run "touch \"$TARGET/scripts/apply.sh\""
  run "touch \"$TARGET/scripts/delete.sh\""
  run "touch \"$TARGET/scripts/smoke-tests.sh\""
  run "touch \"$TARGET/scripts/port-forward.sh\""
}

migrate_known_files() {
  log "Migrating known active files"

  move_if_exists "$ROOT/agent-gateway-env-configmap.yaml" \
    "$TARGET/kubernetes/base/agent-gateway/configmap-env.yaml"

  move_if_exists "$ROOT/agent-gateway-configmap.yaml" \
    "$TARGET/kubernetes/base/agent-gateway/configmap-app.yaml"

  move_if_exists "$ROOT/agent-gateway.yaml" \
    "$TARGET/kubernetes/base/agent-gateway/deployment.yaml"

  move_if_exists "$ROOT/agent-gateway-service.yaml" \
    "$TARGET/kubernetes/base/agent-gateway/service.yaml"

  move_if_exists "$ROOT/agent-gateway-ingress.yaml" \
    "$TARGET/kubernetes/base/agent-gateway/ingress.yaml"

  move_if_exists "$ROOT/agent-gateway-servicemonitor.yaml" \
    "$TARGET/kubernetes/base/agent-gateway/servicemonitor.yaml"

  move_if_exists "$ROOT/ollama-service.yaml" \
    "$TARGET/kubernetes/base/ollama/service.yaml"

  move_if_exists "$ROOT/ollama-endpoints.yaml" \
    "$TARGET/kubernetes/base/ollama/endpoints.yaml"

  move_if_exists "$ROOT/grafana-ingress.yaml" \
    "$TARGET/kubernetes/base/monitoring/grafana-ingress.yaml"

  move_if_exists "$ROOT/prometheus-rules.yaml" \
    "$TARGET/kubernetes/base/monitoring/prometheus-rules.yaml"

  move_if_exists "$ROOT/cloudmart-namespace.yaml" \
    "$TARGET/kubernetes/base/namespace/cloudmart-namespace.yaml"

  move_if_exists "$ROOT/README.md" \
    "$TARGET/README.md"

  move_if_exists "$ROOT/Dockerfile" \
    "$TARGET/docker/agent-gateway/Dockerfile"

  move_if_exists "$ROOT/requirements.txt" \
    "$TARGET/docker/agent-gateway/requirements.txt"
}

archive_patterns() {
  log "Archiving likely obsolete or temporary files"

  shopt -s nullglob

  for f in \
    "$ROOT"/*debug*.yaml \
    "$ROOT"/*test*.yaml \
    "$ROOT"/*tmp*.yaml \
    "$ROOT"/*copy*.yaml \
    "$ROOT"/*old*.yaml \
    "$ROOT"/*bak*.yaml \
    "$ROOT"/*backup*.yaml \
    "$ROOT"/*experimental*.yaml \
    "$ROOT"/*traefik*.yaml
  do
    if [[ -f "$f" ]]; then
      archive_if_exists "$f" "debug/$(basename "$f")"
    fi
  done

  for f in \
    "$ROOT"/*aws*.yaml \
    "$ROOT"/*eks*.yaml \
    "$ROOT"/*alb*.yaml \
    "$ROOT"/*bedrock*.yaml \
    "$ROOT"/*lambda*.yaml \
    "$ROOT"/*irsa*.yaml
  do
    if [[ -f "$f" ]]; then
      archive_if_exists "$f" "aws-original/$(basename "$f")"
    fi
  done

  for f in \
    "$ROOT"/*ingress-old*.yaml \
    "$ROOT"/*old-ingress*.yaml \
    "$ROOT"/*legacy-ingress*.yaml
  do
    if [[ -f "$f" ]]; then
      archive_if_exists "$f" "old-ingress/$(basename "$f")"
    fi
  done

  shopt -u nullglob
}

generate_reports() {
  log "Generating helper reports"

  ensure_dir "$TARGET/docs"

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[DRY-RUN] Would write migration report to $TARGET/docs/current-status.md"
  else
    cat > "$TARGET/docs/current-status.md" <<REPORT
# Current migration status

This repository was reorganized into a canonical CloudMart LocalStack-first layout.

## Main active areas
- kubernetes/base/namespace
- kubernetes/base/agent-gateway
- kubernetes/base/ollama
- kubernetes/base/monitoring
- docker
- scripts

## Archived areas
- archive/aws-original
- archive/debug
- archive/old-ingress
REPORT
  fi
}

main() {
  log "ROOT=$ROOT"
  log "TARGET=$TARGET"
  log "DRY_RUN=$DRY_RUN"

  create_structure
  migrate_known_files
  archive_patterns
  generate_reports

  log "Done"
  if [[ "$DRY_RUN" == "1" ]]; then
    log "This was a dry run only. Re-run with: DRY_RUN=0 ./migrate-cloudmart-layout.sh"
  fi
}

main "$@"
