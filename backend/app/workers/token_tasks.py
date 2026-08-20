"""Token refresh background task.

Runs as a daily ARQ cron job (default 03:00 UTC) to proactively refresh
Meta long-lived tokens that are approaching expiry.  This prevents API
failures caused by expired tokens.

Meta long-lived tokens are valid for 60 days and can be refreshed after
24 hours.  We refresh any token expiring within 7 days.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update

from app.core.config import settings
from app.core.security import decrypt_token, encrypt_token
from app.models.user import UserToken

logger = logging.getLogger(__name__)

# How many days before expiry to trigger a refresh
_REFRESH_WINDOW_DAYS = 7


async def refresh_expiring_tokens_task(ctx: dict) -> None:
    """Find and refresh all Meta tokens expiring within the refresh window.

    Steps for each expiring token:
        1. Decrypt the stored token.
        2. Call Meta's token refresh endpoint.
        3. Re-encrypt the new token and update ``expires_at``.
        4. Log success or failure for auditing.

    Args:
        ctx: ARQ context dict with ``db_session_factory``.
    """
    db_session_factory = ctx["db_session_factory"]

    import httpx

    async with db_session_factory() as session:
        # Query tokens that expire within the window
        threshold = datetime.now(timezone.utc) + timedelta(days=_REFRESH_WINDOW_DAYS)
        result = await session.execute(
            select(UserToken)
            .where(
                UserToken.expires_at <= threshold,
                UserToken.expires_at > datetime.now(timezone.utc),
            )
            .order_by(UserToken.expires_at.asc())
        )
        expiring_tokens = list(result.scalars().all())

        if not expiring_tokens:
            logger.info("No tokens expiring within %d days", _REFRESH_WINDOW_DAYS)
            return

        logger.info(
            "Found %d token(s) expiring within %d days — starting refresh",
            len(expiring_tokens),
            _REFRESH_WINDOW_DAYS,
        )

        refreshed = 0
        failed = 0

        async with httpx.AsyncClient(timeout=30.0) as http_client:
            for token_row in expiring_tokens:
                try:
                    # Decrypt current token
                    current_token = decrypt_token(
                        token_row.encrypted_access_token,
                        settings.ENCRYPTION_KEY,
                    )

                    # Call Meta refresh endpoint
                    response = await http_client.get(
                        "https://graph.instagram.com/refresh_access_token",
                        params={
                            "grant_type": "ig_refresh_token",
                            "access_token": current_token,
                        },
                    )

                    if response.status_code != 200:
                        logger.error(
                            "Token refresh failed for user_id=%d: HTTP %d — %s",
                            token_row.user_id,
                            response.status_code,
                            response.text[:500],
                        )
                        failed += 1
                        continue

                    data = response.json()
                    new_token = data.get("access_token")
                    expires_in = data.get("expires_in", 5184000)  # Default 60 days

                    if not new_token:
                        logger.error(
                            "Token refresh response missing access_token "
                            "for user_id=%d: %s",
                            token_row.user_id,
                            data,
                        )
                        failed += 1
                        continue

                    # Re-encrypt and store
                    new_encrypted = encrypt_token(new_token, settings.ENCRYPTION_KEY)
                    new_expires_at = datetime.now(timezone.utc) + timedelta(
                        seconds=expires_in
                    )

                    await session.execute(
                        update(UserToken)
                        .where(UserToken.id == token_row.id)
                        .values(
                            encrypted_access_token=new_encrypted,
                            expires_at=new_expires_at,
                            token_type="long_lived",
                        )
                    )
                    await session.flush()

                    refreshed += 1
                    logger.info(
                        "Token refreshed for user_id=%d — new expiry: %s",
                        token_row.user_id,
                        new_expires_at.isoformat(),
                    )

                except Exception:
                    logger.exception(
                        "Unexpected error refreshing token for user_id=%d",
                        token_row.user_id,
                    )
                    failed += 1
                    continue

        await session.commit()

        logger.info(
            "Token refresh complete: %d refreshed, %d failed, %d total",
            refreshed,
            failed,
            len(expiring_tokens),
        )

        if failed > 0:
            logger.warning(
                "%d token refresh(es) failed — check logs for user IDs",
                failed,
            )
