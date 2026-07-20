#!/bin/bash
set -euo pipefail

echo "Deploying IAM stack..."

awslocal cloudformation deploy \
  --stack-name iam-stack \
  --template-file /opt/infra/iam-stack.yaml

echo "IAM stack deployed"

