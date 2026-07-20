#!/bin/bash
set -e

echo "Deploying CloudFormation core stack..."

awslocal cloudformation deploy \
  --stack-name core-stack \
  --template-file /opt/infra/core-stack.yaml \
  --capabilities CAPABILITY_NAMED_IAM

echo "Core stack deployed"
