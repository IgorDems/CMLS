import os

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

LOCALSTACK_ENDPOINT = os.getenv(
    "LOCALSTACK_ENDPOINT",
    "http://localstack.default.svc.cluster.local:4566"
)

SQS_QUEUE_URL = os.getenv("SQS_QUEUE_URL")

DYNAMODB_TABLE = os.getenv("DYNAMODB_TABLE", "cloudmart_orders")

POLL_WAIT_TIME = int(os.getenv("POLL_WAIT_TIME", "10"))  # long polling
VISIBILITY_TIMEOUT = int(os.getenv("VISIBILITY_TIMEOUT", "30"))
