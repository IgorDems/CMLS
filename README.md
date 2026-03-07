# CMLS / CloudMart

CloudMart LocalStack-first lab running on a single-node Kubernetes cluster.

This repository is organized around a canonical structure for a local multi-service CloudMart platform that replaces core AWS-managed services with local or self-hosted equivalents.

## Current platform direction

This project is based on the following implementation approach:

- Kubernetes: single-node cluster on `aorus`
- Ingress: `ingress-nginx`
- Load balancing: `MetalLB` in L2 mode
- Primary LAN interface: `enp7s0`
- Host IP: `192.168.1.112`
- Local AWS alternative: `LocalStack`
- Local LLM runtime: `Ollama`
- AI integration layer: `agent-gateway`
- Monitoring/observability: `Grafana`, `Prometheus`, `Loki`
- Namespace for core app: `cloudmart`

## Main domains

- `agent.cloudmart.lab`
- `grafana.cloudmart.lab`

## Main goals of this repository

- keep only active and relevant manifests
- separate current manifests from legacy/debug/AWS-original files
- provide a clean Kubernetes base/overlay structure
- standardize Docker, scripts, docs, and archive layout
- support future CI/CD and repeatable deployment flows

---

# Repository structure

```text
CMLS/
  README.md
  docs/
    architecture.md
    deployment-order.md
    localstack-mapping.md
    rollback.md
    current-status.md

  kubernetes/
    base/
      namespace/
        cloudmart-namespace.yaml

      agent-gateway/
        configmap-app.yaml
        configmap-env.yaml
        deployment.yaml
        service.yaml
        ingress.yaml
        servicemonitor.yaml
        kustomization.yaml

      ollama/
        service.yaml
        endpoints.yaml
        kustomization.yaml

      monitoring/
        grafana-ingress.yaml
        prometheus-rules.yaml
        kustomization.yaml
        dashboards/

      localstack/
        notes.md
        optional-job-init-dynamodb.yaml
        kustomization.yaml

    overlays/
      dev/
        kustomization.yaml
      lab/
        kustomization.yaml

  docker/
    agent-gateway/
      Dockerfile
      requirements.txt
    backend/
      Dockerfile
    frontend/
      Dockerfile

  scripts/
    apply.sh
    delete.sh
    smoke-tests.sh
    port-forward.sh

  archive/
    aws-original/
    debug/
    old-ingress/
