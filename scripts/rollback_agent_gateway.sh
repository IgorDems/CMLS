#!/bin/bash

set -e

kubectl -n cloudmart rollout undo deployment/agent-gateway

kubectl -n cloudmart rollout status deployment/agent-gateway
