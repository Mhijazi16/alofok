import json
import logging
import time
from abc import ABC, abstractmethod
from typing import Any

logger = logging.getLogger(__name__)

# TTL constants (seconds)
TTL_CATALOG = 60 * 10  # 10 minutes
TTL_ROUTE = 60 * 5  # 5 minutes
TTL_INSIGHTS = 60 * 2  # 2 minutes


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


class InMemoryCache(CacheBackend):
    """Simple in-memory cache with TTL expiration."""

    def __init__(self) -> None:
        self._store: dict[str, tuple[Any, float]] = {}  # key → (value, expires_at)

    def _evict_expired(self) -> None:
        now = time.monotonic()
        expired = [k for k, (_, exp) in self._store.items() if exp <= now]
        for k in expired:
            del self._store[k]

    async def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if time.monotonic() >= expires_at:
            del self._store[key]
            return None
        return value

    async def set(self, key: str, value: Any, ttl: int) -> None:
        self._store[key] = (value, time.monotonic() + ttl)
        # Lazy eviction — clean up every 100 writes
        if len(self._store) % 100 == 0:
            self._evict_expired()

    async def delete(self, key: str) -> None:
        self._store.pop(key, None)

    async def invalidate_prefix(self, prefix: str) -> None:
        keys = [k for k in self._store if k.startswith(prefix)]
        for k in keys:
            del self._store[k]


# Module-level singleton
_cache: InMemoryCache | None = None


async def init_cache() -> None:
    global _cache
    _cache = InMemoryCache()


async def close_cache() -> None:
    global _cache
    _cache = None


def get_cache() -> CacheBackend:
    if _cache is None:
        raise RuntimeError("Cache not initialised. Call init_cache() at startup.")
    return _cache
