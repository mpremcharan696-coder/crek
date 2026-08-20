"""Webhook router — Meta Instagram webhook verification and event ingestion.

This is the most latency-critical router in the system.  Meta requires a 200
response within 10 seconds or it will retry (and eventually disable the
subscription).  All heavy processing is therefore offloaded to ARQ background
tasks.

Flow:
- ``GET  /instagram`` — one-time verification handshake
- ``POST /instagram`` — receive comment/DM events, validate signature, enqueue
"""

import hashlib
import hmac
import json
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import PlainTextResponse

from app.core.config import settings
from app.core.security import verify_webhook_signature

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/instagram", summary="Meta webhook verification")
async def verify_webhook(request: Request) -> PlainTextResponse:
    """Respond to Meta's webhook subscription verification challenge.

    Meta sends a GET with three query parameters:
    - ``hub.mode`` — always ``"subscribe"``
    - ``hub.verify_token`` — must match our configured verify token
    - ``hub.challenge`` — an opaque string to echo back

    Returns:
        PlainTextResponse with the challenge value on success.

    Raises:
        HTTPException 403: If the verify token doesn't match.
    """
    hub_mode: str | None = request.query_params.get("hub.mode")
    hub_verify_token: str | None = request.query_params.get("hub.verify_token")
    hub_challenge: str | None = request.query_params.get("hub.challenge")

    if (
        hub_mode == "subscribe"
        and hub_verify_token == settings.META_VERIFY_TOKEN
        and hub_challenge is not None
    ):
        logger.info("Webhook verification succeeded")
        return PlainTextResponse(content=hub_challenge, status_code=200)

    logger.warning(
        "Webhook verification failed: mode=%s, token_match=%s",
        hub_mode,
        hub_verify_token == settings.META_VERIFY_TOKEN if hub_verify_token else "missing",
    )
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Webhook verification failed",
    )


@router.post("/instagram", status_code=200, summary="Receive webhook events")
async def handle_webhook(request: Request) -> dict[str, str]:
    """Process incoming Meta webhook events.

    Steps:
    1. Read the raw request body.
    2. Validate the ``X-Hub-Signature-256`` header against the body using
       the app secret (HMAC-SHA256).
    3. Parse the JSON payload.
    4. Iterate over entries → changes, filtering for ``"comments"`` only
       (DMs are deferred to Phase 2).
    5. Deduplicate events via Redis ``SETNX`` (comment_id as key with TTL).
    6. Enqueue ``process_comment_task`` into ARQ.
    7. Return ``200`` immediately.

    Returns:
        A simple ``{"status": "ok"}`` dict.

    Raises:
        HTTPException 401: If the signature is missing or invalid.
    """
    # ---------------------------------------------------------------------- #
    #  1. Read raw body
    # ---------------------------------------------------------------------- #
    raw_body: bytes = await request.body()

    # ---------------------------------------------------------------------- #
    #  2. Validate HMAC-SHA256 signature (bypassed if secret is missing)
    # ---------------------------------------------------------------------- #
    signature_header: str | None = request.headers.get("X-Hub-Signature-256")
    if not settings.META_APP_SECRET:
        logger.warning("Bypassing webhook signature validation (META_APP_SECRET is not set)")
    else:
        if not signature_header:
            logger.warning("Webhook request missing X-Hub-Signature-256 header")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing signature",
            )
        if not verify_webhook_signature(
            raw_body, signature_header, settings.META_APP_SECRET
        ):
            logger.error("Webhook signature mismatch")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid signature",
            )

    # ---------------------------------------------------------------------- #
    #  3. Parse JSON payload
    # ---------------------------------------------------------------------- #
    try:
        payload: dict[str, Any] = json.loads(raw_body)
    except json.JSONDecodeError:
        logger.error("Webhook payload is not valid JSON")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload",
        )

    logger.debug("Webhook payload received: %s", json.dumps(payload, indent=2))

    # ---------------------------------------------------------------------- #
    #  4-6. Process entries — only comments (DMs deferred to Phase 2)
    # ---------------------------------------------------------------------- #
    arq_pool = request.app.state.arq_pool
    redis_pool = request.app.state.arq_pool  # ARQ pool doubles as Redis client

    entries: list[dict[str, Any]] = payload.get("entry", [])
    enqueued_count = 0

    for entry in entries:
        changes: list[dict[str, Any]] = entry.get("changes", [])
        for change in changes:
            field: str = change.get("field", "")

            # Phase 1: only process comments
            if field != "comments":
                logger.debug("Skipping non-comment field: %s", field)
                continue

            value: dict[str, Any] = change.get("value", {})
            comment_id: str | None = value.get("id")
            if not comment_id:
                logger.warning("Comment change missing id, skipping: %s", value)
                continue

            # ---------------------------------------------------------- #
            #  5. Deduplicate via Redis SETNX with 24h TTL
            # ---------------------------------------------------------- #
            dedup_key = f"pilotly:webhook:comment:{comment_id}"
            try:
                # SET key value NX EX <ttl>  → returns True if set, None if exists
                was_set = await redis_pool.set(
                    dedup_key.encode(),
                    b"1",
                    nx=True,
                    ex=86400,  # 24 hours
                )
                if not was_set:
                    logger.info(
                        "Duplicate webhook for comment_id=%s, skipping",
                        comment_id,
                    )
                    continue
            except Exception:
                # If Redis is down, still process — better duplicate than lost
                logger.exception(
                    "Redis dedup check failed for comment_id=%s, processing anyway",
                    comment_id,
                )

            # ---------------------------------------------------------- #
            #  6. Build comment event and enqueue to ARQ
            # ---------------------------------------------------------- #
            comment_event = {
                "comment_id": comment_id,
                "text": value.get("text", ""),
                "media_id": value.get("media", {}).get("id", ""),
                "commenter_id": value.get("from", {}).get("id"),
                "commenter_username": value.get("from", {}).get("username"),
                "parent_id": value.get("parent_id"),
            }

            try:
                await arq_pool.enqueue_job(
                    "process_comment_task",
                    comment_event=comment_event,
                )
                enqueued_count += 1
                logger.info(
                    "Enqueued process_comment_task for comment_id=%s",
                    comment_id,
                )
            except Exception:
                logger.exception(
                    "Failed to enqueue task for comment_id=%s",
                    comment_id,
                )

    logger.info("Webhook processed: %d events enqueued", enqueued_count)
    return {"status": "ok"}
