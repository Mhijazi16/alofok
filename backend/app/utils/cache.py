import json
import logging
from abc import ABC, abstractmethod
from typing import Any

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)

# TTL constants (seconds)
TTL_CATALOG = 60 * 10   # 10 minutes
TTL_ROUTE = 60 * 5      # 5 minutes
TTL_INSIGHTS = 60 * 2   # 2 minutes


class CacheBackend(ABC):
    @abstractmethod
    async def get(self, key: str) -> Any | None:
        """Return the cached value or None if missing/expired."""

    @abstractmethod
    async def set(self, key: str, value: Any, ttl: int) -> None:
        """Store value with a TTL in seconds."""

    @abstractmethod
    async def delete(self, key: str) -> None:
        """Remove a single key."""

    @abstractmethod
    async def invalidate_prefix(self, prefix: str) -> None:
        """Remove all keys that start with the given prefix."""


class RedisCache(CacheBackend):
    def __init__(self, client: aioredis.Redis):
        self._client = client

    async def get(self, key: str) -> Any | None:
        try:
            raw = await self._client.get(key)
            return json.loads(raw) if raw is not None else None
        except Exception:
            logger.warning("Redis GET failed for key=%s", key, exc_info=True)
            return None

    async def set(self, key: str, value: Any, ttl: int) -> None:
        try:
            await self._client.set(key, json.dumps(value), ex=ttl)
        except Exception:
            logger.warning("Redis SET failed for key=%s", key, exc_info=True)

    async def delete(self, key: str) -> None:
        try:
            await self._client.delete(key)
        except Exception:
            logger.warning("Redis DELETE failed for key=%s", key, exc_info=True)

    async def invalidate_prefix(self, prefix: str) -> None:
        try:
            keys = await self._client.keys(f"{prefix}*")
            if keys:
                await self._client.delete(*keys)
        except Exception:
            logger.warning(
                "Redis invalidate_prefix failed for prefix=%s", prefix, exc_info=True
            )


# Module-level singleton — initialised in app lifespan
_redis_client: aioredis.Redis | None = None
_cache: RedisCache | None = None


async def init_cache() -> None:
    global _redis_client, _cache
    _redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    _cache = RedisCache(_redis_client)


async def close_cache() -> None:
    if _redis_client:
        await _redis_client.aclose()


def get_cache() -> CacheBackend:
    if _cache is None:
        raise RuntimeError("Cache not initialised. Call init_cache() at startup.")
    return _cache
