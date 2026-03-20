#!/usr/bin/env bash
set -euo pipefail

ENDPOINT="${1:-http://192.168.1.242:4566}"
TABLE="cloudmart_products"

aws --endpoint-url="$ENDPOINT" dynamodb put-item \
  --table-name "$TABLE" \
  --item '{
    "pk": {"S": "PRODUCT#1"},
    "sk": {"S": "META"},
    "name": {"S": "MacBook Pro 14"},
    "price": {"N": "1999"}
  }'

aws --endpoint-url="$ENDPOINT" dynamodb put-item \
  --table-name "$TABLE" \
  --item '{
    "pk": {"S": "PRODUCT#2"},
    "sk": {"S": "META"},
    "name": {"S": "iPhone 15"},
    "price": {"N": "999"}
  }'

aws --endpoint-url="$ENDPOINT" dynamodb put-item \
  --table-name "$TABLE" \
  --item '{
    "pk": {"S": "PRODUCT#3"},
    "sk": {"S": "META"},
    "name": {"S": "AirPods Pro"},
    "price": {"N": "249"}
  }'

echo "Seeded products into $TABLE via $ENDPOINT"
