import os
import time
import json
import uuid
import logging
import urllib.request
from datetime import datetime
from typing import Any, Dict, List, Optional
from decimal import Decimal

import boto3
from botocore.config import Config
from fastapi import FastAPI, Request, Response, HTTPException, Query
from pydantic import BaseModel

from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Counter,
    Histogram,
    generate_latest,
)

from boto3.dynamodb.conditions import Key


# -------------------- LOGGING --------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# -------------------- CONFIG --------------------
APP_NAME = "agent-gateway"

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
LOCALSTACK_ENDPOINT = os.getenv("LOCALSTACK_ENDPOINT")

if not LOCALSTACK_ENDPOINT:
    raise Exception("LOCALSTACK_ENDPOINT is not set")

PRODUCTS_TABLE = os.getenv("PRODUCTS_TABLE", "cloudmart_products")
ORDERS_TABLE = os.getenv("ORDERS_TABLE", "cloudmart_orders")

SQS_QUEUE_URL = os.getenv("SQS_QUEUE_URL")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma3:12b")

# -------------------- METRICS --------------------
REQ_COUNT = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "path", "status"],
)

REQ_LATENCY = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency",
    ["method", "path"],
)

# -------------------- AWS CLIENTS --------------------
dynamodb = boto3.resource(
    "dynamodb",
    region_name=AWS_REGION,
    endpoint_url=LOCALSTACK_ENDPOINT,
    aws_access_key_id="test",
    aws_secret_access_key="test",
)

products_table = dynamodb.Table(PRODUCTS_TABLE)
orders_table = dynamodb.Table(ORDERS_TABLE)

ddb = boto3.client(
    "dynamodb",
    region_name=AWS_REGION,
    endpoint_url=LOCALSTACK_ENDPOINT,
    aws_access_key_id="test",
    aws_secret_access_key="test",
    config=Config(retries={"max_attempts": 3, "mode": "standard"}),
)

sqs = boto3.client(
    "sqs",
    region_name=AWS_REGION,
    endpoint_url=LOCALSTACK_ENDPOINT,
    aws_access_key_id="test",
    aws_secret_access_key="test",
)

# -------------------- HELPERS --------------------
def to_decimal(value):
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def to_float(value):
    if isinstance(value, Decimal):
        return float(value)
    return float(value) if value is not None else 0.0


# -------------------- SQS --------------------
def send_sqs_message(payload: dict):
    if not SQS_QUEUE_URL:
        raise Exception("SQS_QUEUE_URL not set")

    for attempt in range(3):
        try:
            sqs.send_message(
                QueueUrl=SQS_QUEUE_URL,
                MessageBody=json.dumps(payload),
            )
            logger.info("SQS message sent")
            return
        except Exception as e:
            logger.warning(f"SQS retry {attempt}: {e}")
            time.sleep(2 ** attempt)

    raise Exception("Failed to send SQS message after retries")


# -------------------- FASTAPI --------------------
app = FastAPI(title=APP_NAME)


# -------------------- MODELS --------------------
class ChatIn(BaseModel):
    message: str
    session_id: Optional[str] = None


# -------------------- MIDDLEWARE --------------------
@app.middleware("http")
async def prom_middleware(request: Request, call_next):
    start = time.time()
    status_code = 500

    try:
        response: Response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        elapsed = time.time() - start
        path = request.url.path
        REQ_LATENCY.labels(request.method, path).observe(elapsed)
        REQ_COUNT.labels(request.method, path, str(status_code)).inc()


# -------------------- HEALTH --------------------
@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": APP_NAME}


@app.get("/readyz")
def readyz():
    try:
        ddb.list_tables(Limit=1)
        ddb_ok = True
    except Exception:
        ddb_ok = False

    sqs_ok = True
    try:
        if SQS_QUEUE_URL:
            sqs.get_queue_attributes(
                QueueUrl=SQS_QUEUE_URL,
                AttributeNames=["QueueArn"],
            )
        else:
            sqs_ok = False
    except Exception:
        sqs_ok = False

    return {
        "dynamodb": ddb_ok,
        "sqs": sqs_ok,
    }


# -------------------- PRODUCTS --------------------
@app.get("/products")
def get_products():
    try:
        response = products_table.query(
            IndexName="sk-index",
            KeyConditionExpression=Key("sk").eq("META"),
        )
        items = response.get("Items", [])

        return [
            {
                "id": i["pk"].replace("PRODUCT#", ""),
                "name": i.get("name"),
                "price": to_float(i.get("price", 0)),
            }
            for i in items
        ]

    except Exception as e:
        logger.error(f"Error fetching products: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch products")


# -------------------- ORDERS --------------------
@app.post("/orders")
def create_order(product_id: str = Query(...)):
    try:
        resp = products_table.get_item(
            Key={"pk": f"PRODUCT#{product_id}", "sk": "META"}
        )

        product = resp.get("Item")

        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        order_id = str(uuid.uuid4())

        item = {
            "pk": f"ORDER#{order_id}",
            "sk": "META",
            "product_id": product_id,
            "product_name": product.get("name"),
            "price": to_decimal(product.get("price", 0)),
            "status": "CREATED",
            "created_at": datetime.utcnow().isoformat(),
        }

        orders_table.put_item(Item=item)

        # 🔥 SQS не валить бізнес-логіку
        try:
            send_sqs_message({"order_id": order_id})
        except Exception as e:
            logger.error(f"SQS failed but order created: {e}")

        return {
            "order_id": order_id,
            "status": "CREATED",
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Order creation failed: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": str(e),
                "type": "order_creation_failed",
            },
        )


@app.get("/orders")
def list_orders(limit: int = 50):
    try:
        response = orders_table.scan(Limit=limit)
        items = response.get("Items", [])

        return [
            {
                **i,
                "price": to_float(i.get("price", 0)),
            }
            for i in items
        ]

    except Exception as e:
        logger.error(f"Error listing orders: {e}")
        raise HTTPException(status_code=500, detail="Failed to list orders")


@app.post("/orders/{order_id}/pay")
def pay_order(order_id: str):
    orders_table.update_item(
        Key={"pk": f"ORDER#{order_id}", "sk": "META"},
        UpdateExpression="SET #s = :s",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":s": "PAID"},
    )
    return {"order_id": order_id, "status": "PAID"}


@app.post("/orders/{order_id}/ship")
def ship_order(order_id: str):
    orders_table.update_item(
        Key={"pk": f"ORDER#{order_id}", "sk": "META"},
        UpdateExpression="SET #s = :s",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":s": "SHIPPED"},
    )
    return {"order_id": order_id, "status": "SHIPPED"}


# -------------------- METRICS --------------------
@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


# -------------------- CHAT --------------------
def list_products(limit: int = 50) -> List[Dict[str, Any]]:
    resp = ddb.query(
        TableName=PRODUCTS_TABLE,
        IndexName="sk-index",
        Limit=limit,
        KeyConditionExpression="sk = :sk_val",
        ExpressionAttributeValues={":sk_val": {"S": "META"}},
    )

    items = resp.get("Items", [])

    return [
        {
            "pk": it["pk"]["S"],
            "name": it.get("name", {}).get("S"),
            "price": float(it.get("price", {}).get("N", 0)),
        }
        for it in items
    ]


def is_list_products_intent(text: str) -> bool:
    t = text.lower()
    return "products" in t or "товар" in t


def ollama_chat(user_text: str, model: str) -> str:
    url = f"{OLLAMA_BASE_URL}/api/chat"

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": user_text}],
        "stream": False,
    }

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read()

        j = json.loads(body.decode("utf-8"))
        return j.get("message", {}).get("content", "")

    except Exception as e:
        logger.error(f"Ollama error: {e}")
        return "AI service unavailable"


@app.post("/chat")
def chat(payload: ChatIn):
    text = payload.message.strip()

    if is_list_products_intent(text):
        return {
            "reply": "Ось список продуктів:",
            "products": list_products(),
        }

    return {"reply": ollama_chat(text, OLLAMA_MODEL)}
