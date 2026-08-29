"""Redis caching layer for hot read paths in Pilotly.

Provides high-throughput caching for:
1. User settings and creator voice profile (10 min TTL with write-through invalidation).
2. Reel AI summary and analysis results (24 hr TTL).
3. Graceful fallback if Redis is unavailable or unconfigured.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger(__name__)

_redis_client: aioredis.Redis | None = None


def get_redis_client() -> aioredis.Redis | None:
    """Get or initialize singleton async Redis client."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client

    redis_url = getattr(settings, "REDIS_URL", "")
    if not redis_url or "placeholder" in redis_url:
        return None

    try:
        _redis_client = aioredis.from_url(
            redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_timeout=2.0,
            socket_connect_timeout=2.0,
        )
        return _redis_client
    except Exception as exc:
        logger.warning("Could not initialize Redis client: %s", exc)
        return None


async def get_cached_json(key: str) -> dict[str, Any] | None:
    """Retrieve JSON deserialized cached value by key."""
    try:
        client = get_redis_client()
        if client is None:
            return None
        val = await client.get(key)
        if val:
            return json.loads(val)
    except Exception as exc:
        logger.debug("Redis cache get error for '%s': %s", key, exc)
    return None


async def set_cached_json(key: str, data: Any, ttl_seconds: int = 600) -> bool:
    """Store JSON serializable value in Redis with TTL (default 10 minutes)."""
    try:
        client = get_redis_client()
        if client is None:
            return False
        serialized = json.dumps(data)
        await client.set(key, serialized, ex=ttl_seconds)
        return True
    except Exception as exc:
        logger.debug("Redis cache set error for '%s': %s", key, exc)
        return False


async def delete_cached(key: str) -> bool:
    """Invalidate cached key."""
    try:
        client = get_redis_client()
        if client is None:
            return False
        await client.delete(key)
        return True
    except Exception as exc:
        logger.debug("Redis cache delete error for '%s': %s", key, exc)
        return False
