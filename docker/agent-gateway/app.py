import os
import time
import json
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional

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




APP_NAME = "agent-gateway"

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
LOCALSTACK_ENDPOINT = os.getenv("LOCALSTACK_ENDPOINT")
PRODUCTS_TABLE = os.getenv("PRODUCTS_TABLE", "cloudmart_products")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma3:12b")

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

dynamodb = boto3.resource(
    "dynamodb",
    region_name=os.getenv("AWS_REGION", "us-east-1"),
    endpoint_url=os.getenv("LOCALSTACK_ENDPOINT"),
    aws_access_key_id="test",
    aws_secret_access_key="test",
)

table = dynamodb.Table(os.getenv("PRODUCTS_TABLE", "cloudmart_products"))
# Orders table (DynamoDB)
ORDERS_TABLE = os.getenv("ORDERS_TABLE", "cloudmart_orders")
orders_table = dynamodb.Table(ORDERS_TABLE)

ddb = boto3.client(
    "dynamodb",
    region_name=AWS_REGION,
    endpoint_url=LOCALSTACK_ENDPOINT,
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID", "test"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", "test"),
    config=Config(retries={"max_attempts": 2, "mode": "standard"}),
)

# --- SQS (event bus for async processing) ---
sqs = boto3.client(
    "sqs",
    region_name=AWS_REGION,
    endpoint_url=LOCALSTACK_ENDPOINT,
    aws_access_key_id="test",
    aws_secret_access_key="test",
)

# Queue URL for order events
ORDERS_QUEUE_URL = os.getenv(
    "ORDERS_QUEUE_URL",
    "http://localstack:4566/000000000000/cloudmart-orders"
)

app = FastAPI(title=APP_NAME)

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


@app.get("/products")
def get_products():
    response = table.scan()

    items = response.get("Items", [])

    return [
        {
            "id": i["pk"].replace("PRODUCT#", ""),
            "name": i["name"],
            "price": float(i["price"]),
        }
        for i in items
    ]



@app.post("/orders")
def create_order(product_id: str):
    """
    Create new order:

    FLOW:
    1. Read product from DynamoDB
    2. Persist order in orders table
    3. Publish ORDER_CREATED event to SQS

    WHY:
    - decouples API from processing
    - enables async workflows (payments, shipping)
    """

    # --- 1. Find product ---
    products = table.scan().get("Items", [])

    product = next(
        (p for p in products if p["pk"] == f"PRODUCT#{product_id}"),
        None
    )

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

    # --- 3. Publish event to SQS (CRITICAL PART) ---
    event_payload = {
        "order_id": order_id,
        "event": "ORDER_CREATED",
        "timestamp": datetime.utcnow().isoformat()
    }

    try:
        sqs.send_message(
            QueueUrl=ORDERS_QUEUE_URL,
            MessageBody=json.dumps(event_payload)
        )
        print(f"[SQS] Event sent: {event_payload}")

    except Exception as e:
        # DO NOT fail order creation if SQS fails
        print("[SQS ERROR]", str(e))

    return {
        "order_id": order_id,
        "status": "CREATED"
    }



@app.get("/orders")
def list_orders():
    response = orders_table.scan()
    return response.get("Items", [])

@app.post("/orders/{order_id}/pay")
def pay_order(order_id: str):

    pk = f"ORDER#{order_id}"

    orders_table.update_item(
        Key={"pk": pk, "sk": "META"},
        UpdateExpression="SET #s = :s",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":s": "PAID"},
    )

    return {"order_id": order_id, "status": "PAID"}

@app.post("/orders/{order_id}/ship")
def ship_order(order_id: str):

    pk = f"ORDER#{order_id}"

    orders_table.update_item(
        Key={"pk": pk, "sk": "META"},
        UpdateExpression="SET #s = :s",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":s": "SHIPPED"},
    )

    return {"order_id": order_id, "status": "SHIPPED"}






@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

def list_products(limit: int = 50) -> List[Dict[str, Any]]:
    resp = ddb.scan(TableName=PRODUCTS_TABLE, Limit=limit)
    items = resp.get("Items", [])
    out: List[Dict[str, Any]] = []
    for it in items:
        out.append({
            "pk": it["pk"]["S"],
            "sk": it["sk"]["S"],
            "name": it.get("name", {}).get("S"),
            "price": float(it.get("price", {}).get("N", "0")),
        })
    return out

def is_list_products_intent(text: str) -> bool:
    t = text.lower()
    return (
        "list products" in t
        or "products" in t
        or "товар" in t
        or "каталог" in t
    )

def ollama_chat(user_text: str, model: str, temperature: float = 0.2) -> str:
    url = f"{OLLAMA_BASE_URL}/api/chat"

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": user_text}],
        "stream": False,
        "options": {"temperature": temperature},
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

        products = list_products()

        return {
            "reply": "Ось список продуктів:",
            "products": products
        }

    reply = ollama_chat(text, model=OLLAMA_MODEL)

    return {"reply": reply}

@app.post("/v1/chat/completions")
def v1_chat_completions(payload: OAChatIn):

    model = payload.model or OLLAMA_MODEL

    user_text = ""

    for m in reversed(payload.messages):
        if m.role == "user":
            user_text = m.content
            break

    if is_list_products_intent(user_text):

        products = list_products()

        content = "Ось список продуктів:\n"

        for p in products:
            content += f"- {p.get('name')} (${p.get('price')})\n"

    else:

        content = ollama_chat(user_text, model)

    now = int(time.time())

    return {
        "id": f"chatcmpl-{now}",
        "object": "chat.completion",
        "created": now,
        "model": model,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop",
            }
        ],
        "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
    }
