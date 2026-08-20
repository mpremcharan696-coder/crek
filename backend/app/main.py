"""Pilotly FastAPI application entry point.

Creates the FastAPI app with:
- Lifespan management (startup/shutdown for DB engine, ARQ Redis pool).
- CORS middleware configured from environment.
- All v1 API routers mounted under ``/api/v1``.
- Health-check and readiness endpoints at the root.

Run locally with::

    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_v1_router
from app.core.config import settings
from app.core.logging import setup_logging
from app.db.session import engine

logger = logging.getLogger(__name__)


# ======================================================================
# Lifespan — startup & shutdown
# ======================================================================

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan context manager.

    On startup:
        - Configure structured logging.
        - Create an ARQ Redis connection pool (used for enqueuing jobs from
          webhook handlers and for deduplication checks).
        - Store the pool on ``app.state`` so routers can access it.

    On shutdown:
        - Close the ARQ pool.
        - Dispose the SQLAlchemy async engine.
    """
    setup_logging()
    logger.info("Pilotly API starting up (env=%s)", settings.APP_ENV)

    # -- Database Schema Auto-Migration --------------------------------
    try:
        from sqlalchemy import text
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS biography TEXT;"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS followers_count INT;"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS follows_count INT;"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS media_count INT;"))
        logger.info("Database schema auto-migrated successfully")
    except Exception as exc:
        logger.warning("Database auto-migration warning: %s", exc)

    # -- ARQ Redis pool (optional — API works without it for testing) ----
    try:
        from app.workers.settings import parse_redis_url
        from arq import create_pool

        redis_settings = parse_redis_url(settings.REDIS_URL)
        arq_pool = await create_pool(redis_settings)
        app.state.arq_pool = arq_pool
        logger.info("ARQ Redis pool connected")
    except Exception as exc:
        app.state.arq_pool = None
        logger.warning(
            "ARQ Redis pool NOT connected (background jobs disabled): %s", exc
        )

    yield  # ← application runs here

    # -- Shutdown ------------------------------------------------------
    logger.info("Pilotly API shutting down")
    if app.state.arq_pool is not None:
        await app.state.arq_pool.close()
    await engine.dispose()
    logger.info("All connections closed")


# ======================================================================
# FastAPI app
# ======================================================================

app = FastAPI(
    title="Pilotly API",
    description=(
        "AI-powered Instagram Community Manager — intelligent comment "
        "replies, reel analysis, and real-time web search."
    ),
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# -- CORS middleware ---------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -- Mount API routers -------------------------------------------------
app.include_router(api_v1_router)


# ======================================================================
# Health checks
# ======================================================================

@app.get("/health", tags=["Health"])
async def health() -> dict[str, str]:
    """Basic liveness probe.

    Returns ``{"status": "ok"}`` if the process is alive and accepting
    requests.  Does **not** check downstream dependencies.
    """
    return {"status": "ok"}


@app.get("/ready", tags=["Health"])
async def ready() -> dict[str, str | bool]:
    """Readiness probe — verifies downstream dependencies.

    Checks:
        - Database connectivity (async ping via SQLAlchemy).
        - Redis connectivity (ping via the ARQ pool).

    Returns a JSON object with the status of each dependency.
    """
    from sqlalchemy import text
    from app.db.session import AsyncSessionLocal

    db_ok = False
    redis_ok = False

    # Check database
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        logger.exception("Readiness check: database connection failed")

    # Check Redis
    try:
        arq_pool = app.state.arq_pool
        pong = await arq_pool.ping()
        redis_ok = pong is not None
    except Exception:
        logger.exception("Readiness check: Redis connection failed")

    status = "ok" if (db_ok and redis_ok) else "degraded"

    return {
        "status": status,
        "database": db_ok,
        "redis": redis_ok,
    }
