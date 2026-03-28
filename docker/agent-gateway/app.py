igor@aorus:~/CMLS$ cat docker/agent-gateway/app.py
# 1. Правильні імпорти на початку
from boto3.dynamodb.conditions import Key, Attr
import os
import time
import json
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional
from fastapi import Query
import boto3
from botocore.config import Config
from fastapi import FastAPI, Request, Response
from pydantic import BaseModel

from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Counter,
    Histogram,
    generate_latest,
)

import uuid
from datetime import datetime
import traceback


APP_NAME = "agent-gateway"

# --- ENV CONFIG ---
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
LOCALSTACK_ENDPOINT = os.getenv("LOCALSTACK_ENDPOINT")

PRODUCTS_TABLE = os.getenv("PRODUCTS_TABLE", "cloudmart_products")
ORDERS_TABLE = os.getenv("ORDERS_TABLE", "cloudmart_orders")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma3:12b")

# --- METRICS ---
REQ_COUNT = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "path", "status"],
)

REQ_LATENCY = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "path"],
)

# --- DYNAMODB ---
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
    config=Config(retries={"max_attempts": 2, "mode": "standard"}),
)

# --- SQS ---
sqs = boto3.client(
    "sqs",
    region_name=AWS_REGION,
    endpoint_url=LOCALSTACK_ENDPOINT,
    aws_access_key_id="test",
    aws_secret_access_key="test",
)

def get_queue_url():
    """
    Динамічне отримання URL черги з обробкою помилок.
    """
    try:
        response = sqs.get_queue_url(QueueName="cloudmart-orders")
        url = response["QueueUrl"]

        if LOCALSTACK_ENDPOINT:
            from urllib.parse import urlparse

            endpoint = urlparse(LOCALSTACK_ENDPOINT)
            path = urlparse(url).path

            url = f"{endpoint.scheme}://{endpoint.hostname}:{endpoint.port}{path}"

        print(f"[SQS] Використовуємо Queue URL: {url}")
        return url
    except Exception as e:
        print(f"[SQS] Помилка отримання URL черги: {e}")
        raise

# --- FASTAPI ---
app = FastAPI(title=APP_NAME)


# --- MODELS ---
class ChatIn(BaseModel):
    message: str
    session_id: Optional[str] = None


class OAChatMessage(BaseModel):
    role: str
    content: str


class OAChatIn(BaseModel):
    model: Optional[str] = None
    messages: List[OAChatMessage]
    temperature: Optional[float] = 0.2
    stream: Optional[bool] = False


# --- MIDDLEWARE ---
@app.middleware("http")
async def prom_middleware(request: Request, call_next):
    start = time.time()
    status_code = 500
    try:
        resp: Response = await call_next(request)
        status_code = resp.status_code
        return resp
    finally:
        elapsed = time.time() - start
        path = request.url.path
        REQ_LATENCY.labels(request.method, path).observe(elapsed)
        REQ_COUNT.labels(request.method, path, str(status_code)).inc()


# --- HEALTH ---
@app.get("/healthz")
def healthz():
    try:
        ddb.list_tables(Limit=1)
        ddb_ok = True
    except Exception:
        ddb_ok = False

    ollama_ok = False
    if OLLAMA_BASE_URL:
        try:
            with urllib.request.urlopen(f"{OLLAMA_BASE_URL}/api/tags", timeout=3) as r:
                _ = r.read(200)
            ollama_ok = True
        except Exception:
            ollama_ok = False

    return {
        "service": APP_NAME,
        "dynamodb_ok": ddb_ok,
        "ollama_ok": ollama_ok,
    }

# --- PRODUCTS ---

# 2. Оновлений метод отримання продуктів через GSI Query
@app.get("/products")
def get_products():
    try:
        response = products_table.query(
            IndexName="sk-index",
            KeyConditionExpression=Key("sk").eq("META")
        )
        items = response.get("Items", [])
        return [
            {
                "id": i["pk"].replace("PRODUCT#", ""),
                "name": i["name"],
                "price": float(i["price"]),
            } for i in items
        ]
    except Exception as e:
        print(f"Error fetching products: {e}")
        return []

# 3. Оновлений метод створення замовлення через точний get_item

@app.post("/orders")
def create_order(product_id: str = Query(...)):
    try:
        # --- 1. Find product ---
        resp = products_table.get_item(
            Key={
                "pk": f"PRODUCT#{product_id}",
                "sk": "META"
            },
            ConsistentRead=True
        )

        product = resp.get("Item")

        if not product:
            return {"error": "Product not found"}

        # --- 2. Create order ---
        order_id = str(uuid.uuid4())

        item = {
            "pk": f"ORDER#{order_id}",
            "sk": "META",
            "product_id": product_id,
            "product_name": product["name"],
            "price": float(product["price"]),
            "status": "CREATED",
            "created_at": datetime.utcnow().isoformat()
        }

        orders_table.put_item(Item=item)

        # --- 3. Send event to SQS ---
        event_payload = {
            "order_id": order_id,
            "event": "ORDER_CREATED",
            "timestamp": datetime.utcnow().isoformat()
        }

        queue_url = get_queue_url()

        sqs.send_message(
            QueueUrl=queue_url,
            MessageBody=json.dumps(event_payload)
        )

        print(f"[SQS] Event sent: {event_payload}")

        return {
            "order_id": order_id,
            "status": "CREATED"
        }

    except Exception as e:
        traceback.print_exc()

        return {
            "error": str(e),
            "type": "order_creation_failed"
        }


@app.get("/orders")
def list_orders():
    response = orders_table.scan()
    return response.get("Items", [])


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


# --- METRICS ---
@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

# --- CHAT INTERNAL ---
def list_products(limit: int = 50) -> List[Dict[str, Any]]:
    # Використовуємо query через GSI (sk-index)
    resp = ddb.query(
        TableName=PRODUCTS_TABLE,
        IndexName="sk-index", # ОБОВ'ЯЗКОВО
        Limit=limit,
        KeyConditionExpression="sk = :sk_val", # Змінено з Filter на KeyCondition
        ExpressionAttributeValues={":sk_val": {"S": "META"}}
    )
    items = resp.get("Items", [])
    return [
        {
            "pk": it["pk"]["S"],
            "name": it.get("name", {}).get("S"),
            "price": float(it.get("price", {}).get("N", "0")),
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

    data = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read()

        j = json.loads(body.decode("utf-8"))
        return j.get("message", {}).get("content", "")

    except Exception as e:
        return f"Ollama error: {str(e)}"


@app.post("/chat")
def chat(payload: ChatIn):
    text = payload.message.strip()

    if is_list_products_intent(text):
        return {
            "reply": "Ось список продуктів:",
            "products": list_products()
        }

    return {"reply": ollama_chat(text, OLLAMA_MODEL)}
