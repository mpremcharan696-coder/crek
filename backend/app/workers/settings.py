"""ARQ worker settings for Pilotly background task processing.

Defines all background functions, cron schedules, and Redis connection
configuration.  Run the worker with:

    arq app.workers.settings.WorkerSettings
"""

from __future__ import annotations

import logging
import ssl
from urllib.parse import urlparse

from arq import cron
from arq.connections import RedisSettings

from app.core.config import settings

logger = logging.getLogger(__name__)


def parse_redis_url(url: str) -> RedisSettings:
    """Parse a Redis URL into ARQ ``RedisSettings``.

    Handles both ``redis://`` and ``rediss://`` (TLS, required by Upstash).

    Args:
        url: Full Redis connection URL.

    Returns:
        ``RedisSettings`` instance configured for the target Redis.
    """
    parsed = urlparse(url)

    # Upstash requires TLS (rediss:// scheme)
    ssl_context: ssl.SSLContext | bool | None = None
    return RedisSettings(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
        password=parsed.password,
        database=int(parsed.path.lstrip("/") or "0"),
        ssl=parsed.scheme == "rediss",
    )


async def startup(ctx: dict) -> None:
    """Worker startup hook — initialise shared resources.

    This runs once when the worker process starts.  It sets up the async DB
    session factory and any other shared state that tasks need.
    """
    from app.db.session import AsyncSessionLocal

    ctx["db_session_factory"] = AsyncSessionLocal
    logger.info("ARQ worker started — database session factory initialised")


async def shutdown(ctx: dict) -> None:
    """Worker shutdown hook — clean up resources."""
    logger.info("ARQ worker shutting down")


class WorkerSettings:
    """ARQ worker configuration.

    Attributes:
        functions: List of task functions the worker can execute.
        cron_jobs: Scheduled recurring jobs.
        redis_settings: Connection details for the task broker.
        on_startup: Called once on worker start.
        on_shutdown: Called once on worker stop.
        max_jobs: Maximum number of concurrent jobs.
        job_timeout: Maximum seconds a single job may run.
        retry_jobs: Whether to honour ``Retry`` exceptions.
    """

    # Import lazily inside the class body so the module can be imported
    # without triggering heavy imports at collect-time.
    from app.workers.reel_tasks import analyze_reel_task, sync_all_reels_task, sync_user_reels_task
    from app.workers.comment_tasks import process_comment_task, sync_reel_comments_task, sync_all_comments_task
    from app.workers.token_tasks import refresh_expiring_tokens_task

    functions = [
        sync_all_reels_task,
        sync_user_reels_task,
        analyze_reel_task,
        process_comment_task,
        sync_reel_comments_task,
        sync_all_comments_task,
        refresh_expiring_tokens_task,
    ]

    cron_jobs = [
        # Sync reels for all users every 5 minutes (saves API quota)
        cron(sync_all_reels_task, minute=set(range(0, 60, 5))),
        # Sync comments for the newest 2 reels every 2 minutes (saves API quota)
        cron(sync_all_comments_task, minute=set(range(0, 60, 2))),
        # Refresh expiring tokens daily at 03:00 UTC
        cron(refresh_expiring_tokens_task, hour={3}, minute={0}),
    ]

    redis_settings = parse_redis_url(settings.REDIS_URL)

    on_startup = startup
    on_shutdown = shutdown

    # Concurrency & timeouts
    max_jobs = 500
    job_timeout = 600  # 10 minutes — reel analysis can be slow
    retry_jobs = True
