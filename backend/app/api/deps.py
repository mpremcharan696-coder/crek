"""Shared FastAPI dependencies for authentication and database sessions.

This module provides reusable dependency injection functions used across
all API routers for extracting the current user from JWT tokens and
obtaining async database sessions.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import verify_jwt
from app.db.session import get_db  # noqa: F401 — re-exported for router convenience

security_scheme = HTTPBearer(
    scheme_name="Bearer",
    description="JWT access token obtained via /api/v1/auth/callback",
)


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
) -> int:
    """Extract and validate ``user_id`` from a JWT Bearer token.

    Raises:
        HTTPException 401: If the token is missing, expired, malformed,
            or does not contain a ``user_id`` claim.
    """
    payload = verify_jwt(
        credentials.credentials,
        settings.JWT_SECRET,
        settings.JWT_ALGORITHM,
    )
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_str: str | None = payload.get("sub")
    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload: missing user_id",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        return int(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload: user_id is not an integer",
            headers={"WWW-Authenticate": "Bearer"},
        )
