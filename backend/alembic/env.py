"""Alembic environment configuration for async migrations.

This module wires Alembic to:
1. Read the database URL from ``app.core.config.settings`` (not alembic.ini).
2. Import all model metadata via ``app.db.base`` so autogenerate works.
3. Run migrations asynchronously using ``asyncpg``.
"""

from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.core.config import settings

# Import Base *after* all models have been imported via app.db.base
from app.db.base import Base  # noqa: F401  — registers all tables

# ── Alembic Config object ──────────────────────────────────────────────
config = context.config

# Interpret the config file for Python logging (alembic.ini [loggers] section)
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override the sqlalchemy.url from alembic.ini with the real DATABASE_URL (normalized for asyncpg)
config.set_main_option("sqlalchemy.url", settings.sqlalchemy_database_url)

# Target metadata for autogenerate support
target_metadata = Base.metadata


# ════════════════════════════════════════════════════════════════════════
# Offline mode — generates SQL scripts without a live database connection
# ════════════════════════════════════════════════════════════════════════


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    Configures the context with just a URL and not an Engine. Calls to
    ``context.execute()`` emit the given SQL string to the script output.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


# ════════════════════════════════════════════════════════════════════════
# Online mode — runs against a live async database connection
# ════════════════════════════════════════════════════════════════════════


def do_run_migrations(connection: Connection) -> None:
    """Execute migrations within the provided synchronous connection.

    Called by the async wrapper below.
    """
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Create an async engine, connect, and run migrations."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode using an async engine."""
    asyncio.run(run_async_migrations())


# ── Entrypoint ──────────────────────────────────────────────────────────
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
