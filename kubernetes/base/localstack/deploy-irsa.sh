#!/bin/bash
set -euo pipefail

echo "Deploying IRSA stack..."

awslocal cloudformation deploy \
  --stack-name irsa-stack \
  --template-file /opt/infra/irsa-stack.yaml \
  --capabilities CAPABILITY_NAMED_IAM

echo "IRSA deployed"
