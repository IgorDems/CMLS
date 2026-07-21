FROM python:3.11-slim

WORKDIR /app

# Копіюємо файл залежностей та встановлюємо їх
COPY services/order-processor/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копіюємо вихідний код додатка
COPY services/order-processor/ .

CMD ["python", "app.py"]
