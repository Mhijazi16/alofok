FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/static/uploads /app/static/avatars /app/static/checks

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && python -m app.utils.seed && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2"]
