"""Reel business logic service.

Handles syncing reels from Instagram via the Meta Graph API, persisting them
locally, and providing multi-tenant retrieval for the dashboard.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.reel import Reel
from app.models.user import User
from app.services.meta_api_service import MetaAPIService

logger = logging.getLogger(__name__)


class ReelServiceError(Exception):
    """Base exception for reel service errors."""


class ReelNotFoundError(ReelServiceError):
    """Raised when a reel cannot be found."""


class ReelService:
    """Business logic layer for Instagram Reels.

    Provides:
    - Syncing reels from the Meta Graph API into the local database.
    - Paginated retrieval with multi-tenant isolation.
    - Detailed reel lookup including AI summary.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ------------------------------------------------------------------
    # Sync Reels
    # ------------------------------------------------------------------

    async def sync_reels(self, user_id: int, token: str, limit: int | None = None) -> list[Reel]:
        """Sync reels from the Meta Graph API into the local database.

        Fetches all reels via the API, compares against existing records, and
        creates entries for any newly discovered reels.  Existing reels are
        updated with the latest metadata (caption, like_count, etc.).

        Args:
            user_id: Internal user ID.
            token: Decrypted Meta access token.
            limit: Maximum number of reels to sync.

        Returns:
            List of newly created :class:`Reel` instances.

        Raises:
            ReelServiceError: If the sync operation fails.
        """
        meta_api = MetaAPIService()
        try:
            # Fetch user to get IG user ID
            result = await self.session.execute(
                select(User).where(User.id == user_id)
            )
            user = result.scalar_one_or_none()
            if user is None:
                raise ReelServiceError(f"User {user_id} not found")

            # Fetch reels from Meta
            logger.info("Syncing reels for user_id=%s (ig=%s, limit=%s)", user_id, user.instagram_user_id, limit)
            media_items = await meta_api.fetch_user_media(user.instagram_user_id, token, limit=limit)

            new_reels: list[Reel] = []
            updated_count = 0

            for item in media_items:
                media_id = item.get("id")
                if not media_id:
                    continue

                # Parse timestamp
                ig_timestamp = item.get("timestamp")
                parsed_ts = self._parse_ig_timestamp(ig_timestamp)

                # Check if reel already exists
                result = await self.session.execute(
                    select(Reel).where(Reel.media_id == media_id)
                )
                existing = result.scalar_one_or_none()

                if existing is None:
                    # Create new reel
                    reel = Reel(
                        user_id=user_id,
                        media_id=media_id,
                        caption=item.get("caption"),
                        media_url=item.get("media_url"),
                        thumbnail_url=item.get("thumbnail_url"),
                        permalink=item.get("permalink"),
                        like_count=item.get("like_count", 0),
                        comments_count=item.get("comments_count", 0),
                        published_at=parsed_ts,
                    )
                    self.session.add(reel)
                    await self.session.flush()
                    await self.session.refresh(reel)
                    new_reels.append(reel)
                    logger.debug("Created reel id=%s (media=%s)", reel.id, media_id)
                else:
                    # Update existing reel metadata
                    await self.session.execute(
                        update(Reel)
                        .where(Reel.id == existing.id, Reel.user_id == user_id)
                        .values(
                            caption=item.get("caption", existing.caption),
                            media_url=item.get("media_url", existing.media_url),
                            thumbnail_url=item.get("thumbnail_url", existing.thumbnail_url),
                            like_count=item.get("like_count", existing.like_count),
                            comments_count=item.get("comments_count", existing.comments_count),
                        )
                    )
                    await self.session.flush()
                    updated_count += 1

            await self.session.commit()

            logger.info(
                "Reel sync complete for user_id=%s: %d new, %d updated (total API: %d)",
                user_id,
                len(new_reels),
                updated_count,
                len(media_items),
            )
            return new_reels

        except ReelServiceError:
            raise
        except Exception as exc:
            logger.error("Reel sync failed for user_id=%s: %s", user_id, exc, exc_info=True)
            await self.session.rollback()
            raise ReelServiceError(f"Reel sync failed: {exc}") from exc
        finally:
            await meta_api.close()

    # ------------------------------------------------------------------
    # Retrieval
    # ------------------------------------------------------------------

    async def get_reels(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 50,
    ) -> list[Reel]:
        """Get all reels for a user with pagination.

        Args:
            user_id: Authenticated user's internal ID.
            skip: Pagination offset.
            limit: Maximum results.

        Returns:
            List of :class:`Reel` instances ordered by timestamp descending.
        """
        result = await self.session.execute(
            select(Reel)
            .where(Reel.user_id == user_id)
            .order_by(Reel.published_at.desc().nullslast(), Reel.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_reel_detail(self, reel_id: int, user_id: int) -> Reel | None:
        """Get a single reel with its AI summary.

        Multi-tenant isolation is enforced: only the owning user can access
        the reel.

        Args:
            reel_id: Internal reel ID.
            user_id: Authenticated user's internal ID.

        Returns:
            :class:`Reel` instance or None if not found / not owned by user.
        """
        result = await self.session.execute(
            select(Reel).options(selectinload(Reel.summary))
            .where(Reel.id == reel_id, Reel.user_id == user_id)
        )
        reel = result.scalar_one_or_none()
        if reel is None:
            logger.debug(
                "Reel %d not found or not owned by user %d", reel_id, user_id
            )
            return None
        return reel

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_ig_timestamp(ts: str | None) -> datetime:
        """Parse an Instagram ISO-8601 timestamp.

        Falls back to ``datetime.now(UTC)`` if parsing fails.

        Args:
            ts: ISO-8601 formatted timestamp string or None.

        Returns:
            Timezone-aware datetime.
        """
        if not ts:
            return datetime.now(timezone.utc)
        try:
            # Instagram uses ISO-8601: "2024-05-14T10:30:00+0000"
            dt = datetime.fromisoformat(ts.replace("+0000", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except (ValueError, AttributeError) as exc:
            logger.debug("Could not parse IG timestamp '%s': %s", ts, exc)
            return datetime.now(timezone.utc)
