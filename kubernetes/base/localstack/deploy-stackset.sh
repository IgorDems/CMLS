#!/bin/bash
set -euo pipefail

echo "Creating StackSet..."

awslocal cloudformation create-stack-set \
  --stack-set-name org-baseline \
  --template-body file:///opt/infra/baseline-stackset.yaml \
  --capabilities CAPABILITY_NAMED_IAM

echo "Creating StackSet instances..."

awslocal cloudformation create-stack-instances \
  --stack-set-name org-baseline \
  --accounts 222222222222 333333333333 \
  --regions us-east-1

echo "StackSet deployed"
