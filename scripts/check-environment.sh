#!/bin/bash

# Кольори для виводу
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== CMLS Infrastructure Diagnostic Tool ===${NC}\n"

# 1. Перевірка контексту Kubernetes
echo -e "${BLUE}[1/4] Checking Kubernetes Cluster State...${NC}"
if kubectl cluster-info > /dev/null 2>&1; then
    echo -e "${GREEN}✔ Connected to Kubernetes cluster.${NC}"
    
    # Перевірка нодів
    NODES_READY=$(kubectl get nodes | grep -c "Ready")
    echo -e "Nodes Ready: ${GREEN}$NODES_READY${NC}"
    
    # Пошук проблемних подів
    BAD_PODS=$(kubectl get pods -A --field-selector=status.phase!=Running,status.phase!=Succeeded | grep -v "No resources found")
    if [ -z "$BAD_PODS" ]; then
        echo -e "${GREEN}✔ All pods are healthy.${NC}"
    else
        echo -e "${RED}✖ Found pods with issues:${NC}"
        echo "$BAD_PODS"
    fi
else
    echo -e "${RED}✖ Cannot connect to Kubernetes cluster!${NC}"
fi

# 2. Перевірка LocalStack
echo -e "\n${BLUE}[2/4] Checking LocalStack Services...${NC}"
LOCALSTACK_POD=$(kubectl get pods -l app=localstack -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)

if [ -z "$LOCALSTACK_POD" ]; then
    echo -e "${RED}✖ LocalStack pod not found!${NC}"
else
    echo -e "Checking health via pod: $LOCALSTACK_POD"
    HEALTH_CHECK=$(kubectl exec $LOCALSTACK_POD -- curl -s http://localhost:4566/_localstack/health | grep -o '"s3": "running"' || echo "failed")
    
    if [[ "$HEALTH_CHECK" == *"running"* ]]; then
        echo -e "${GREEN}✔ LocalStack S3 is Running.${NC}"
    else
        echo -e "${RED}✖ LocalStack services are NOT healthy.${NC}"
    fi
fi

# 3. Перевірка Terraform State (якщо запущено в CI або локально)
echo -e "\n${BLUE}[3/4] Validating Terraform Files...${NC}"
if [ -d "infrastructure/terraform" ]; then
    cd infrastructure/terraform
    if terraform validate; then
        echo -e "${GREEN}✔ Terraform configuration is valid.${NC}"
    else
        echo -e "${RED}✖ Terraform validation failed!${NC}"
    fi
    cd ../..
else
    echo -e "Skipping: Terraform directory not found."
fi

# 4. Перевірка Argo CD Sync Status
echo -e "\n${BLUE}[4/4] Checking Argo CD Application Status...${NC}"
# Припустимо, додаток називається 'cmls-app'
ARGO_STATUS=$(kubectl get application -n argocd cmls-app -o jsonpath='{.status.sync.status}' 2>/dev/null)
if [ ! -z "$ARGO_STATUS" ]; then
    if [ "$ARGO_STATUS" == "Synced" ]; then
        echo -e "${GREEN}✔ Application is Synced with Git.${NC}"
    else
        echo -e "${RED}⚠ Application is $ARGO_STATUS (Out of Sync)${NC}"
    fi
else
    echo -e "Argo CD application 'cmls-app' not found or Argo CD is not installed."
fi

echo -e "\n${BLUE}=== Diagnostic Complete ===${NC}"
