FROM python:3.11-slim

WORKDIR /app

# Copy from railway-video-ingestion subdirectory
COPY railway-video-ingestion/requirements.txt .
COPY railway-video-ingestion/main.py .

RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 8000

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
