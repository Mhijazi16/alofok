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

# --workers 1: the app uses an in-process TTL cache (app/utils/cache.py) whose
# invalidations are per-process. A single worker keeps the catalog/route/insights
# cache consistent. The API is async + IO-bound, so one worker is ample at this
# scale; switch to Redis (CacheBackend already abstracts it) before scaling out.
CMD ["sh", "-c", "alembic upgrade head && python -m app.utils.seed && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1"]
