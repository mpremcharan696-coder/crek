"""Async client for the Meta / Instagram Graph API.

Provides typed methods for fetching user media, comments, posting replies,
and retrieving profiles.  Includes automatic rate-limit awareness (via the
``X-App-Usage`` header) and exponential-backoff retry on 429 responses.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class MetaAPIError(Exception):
    """Base exception for Meta Graph API errors."""

    def __init__(self, message: str, status_code: int | None = None, error_body: dict | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.error_body = error_body or {}


class MetaRateLimitError(MetaAPIError):
    """Raised when retries are exhausted after receiving 429 responses."""


class MetaAPIService:
    """Async HTTP client for the Meta / Instagram Graph API.

    Features:
    - Automatic pagination for list endpoints.
    - Exponential backoff with up to 3 retries on HTTP 429.
    - Parses ``X-App-Usage`` headers and logs warnings at >80 % utilisation.
    """

    BASE_URL: str = f"https://graph.facebook.com/{settings.META_GRAPH_API_VERSION}"

    # Retry configuration
    MAX_RETRIES: int = 3
    RETRY_BACKOFF_SECONDS: list[float] = [1.0, 2.0, 4.0]

    # Rate-limit warning threshold (percentage)
    RATE_LIMIT_WARN_THRESHOLD: int = 80

    def __init__(self) -> None:
        self.http_client = httpx.AsyncClient(timeout=30.0)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def fetch_user_media(self, ig_user_id: str, token: str, limit: int | None = None) -> list[dict]:
        """Fetch media for *ig_user_id*, filtering to Reels only.

        Follows ``paging.next`` cursors to retrieve subsequent pages up to limit.

        Args:
            ig_user_id: Instagram-scoped user ID.
            token: Valid Meta access token.
            limit: Maximum number of Reels to fetch.

        Returns:
            List of media dicts whose ``media_product_type`` is ``REELS``.
        """
        url = f"{self.BASE_URL}/{ig_user_id}/media"
        fields = (
            "id,caption,media_url,media_type,media_product_type,"
            "permalink,thumbnail_url,timestamp,like_count,comments_count"
        )
        all_media: list[dict] = []

        page_limit = "50"
        if limit is not None and limit < 50:
            page_limit = str(limit)

        params: dict[str, Any] = {"fields": fields, "limit": page_limit}
        while url:
            data = await self._request("GET", url, token, params=params)
            items = data.get("data", [])
            reels = [m for m in items if m.get("media_product_type") == "REELS"]
            all_media.extend(reels)

            if limit is not None and len(all_media) >= limit:
                all_media = all_media[:limit]
                break

            # Follow pagination cursor
            paging = data.get("paging", {})
            url = paging.get("next")  # type: ignore[assignment]
            params = {}  # next URL already contains query params

        logger.info(
            "Fetched %d reels (from total media) for IG user %s",
            len(all_media),
            ig_user_id,
        )
        return all_media

    async def fetch_media_details(self, media_id: str, token: str) -> dict:
        """Fetch detailed information for a single media item.

        Args:
            media_id: Instagram media ID.
            token: Valid Meta access token.

        Returns:
            Dict containing media fields.
        """
        url = f"{self.BASE_URL}/{media_id}"
        fields = (
            "id,caption,media_url,media_type,media_product_type,"
            "permalink,thumbnail_url,timestamp,like_count,comments_count"
        )
        data = await self._request("GET", url, token, params={"fields": fields})
        return data

    async def fetch_comments(self, media_id: str, token: str) -> list[dict]:
        """Fetch all comments on a media item, handling pagination.

        Args:
            media_id: Instagram media ID.
            token: Valid Meta access token.

        Returns:
            List of comment dicts.
        """
        url = f"{self.BASE_URL}/{media_id}/comments"
        fields = "id,text,from,timestamp,like_count,replies{id,text,from,timestamp}"
        all_comments: list[dict] = []

        params: dict[str, Any] = {"fields": fields, "limit": "50"}
        while url:
            data = await self._request("GET", url, token, params=params)
            comments = data.get("data", [])
            all_comments.extend(comments)

            paging = data.get("paging", {})
            url = paging.get("next")  # type: ignore[assignment]
            params = {}

        logger.info("Fetched %d comments for media %s", len(all_comments), media_id)
        return all_comments

    async def post_comment_reply(self, comment_id: str, message: str, token: str) -> str:
        """Post a reply to a comment.

        Args:
            comment_id: Instagram comment ID to reply to.
            message: Reply text.
            token: Valid Meta access token.

        Returns:
            Instagram ID of the newly created reply.

        Raises:
            MetaAPIError: On API failure.
        """
        url = f"{self.BASE_URL}/{comment_id}/replies"
        data = await self._request("POST", url, token, data={"message": message})
        reply_id = data.get("id", "")
        logger.info("Posted reply %s to comment %s", reply_id, comment_id)
        return reply_id

    async def get_user_profile(self, ig_user_id: str, token: str) -> dict:
        """Fetch user profile information.

        Args:
            ig_user_id: Instagram-scoped user ID.
            token: Valid Meta access token.

        Returns:
            Dict with profile fields.
        """
        url = f"{self.BASE_URL}/{ig_user_id}"
        fields = "id,username,name,profile_picture_url,biography,followers_count,media_count"
        data = await self._request("GET", url, token, params={"fields": fields})
        return data

    async def like_comment(self, comment_id: str, token: str) -> bool:
        """Like an Instagram comment.

        Args:
            comment_id: Instagram comment ID to like.
            token: Valid Meta access token.

        Returns:
            True if successful.

        Raises:
            MetaAPIError: On API failure.
        """
        url = f"{self.BASE_URL}/{comment_id}/likes"
        await self._request("POST", url, token)
        logger.info("Liked comment %s", comment_id)
        return True

    async def send_private_reply(
        self,
        comment_id: str,
        message_text: str,
        token: str,
        quick_reply_title: str | None = None,
    ) -> dict:
        """Send a private Direct Message in response to an Instagram comment (Comment-to-DM).

        Uses Meta's Private Replies API: ``POST /me/messages`` with ``recipient.comment_id``.

        Args:
            comment_id: Instagram comment ID that triggered the DM.
            message_text: Initial text prompt to send.
            token: Valid Meta/Instagram user access token.
            quick_reply_title: Optional button label (e.g. 'Send me the link').

        Returns:
            Dict containing Meta message response (e.g. message_id).
        """
        url = f"{self.BASE_URL}/me/messages"
        message_payload: dict[str, Any] = {"text": message_text}

        if quick_reply_title:
            message_payload["quick_replies"] = [
                {
                    "content_type": "text",
                    "title": quick_reply_title,
                    "payload": "SEND_LINK_PAYLOAD",
                }
            ]

        body = {
            "recipient": {"comment_id": comment_id},
            "message": message_payload,
        }

        # Need json body in request
        import json
        if token.startswith("IG") and "graph.facebook.com" in url:
            url = url.replace("graph.facebook.com", "graph.instagram.com")

        params = {"access_token": token}
        headers = {"Content-Type": "application/json"}

        response = await self.http_client.post(
            url,
            params=params,
            json=body,
            headers=headers,
        )

        if response.status_code >= 400:
            error_body = self._safe_json(response)
            error_msg = error_body.get("error", {}).get("message", response.text[:300])
            logger.warning("Private reply failed for comment %s: %s", comment_id, error_msg)
            # Try fallback to page_messages endpoint if me/messages fails
            raise MetaAPIError(f"Private reply failed ({response.status_code}): {error_msg}")

        logger.info("Successfully sent private reply for comment %s", comment_id)
        return response.json()

    async def send_direct_message(
        self,
        recipient_id: str,
        message_text: str,
        token: str,
    ) -> dict:
        """Send a direct message to an Instagram user IGSID.

        Args:
            recipient_id: Instagram user IGSID.
            message_text: Message text to deliver.
            token: Valid Meta access token.

        Returns:
            Dict containing message response.
        """
        url = f"{self.BASE_URL}/me/messages"
        if token.startswith("IG") and "graph.facebook.com" in url:
            url = url.replace("graph.facebook.com", "graph.instagram.com")

        params = {"access_token": token}
        headers = {"Content-Type": "application/json"}
        body = {
            "recipient": {"id": recipient_id},
            "message": {"text": message_text},
        }

        response = await self.http_client.post(
            url,
            params=params,
            json=body,
            headers=headers,
        )

        if response.status_code >= 400:
            error_body = self._safe_json(response)
            error_msg = error_body.get("error", {}).get("message", response.text[:300])
            logger.warning("Direct message to %s failed: %s", recipient_id, error_msg)
            raise MetaAPIError(f"Direct message failed ({response.status_code}): {error_msg}")

        logger.info("Successfully sent direct message to %s", recipient_id)
        return response.json()

    # ------------------------------------------------------------------
    # Internal request handler
    # ------------------------------------------------------------------

    async def _request(
        self,
        method: str,
        url: str,
        token: str,
        *,
        params: dict[str, Any] | None = None,
        data: dict[str, Any] | None = None,
    ) -> dict:
        """Send an HTTP request to the Meta Graph API with retries and rate-limit awareness.

        Behaviour:
        - Appends ``access_token`` to query parameters.
        - Parses the ``X-App-Usage`` response header and logs warnings
          when any utilisation dimension exceeds 80 %.
        - Retries up to 3 times with exponential backoff (1 s → 2 s → 4 s)
          on HTTP 429 responses.
        - Raises :class:`MetaAPIError` on non-retryable failures.

        Args:
            method: HTTP method (``GET``, ``POST``, etc.).
            url: Full request URL.
            token: Meta access token (added automatically).
            params: Optional query parameters.
            data: Optional form/body data.

        Returns:
            Parsed JSON response body as a dict.

        Raises:
            MetaRateLimitError: If retries are exhausted on 429.
            MetaAPIError: On any other non-2xx response.
        """
        import asyncio

        if token.startswith("IG") and "graph.facebook.com" in url:
            url = url.replace("graph.facebook.com", "graph.instagram.com")

        if params is None:
            params = {}
        params["access_token"] = token

        last_exception: Exception | None = None

        for attempt in range(self.MAX_RETRIES + 1):
            try:
                logger.debug(
                    "Meta API %s %s (attempt %d/%d)",
                    method,
                    self._safe_url(url),
                    attempt + 1,
                    self.MAX_RETRIES + 1,
                )

                response = await self.http_client.request(
                    method,
                    url,
                    params=params,
                    data=data,
                )

                # Parse rate-limit header
                self._parse_rate_limit_header(response)

                # Handle 429 – Too Many Requests
                if response.status_code == 429:
                    if attempt < self.MAX_RETRIES:
                        backoff = self.RETRY_BACKOFF_SECONDS[attempt]
                        logger.warning(
                            "Rate limited (429) on %s %s – retrying in %.1fs (attempt %d/%d)",
                            method,
                            self._safe_url(url),
                            backoff,
                            attempt + 1,
                            self.MAX_RETRIES,
                        )
                        await asyncio.sleep(backoff)
                        continue
                    else:
                        error_body = self._safe_json(response)
                        raise MetaRateLimitError(
                            f"Rate limit exceeded after {self.MAX_RETRIES} retries on {method} {self._safe_url(url)}",
                            status_code=429,
                            error_body=error_body,
                        )

                # Raise on other non-2xx statuses
                if response.status_code >= 400:
                    error_body = self._safe_json(response)
                    error_msg = error_body.get("error", {}).get("message", response.text[:300])
                    raise MetaAPIError(
                        f"Meta API error {response.status_code}: {error_msg}",
                        status_code=response.status_code,
                        error_body=error_body,
                    )

                return response.json()

            except (httpx.ConnectError, httpx.ReadTimeout, httpx.WriteTimeout) as exc:
                last_exception = exc
                if attempt < self.MAX_RETRIES:
                    backoff = self.RETRY_BACKOFF_SECONDS[attempt]
                    logger.warning(
                        "Network error on %s %s: %s – retrying in %.1fs",
                        method,
                        self._safe_url(url),
                        exc,
                        backoff,
                    )
                    await asyncio.sleep(backoff)
                    continue
                logger.error(
                    "Network error on %s %s after %d retries: %s",
                    method,
                    self._safe_url(url),
                    self.MAX_RETRIES,
                    exc,
                )
                raise MetaAPIError(
                    f"Network error after {self.MAX_RETRIES} retries: {exc}",
                ) from exc

        # Should not reach here, but safeguard
        raise MetaAPIError(f"Request failed after retries: {last_exception}")  # pragma: no cover

    # ------------------------------------------------------------------
    # Rate-limit parsing
    # ------------------------------------------------------------------

    def _parse_rate_limit_header(self, response: httpx.Response) -> None:
        """Parse ``X-App-Usage`` header and log warnings when approaching limits.

        The header is a JSON object like::

            {"call_count": 28, "total_cputime": 10, "total_time": 15}

        Each value is a percentage (0–100).  We warn when any exceeds the
        configured threshold (default 80 %).
        """
        header_value = response.headers.get("x-app-usage")
        if not header_value:
            return

        try:
            usage = json.loads(header_value)
        except (json.JSONDecodeError, TypeError):
            logger.debug("Could not parse X-App-Usage header: %s", header_value)
            return

        call_count = usage.get("call_count", 0)
        total_cputime = usage.get("total_cputime", 0)
        total_time = usage.get("total_time", 0)

        if any(v > self.RATE_LIMIT_WARN_THRESHOLD for v in (call_count, total_cputime, total_time)):
            logger.warning(
                "Meta API rate limit approaching: call_count=%s%%, total_cputime=%s%%, total_time=%s%%",
                call_count,
                total_cputime,
                total_time,
            )
        else:
            logger.debug(
                "Meta API usage: call_count=%s%%, total_cputime=%s%%, total_time=%s%%",
                call_count,
                total_cputime,
                total_time,
            )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _safe_url(url: str) -> str:
        """Strip access_token from URL for safe logging."""
        if "access_token=" in url:
            base, _, _ = url.partition("access_token=")
            return f"{base}access_token=***"
        return url

    @staticmethod
    def _safe_json(response: httpx.Response) -> dict:
        """Safely parse JSON from a response, returning empty dict on failure."""
        try:
            return response.json()
        except Exception:
            return {}

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self.http_client.aclose()
