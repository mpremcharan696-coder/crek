"""Webhook processing service for Meta/Instagram webhook events.

Parses incoming webhook payloads from Meta, extracts comment events, and
provides Redis-backed deduplication to prevent double-processing.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from arq.connections import ArqRedis

logger = logging.getLogger(__name__)


# ======================================================================
# Data Transfer Objects
# ======================================================================

@dataclass(frozen=True)
class CommentWebhookEvent:
    """Represents a single comment event extracted from a Meta webhook payload.

    Attributes:
        comment_id: Instagram comment ID.
        text: Comment text content.
        from_id: Instagram-scoped user ID of the commenter.
        from_username: Username of the commenter.
        media_id: Instagram media ID the comment was posted on.
        media_product_type: Media type (e.g. ``REELS``).
        ig_account_id: Instagram account ID that received the comment.
        timestamp: Unix timestamp of the webhook event (ms).
    """

    comment_id: str
    text: str
    from_id: str
    from_username: str
    media_id: str
    media_product_type: str
    ig_account_id: str
    timestamp: int
    raw_value: dict = field(default_factory=dict, repr=False)


# ======================================================================
# Webhook Service
# ======================================================================

class WebhookService:
    """Parses Meta webhook payloads and manages event deduplication via Redis.

    Responsibilities:
    - Extract comment events from the nested webhook payload structure.
    - Ignore non-comment field changes.
    - Deduplicate events using Redis with a configurable TTL.
    """

    DEDUP_TTL: int = 300  # 5 minutes

    def __init__(self, redis: ArqRedis) -> None:
        self.redis = redis

    # ------------------------------------------------------------------
    # Payload Parsing
    # ------------------------------------------------------------------

    def parse_comment_event(self, payload: dict[str, Any]) -> list[CommentWebhookEvent]:
        """Parse a Meta webhook payload and extract comment events.

        Expected payload structure::

            {
                "object": "instagram",
                "entry": [{
                    "id": "<IG_ACCOUNT_ID>",
                    "time": 1715678901234,
                    "changes": [{
                        "field": "comments",
                        "value": {
                            "id": "<COMMENT_ID>",
                            "text": "...",
                            "from": {"id": "<IGSID>", "username": "..."},
                            "media": {"id": "<MEDIA_ID>", "media_product_type": "REELS"}
                        }
                    }]
                }]
            }

        Only ``comments`` field changes are processed; all others are ignored.

        Args:
            payload: Raw webhook JSON payload from Meta.

        Returns:
            List of :class:`CommentWebhookEvent` objects. May be empty if no
            comment events are found or the payload is malformed.
        """
        events: list[CommentWebhookEvent] = []

        # Validate top-level structure
        if not isinstance(payload, dict):
            logger.warning("Webhook payload is not a dict: %s", type(payload))
            return events

        obj_type = payload.get("object")
        if obj_type != "instagram":
            logger.debug("Ignoring non-Instagram webhook object type: %s", obj_type)
            return events

        entries = payload.get("entry", [])
        if not isinstance(entries, list):
            logger.warning("Webhook 'entry' is not a list")
            return events

        for entry in entries:
            if not isinstance(entry, dict):
                logger.debug("Skipping non-dict entry")
                continue

            ig_account_id = str(entry.get("id", ""))
            entry_time = entry.get("time", 0)
            changes = entry.get("changes", [])

            if not isinstance(changes, list):
                logger.debug("Skipping entry with non-list 'changes'")
                continue

            for change in changes:
                if not isinstance(change, dict):
                    continue

                field_name = change.get("field")
                if field_name != "comments":
                    logger.debug("Ignoring webhook field: %s", field_name)
                    continue

                value = change.get("value", {})
                if not isinstance(value, dict):
                    logger.warning("Comment change 'value' is not a dict")
                    continue

                event = self._extract_comment_event(value, ig_account_id, entry_time)
                if event is not None:
                    events.append(event)

        logger.info(
            "Parsed %d comment event(s) from webhook payload",
            len(events),
        )
        return events

    # ------------------------------------------------------------------
    # Deduplication
    # ------------------------------------------------------------------

    async def is_duplicate_event(self, event_id: str) -> bool:
        """Check whether an event has already been processed.

        Uses a Redis key with TTL to track processed events.

        Args:
            event_id: Unique event identifier (typically the comment ID).

        Returns:
            True if the event was previously processed within the TTL window.
        """
        redis_key = f"webhook:event:{event_id}"
        existing = await self.redis.get(redis_key)
        if existing is not None:
            logger.debug("Duplicate event detected: %s", event_id)
            return True
        return False

    async def mark_event_processed(self, event_id: str) -> None:
        """Mark an event as processed with a TTL.

        Args:
            event_id: Unique event identifier.
        """
        redis_key = f"webhook:event:{event_id}"
        await self.redis.setex(redis_key, self.DEDUP_TTL, "1")
        logger.debug("Marked event as processed: %s (TTL=%ds)", event_id, self.DEDUP_TTL)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _extract_comment_event(
        self,
        value: dict[str, Any],
        ig_account_id: str,
        timestamp: int,
    ) -> CommentWebhookEvent | None:
        """Extract a :class:`CommentWebhookEvent` from the ``value`` dict.

        Args:
            value: The ``changes[].value`` dict from the webhook.
            ig_account_id: Instagram account ID from the entry.
            timestamp: Entry-level timestamp.

        Returns:
            A :class:`CommentWebhookEvent` or None if required fields are missing.
        """
        comment_id = value.get("id")
        text = value.get("text")

        if not comment_id or text is None:
            logger.warning(
                "Missing required comment fields (id=%s, text=%s)",
                comment_id,
                text is not None,
            )
            return None

        from_data = value.get("from", {})
        if not isinstance(from_data, dict):
            from_data = {}

        from_id = str(from_data.get("id", ""))
        from_username = from_data.get("username", "")

        media_data = value.get("media", {})
        if not isinstance(media_data, dict):
            media_data = {}

        media_id = str(media_data.get("id", ""))
        media_product_type = media_data.get("media_product_type", "")

        if not media_id:
            logger.warning("Comment event %s has no media_id", comment_id)
            return None

        return CommentWebhookEvent(
            comment_id=str(comment_id),
            text=str(text),
            from_id=from_id,
            from_username=from_username,
            media_id=media_id,
            media_product_type=media_product_type,
            ig_account_id=ig_account_id,
            timestamp=timestamp,
            raw_value=value,
        )
