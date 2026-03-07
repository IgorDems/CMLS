#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "${1:-.}" && pwd)"
TARGET="$ROOT"
DRY_RUN="${DRY_RUN:-1}"

log() {
  echo "[INFO] $*"
}

run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[DRY-RUN] $*"
  else
    bash -lc "$*"
  fi
}

ensure_dir() {
  run "mkdir -p \"$1\""
}

find_first_file() {
  local pattern="$1"
  find "$ROOT" -type f -name "$pattern" \
    ! -path "$TARGET/archive/*" \
    ! -path "*/.git/*" \
    | head -n 1
}

move_found_file() {
  local pattern="$1"
  local dst="$2"
  local found

  found="$(find_first_file "$pattern" || true)"
  if [[ -n "${found:-}" && -f "$found" ]]; then
    ensure_dir "$(dirname "$dst")"
    run "mv \"$found\" \"$dst\""
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
  run "touch \"$TARGET/docs/current-status.md\""

  run "touch \"$TARGET/kubernetes/base/namespace/cloudmart-namespace.yaml\""
  run "touch \"$TARGET/kubernetes/base/agent-gateway/configmap-app.yaml\""
  run "touch \"$TARGET/kubernetes/base/agent-gateway/configmap-env.yaml\""
  run "touch \"$TARGET/kubernetes/base/agent-gateway/deployment.yaml\""
  run "touch \"$TARGET/kubernetes/base/agent-gateway/service.yaml\""
  run "touch \"$TARGET/kubernetes/base/agent-gateway/ingress.yaml\""
  run "touch \"$TARGET/kubernetes/base/agent-gateway/servicemonitor.yaml\""
  run "touch \"$TARGET/kubernetes/base/agent-gateway/kustomization.yaml\""

  run "touch \"$TARGET/kubernetes/base/ollama/service.yaml\""
  run "touch \"$TARGET/kubernetes/base/ollama/endpoints.yaml\""
  run "touch \"$TARGET/kubernetes/base/ollama/kustomization.yaml\""

  run "touch \"$TARGET/kubernetes/base/monitoring/grafana-ingress.yaml\""
  run "touch \"$TARGET/kubernetes/base/monitoring/prometheus-rules.yaml\""
  run "touch \"$TARGET/kubernetes/base/monitoring/kustomization.yaml\""

  run "touch \"$TARGET/kubernetes/base/localstack/notes.md\""
  run "touch \"$TARGET/kubernetes/base/localstack/optional-job-init-dynamodb.yaml\""
  run "touch \"$TARGET/kubernetes/base/localstack/kustomization.yaml\""

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

  move_found_file "agent-gateway-env-configmap.yaml" \
    "$TARGET/kubernetes/base/agent-gateway/configmap-env.yaml"

  move_found_file "agent-gateway-configmap.yaml" \
    "$TARGET/kubernetes/base/agent-gateway/configmap-app.yaml"

  move_found_file "agent-gateway.yaml" \
    "$TARGET/kubernetes/base/agent-gateway/deployment.yaml"

  move_found_file "agent-gateway-service.yaml" \
    "$TARGET/kubernetes/base/agent-gateway/service.yaml"

  move_found_file "agent-gateway-ingress.yaml" \
    "$TARGET/kubernetes/base/agent-gateway/ingress.yaml"

  move_found_file "agent-gateway-servicemonitor.yaml" \
    "$TARGET/kubernetes/base/agent-gateway/servicemonitor.yaml"

  move_found_file "ollama-service.yaml" \
    "$TARGET/kubernetes/base/ollama/service.yaml"

  move_found_file "ollama-endpoints.yaml" \
    "$TARGET/kubernetes/base/ollama/endpoints.yaml"

  move_found_file "grafana-ingress.yaml" \
    "$TARGET/kubernetes/base/monitoring/grafana-ingress.yaml"

  move_found_file "prometheus-rules.yaml" \
    "$TARGET/kubernetes/base/monitoring/prometheus-rules.yaml"

  move_found_file "cloudmart-namespace.yaml" \
    "$TARGET/kubernetes/base/namespace/cloudmart-namespace.yaml"

  move_found_file "Dockerfile" \
    "$TARGET/docker/agent-gateway/Dockerfile"

  move_found_file "requirements.txt" \
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
    [[ -f "$f" ]] && archive_if_exists "$f" "debug/$(basename "$f")"
  done

  for f in \
    "$ROOT"/*aws*.yaml \
    "$ROOT"/*eks*.yaml \
    "$ROOT"/*alb*.yaml \
    "$ROOT"/*bedrock*.yaml \
    "$ROOT"/*lambda*.yaml \
    "$ROOT"/*irsa*.yaml
  do
    [[ -f "$f" ]] && archive_if_exists "$f" "aws-original/$(basename "$f")"
  done

  for f in \
    "$ROOT"/*ingress-old*.yaml \
    "$ROOT"/*old-ingress*.yaml \
    "$ROOT"/*legacy-ingress*.yaml
  do
    [[ -f "$f" ]] && archive_if_exists "$f" "old-ingress/$(basename "$f")"
  done

  shopt -u nullglob
}

write_kustomizations() {
  log "Writing baseline kustomization files"

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[DRY-RUN] Would write kustomization files"
    return
  fi

  cat > "$TARGET/kubernetes/base/agent-gateway/kustomization.yaml" <<'EOF2'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - configmap-app.yaml
  - configmap-env.yaml
  - deployment.yaml
  - service.yaml
  - ingress.yaml
  - servicemonitor.yaml
EOF2

  cat > "$TARGET/kubernetes/base/ollama/kustomization.yaml" <<'EOF2'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - service.yaml
  - endpoints.yaml
EOF2

  cat > "$TARGET/kubernetes/base/monitoring/kustomization.yaml" <<'EOF2'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - grafana-ingress.yaml
  - prometheus-rules.yaml
EOF2

  cat > "$TARGET/kubernetes/base/localstack/kustomization.yaml" <<'EOF2'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - optional-job-init-dynamodb.yaml
EOF2

  cat > "$TARGET/kubernetes/overlays/dev/kustomization.yaml" <<'EOF2'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../base/namespace
  - ../../base/ollama
  - ../../base/agent-gateway
  - ../../base/monitoring
  - ../../base/localstack
EOF2

  cat > "$TARGET/kubernetes/overlays/lab/kustomization.yaml" <<'EOF2'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../base/namespace
  - ../../base/ollama
  - ../../base/agent-gateway
  - ../../base/monitoring
  - ../../base/localstack
EOF2
}

write_helper_scripts() {
  log "Writing helper scripts"

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[DRY-RUN] Would write helper scripts"
    return
  fi

  cat > "$TARGET/scripts/apply.sh" <<'EOF2'
#!/usr/bin/env bash
set -euo pipefail

kubectl apply -k ../kubernetes/overlays/lab
EOF2

  cat > "$TARGET/scripts/delete.sh" <<'EOF2'
#!/usr/bin/env bash
set -euo pipefail

kubectl delete -k ../kubernetes/overlays/lab --ignore-not-found
EOF2

  cat > "$TARGET/scripts/smoke-tests.sh" <<'EOF2'
#!/usr/bin/env bash
set -euo pipefail

echo "== agent health =="
curl -fsS http://agent.cloudmart.lab/healthz && echo

echo "== agent metrics =="
curl -fsS http://agent.cloudmart.lab/metrics | head -n 20 || true

echo "== grafana =="
curl -I http://grafana.cloudmart.lab/ || true
EOF2

  cat > "$TARGET/scripts/port-forward.sh" <<'EOF2'
#!/usr/bin/env bash
set -euo pipefail

kubectl -n cloudmart port-forward svc/agent-gateway 8080:80
EOF2

  chmod +x \
    "$TARGET/scripts/apply.sh" \
    "$TARGET/scripts/delete.sh" \
    "$TARGET/scripts/smoke-tests.sh" \
    "$TARGET/scripts/port-forward.sh"
}

write_docs() {
  log "Writing baseline docs"

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[DRY-RUN] Would write baseline docs"
    return
  fi

  cat > "$TARGET/docs/current-status.md" <<'EOF2'
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
EOF2

  cat > "$TARGET/docs/localstack-mapping.md" <<'EOF2'
# LocalStack service mapping

- AWS DynamoDB -> LocalStack DynamoDB
- AWS Bedrock -> Ollama + agent-gateway
- AWS Load Balancer / ALB -> ingress-nginx + MetalLB
- AWS CloudWatch -> Prometheus + Grafana + Loki
- AWS EKS -> local single-node Kubernetes
EOF2
}

main() {
  log "ROOT=$ROOT"
  log "TARGET=$TARGET"
  log "DRY_RUN=$DRY_RUN"

  create_structure
  migrate_known_files
  archive_patterns
  write_kustomizations
  write_helper_scripts
  write_docs

  log "Done"
  if [[ "$DRY_RUN" == "1" ]]; then
    log "This was a dry run only. Re-run with: DRY_RUN=0 ./migrate-cloudmart-layout.sh"
  fi
}

main "$@"
