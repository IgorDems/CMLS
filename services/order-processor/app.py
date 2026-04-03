import json
import time
import logging

import boto3
from botocore.exceptions import ClientError

from config import (
    AWS_REGION,
    LOCALSTACK_ENDPOINT,
    SQS_QUEUE_URL,
    DYNAMODB_TABLE,
    POLL_WAIT_TIME,
    VISIBILITY_TIMEOUT
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("order-processor")

# --- AWS clients ---
sqs = boto3.client(
    "sqs",
    region_name=AWS_REGION,
    endpoint_url=LOCALSTACK_ENDPOINT
)

dynamodb = boto3.resource(
    "dynamodb",
    region_name=AWS_REGION,
    endpoint_url=LOCALSTACK_ENDPOINT
)

table = dynamodb.Table(DYNAMODB_TABLE)


# --- business logic ---
def process_order(order_id: str):
    logger.info(f"Processing order: {order_id}")

    # 1. update status → PROCESSING
    table.update_item(
        Key={"pk": f"ORDER#{order_id}", "sk": "META"},
        UpdateExpression="SET #s = :s",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":s": "PROCESSING"}
    )

    # simulate work
    time.sleep(2)

    # 2. update status → COMPLETED
    table.update_item(
        Key={"pk": f"ORDER#{order_id}", "sk": "META"},
        UpdateExpression="SET #s = :s",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":s": "COMPLETED"}
    )

    logger.info(f"Order completed: {order_id}")


# --- message handler ---
def handle_message(msg):
    try:
        body = json.loads(msg["Body"])
        order_id = body.get("order_id")

        if not order_id:
            raise ValueError("order_id missing")

        process_order(order_id)

        # delete message після успіху
        sqs.delete_message(
            QueueUrl=SQS_QUEUE_URL,
            ReceiptHandle=msg["ReceiptHandle"]
        )

        logger.info(f"Message deleted: {order_id}")

    except Exception as e:
        logger.error(f"Error processing message: {e}", exc_info=True)
        # message НЕ видаляємо → піде на retry


# --- polling loop ---
def poll():
    logger.info("Starting SQS polling...")

    while True:
        try:
            response = sqs.receive_message(
                QueueUrl=SQS_QUEUE_URL,
                MaxNumberOfMessages=1,
                WaitTimeSeconds=POLL_WAIT_TIME,
                VisibilityTimeout=VISIBILITY_TIMEOUT
            )

            messages = response.get("Messages", [])

            if not messages:
                continue

            for msg in messages:
                handle_message(msg)

        except ClientError as e:
            logger.error(f"AWS error: {e}", exc_info=True)
            time.sleep(5)

        except Exception as e:
            logger.error(f"Unexpected error: {e}", exc_info=True)
            time.sleep(5)


if __name__ == "__main__":
    if not SQS_QUEUE_URL:
        raise ValueError("SQS_QUEUE_URL is required")

    poll()
