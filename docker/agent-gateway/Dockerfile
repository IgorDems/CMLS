FROM python:3.11-slim

LABEL org.opencontainers.image.source="https://github.com/IgorDems/CMLS"

WORKDIR /app

COPY docker/agent-gateway/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY docker/agent-gateway/app.py .

EXPOSE 8080

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
