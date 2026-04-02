#!/bin/bash

set +e

echo "🚀 LocalStack bootstrap started..."

ENDPOINT=http://localhost:4566

# --------------------------------------------------
# DynamoDB - PRODUCTS
# --------------------------------------------------
aws --endpoint-url=$ENDPOINT dynamodb describe-table \
  --table-name cloudmart_products >/dev/null 2>&1

if [ $? -ne 0 ]; then
  echo "Creating table: cloudmart_products"

  aws --endpoint-url=$ENDPOINT dynamodb create-table \
    --table-name cloudmart_products \
    --attribute-definitions \
      AttributeName=pk,AttributeType=S \
      AttributeName=sk,AttributeType=S \
    --key-schema \
      AttributeName=pk,KeyType=HASH \
      AttributeName=sk,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST
fi


# --------------------------------------------------
# DynamoDB - ORDERS
# --------------------------------------------------
aws --endpoint-url=$ENDPOINT dynamodb describe-table \
  --table-name cloudmart_orders >/dev/null 2>&1

if [ $? -ne 0 ]; then
  echo "Creating table: cloudmart_orders"

  aws --endpoint-url=$ENDPOINT dynamodb create-table \
    --table-name cloudmart_orders \
    --attribute-definitions \
      AttributeName=pk,AttributeType=S \
      AttributeName=sk,AttributeType=S \
    --key-schema \
      AttributeName=pk,KeyType=HASH \
      AttributeName=sk,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST
fi


# --------------------------------------------------
# SQS QUEUE
# --------------------------------------------------
aws --endpoint-url=$ENDPOINT sqs get-queue-url \
  --queue-name cloudmart-orders >/dev/null 2>&1

if [ $? -ne 0 ]; then
  echo "Creating SQS queue: cloudmart-orders"

  aws --endpoint-url=$ENDPOINT sqs create-queue \
    --queue-name cloudmart-orders
fi


# --------------------------------------------------
# SEED DATA (products)
# --------------------------------------------------
aws --endpoint-url=$ENDPOINT dynamodb put-item \
  --table-name cloudmart_products \
  --item '{
    "pk": {"S": "PRODUCT#1"},
    "sk": {"S": "META"},
    "name": {"S": "CloudMart T-Shirt"},
    "price": {"N": "25"}
  }' >/dev/null 2>&1


echo "✅ LocalStack bootstrap completed"
