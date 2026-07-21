FROM python:3.10-slim

WORKDIR /app

# Копіюємо requirements та встановлюємо залежності
COPY services/order-processor/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копіюємо вихідний код з папки services/order-processor
COPY services/order-processor/ .

CMD ["python", "app.py"]
