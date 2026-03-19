#!/bin/bash

set -e

URL="http://agent.cloudmart.lab"

curl $URL/healthz
curl $URL/metrics
