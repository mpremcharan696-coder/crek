"""Async SQLAlchemy engine, session factory, and FastAPI dependency.

The ``get_db`` async generator is designed to be used as a FastAPI
``Depends()`` parameter.  It automatically commits on success and rolls
back on exception, so callers don't need manual transaction handling in
the common case.

Example::

    from fastapi import Depends
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.db.session import get_db

    @router.get("/items")
    async def list_items(db: AsyncSession = Depends(get_db)):
        ...
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

engine = create_async_engine(
    settings.sqlalchemy_database_url,
    pool_size=20,
    max_overflow=30,
    pool_timeout=30.0,
    pool_pre_ping=True,
    pool_recycle=1800,
    echo=settings.DEBUG,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an async database session.

    The session is automatically committed when the request handler
    returns normally, and rolled back if any exception propagates.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
