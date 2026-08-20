"""Background tasks for reel synchronisation and AI analysis.

``sync_all_reels_task``
    Periodic cron job (every 15 min) that iterates over all active users
    and enqueues a ``sync_user_reels_task`` for each.

``sync_user_reels_task``
    Fetches the latest reels from Meta for a single user, persists any new ones,
    and enqueues analysis for unprocessed reels.

``analyze_reel_task``
    Processes a single reel: downloads the video, uploads it to the Google Gemini File API,
    generates a structured multimodal AI summary with Gemini 2.5 Flash, and stores the result.
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.security import decrypt_token
from app.models.user import User, UserToken
from app.models.reel import Reel, ReelSummary

logger = logging.getLogger(__name__)


# ======================================================================
# Periodic sync — discover new reels for all active users
# ======================================================================

async def sync_all_reels_task(ctx: dict) -> None:
    """Fetch latest reels from Meta for every active user.

    1. Fetch all active users from the database.
    2. Enqueue ``sync_user_reels_task`` for each active user.
    """
    db_session_factory = ctx["db_session_factory"]

    try:
        async with db_session_factory() as session:
            result = await session.execute(
                select(User.id).where(User.is_active.is_(True))
            )
            user_ids = result.scalars().all()

            logger.info("sync_all_reels_task: enqueuing sync for %d active users", len(user_ids))

            for uid in user_ids:
                try:
                    await ctx["redis"].enqueue_job("sync_user_reels_task", user_id=uid)
                except Exception:
                    logger.exception("Failed to enqueue sync_user_reels_task for user_id=%s", uid)
                    continue

    except Exception:
        logger.exception("sync_all_reels_task encountered a fatal error")


async def sync_user_reels_task(ctx: dict, user_id: int, limit: int | None = None) -> None:
    """Fetch latest reels from Meta for a single user.

    1. Decrypt the Meta access token.
    2. Call the Meta Graph API to list recent media.
    3. Filter for ``media_product_type == 'REELS'``.
    4. Persist any new reels that aren't already in the database.
    5. Enqueue ``analyze_reel_task`` for each reel that hasn't been analysed.
    """
    db_session_factory = ctx["db_session_factory"]

    from app.services.meta_api_service import MetaAPIService

    meta_api = MetaAPIService()

    try:
        async with db_session_factory() as session:
            result = await session.execute(
                select(User).where(User.id == user_id)
            )
            user = result.scalar_one_or_none()
            if not user or not user.is_active:
                logger.warning("sync_user_reels_task: user_id=%s not found or inactive", user_id)
                return

            result = await session.execute(
                select(UserToken)
                .where(UserToken.user_id == user_id)
                .order_by(UserToken.expires_at.desc())
                .limit(1)
            )
            token_row = result.scalar_one_or_none()
            if token_row is None:
                logger.warning("User %d has no token, skipping reel sync", user_id)
                return

            access_token = decrypt_token(
                token_row.encrypted_access_token,
                settings.ENCRYPTION_KEY,
            )

            # Fetch reels from Meta
            media_items = await meta_api.fetch_user_media(
                user.instagram_user_id, access_token, limit=limit
            )

            new_reel_count = 0
            for item in media_items:
                if item.get("media_product_type") != "REELS":
                    continue

                media_id = item.get("id")
                if not media_id:
                    continue

                result = await session.execute(
                    select(Reel).where(Reel.media_id == media_id)
                )
                existing = result.scalar_one_or_none()
                if existing is not None:
                    if not existing.is_analyzed:
                        await ctx["redis"].enqueue_job("analyze_reel_task", media_id=existing.media_id)
                        logger.info("Enqueued analysis for existing unanalyzed reel %d", existing.id)
                    continue

                from datetime import datetime

                published_at = None
                ts = item.get("timestamp")
                if ts:
                    try:
                        published_at = datetime.fromisoformat(ts.replace("+0000", "+00:00"))
                    except (ValueError, AttributeError):
                        pass

                reel = Reel(
                    user_id=user_id,
                    media_id=media_id,
                    caption=item.get("caption"),
                    media_url=item.get("media_url"),
                    thumbnail_url=item.get("thumbnail_url"),
                    permalink=item.get("permalink"),
                    like_count=item.get("like_count", 0),
                    comments_count=item.get("comments_count", 0),
                    published_at=published_at,
                )
                session.add(reel)
                await session.flush()
                await session.refresh(reel)
                new_reel_count += 1

                if not reel.is_analyzed:
                    await ctx["redis"].enqueue_job("analyze_reel_task", reel_id=reel.id)
                    logger.info("Enqueued analysis for reel %d (media_id=%s)", reel.id, media_id)

            await session.commit()

            if new_reel_count > 0:
                logger.info("User %d: discovered %d new reels", user_id, new_reel_count)

    except Exception:
        logger.exception("sync_user_reels_task failed for user %d", user_id)
    finally:
        await meta_api.close()


# ======================================================================
# Single reel analysis
# ======================================================================

async def analyze_reel_task(
    ctx: dict,
    reel_id: int | None = None,
    media_id: str | None = None,
) -> None:
    """Download, process, and generate an AI summary for one reel.

    Either ``reel_id`` (internal DB id) or ``media_id`` (Instagram media id)
    must be provided.

    Steps:
        1. Load the reel record from the database.
        2. Decrypt the owner's Meta access token.
        3. Download the reel video to a temporary MP4 file.
        4. Upload the video to the Gemini File API.
        5. Generate a structured multimodal AI summary with Gemini 2.5 Flash.
        6. Persist the ``ReelSummary`` and mark the reel as analysed.
    """
    db_session_factory = ctx["db_session_factory"]

    from app.services.media_processor import MediaProcessor
    from app.services.ai_agent_service import AIAgentService, AnalysisError
    from app.services.meta_api_service import MetaAPIService

    media_processor = MediaProcessor()
    ai_service = AIAgentService()
    meta_api = MetaAPIService()

    try:
        async with db_session_factory() as session:
            # 1. Load reel
            reel = None
            if reel_id is not None:
                result = await session.execute(
                    select(Reel).options(selectinload(Reel.summary))
                    .where(Reel.id == reel_id)
                )
                reel = result.scalar_one_or_none()
            elif media_id is not None:
                result = await session.execute(
                    select(Reel).where(Reel.media_id == media_id)
                )
                reel = result.scalar_one_or_none()

            if reel is None:
                logger.error(
                    "analyze_reel_task: reel not found (reel_id=%s, media_id=%s)",
                    reel_id,
                    media_id,
                )
                return

            # Skip if already analysed
            result = await session.execute(
                select(ReelSummary).where(ReelSummary.reel_id == reel.id)
            )
            existing_summary = result.scalar_one_or_none()
            if existing_summary is not None:
                logger.info("Reel %d already has a summary, skipping", reel.id)
                return

            # 2. Decrypt access token
            result = await session.execute(
                select(UserToken)
                .where(UserToken.user_id == reel.user_id)
                .order_by(UserToken.expires_at.desc())
                .limit(1)
            )
            token_row = result.scalar_one_or_none()
            if token_row is None:
                logger.error("No token for user %d, cannot analyse reel %d", reel.user_id, reel.id)
                return

            access_token = decrypt_token(
                token_row.encrypted_access_token,
                settings.ENCRYPTION_KEY,
            )

            summary_result = None
            analysis_model = "gemini-2.5-flash"
            error_occurred = False
            error_message = ""

            try:
                # Ensure we have a media_url — fetch from Meta if missing
                media_url = reel.media_url
                if not media_url:
                    details = await meta_api.fetch_media_details(reel.media_id, access_token)
                    media_url = details.get("media_url")
                    if not media_url:
                        raise AnalysisError("No media URL returned from Meta Graph API")
                    # Update the reel record
                    reel.media_url = media_url

                # 3. Load user info for creator context
                result = await session.execute(
                    select(User).where(User.id == reel.user_id)
                )
                user = result.scalar_one_or_none()
                creator_name = user.username if user else "Unknown"

                # 4-6. Download video, analyze, and cleanup
                logger.info("Downloading video for reel %d", reel.id)
                async for video_path in media_processor.download_reel(media_url):
                    logger.info("Generating AI summary for reel %d via Gemini", reel.id)
                    summary_result = await ai_service.analyze_reel(
                        video_path=video_path,
                        caption=reel.caption,
                        creator_name=creator_name,
                    )
                    
                    if summary_result and "error" in summary_result:
                        analysis_model = "failed"
                        error_occurred = True
                        error_message = summary_result["error"]
                    elif summary_result and "realtime_context" in summary_result:
                        analysis_model = "gemini-2.5-flash + grok-2-latest"
            except Exception as e:
                logger.exception("Failed during download/analysis of reel %d", reel.id)
                error_occurred = True
                error_message = f"Analysis pipeline error: {str(e)}"
                summary_result = {
                    "error": error_message,
                    "topic": "Failed",
                    "summary": f"Failed to generate summary: {error_message}",
                    "products_mentioned": [],
                    "key_points": [],
                    "faq": [],
                    "context": f"Error: {error_message}",
                    "creator_intent": "Failed",
                    "realtime_context": None
                }
                analysis_model = "failed"

            # 7. Persist summary (whether success or failure)
            if summary_result:
                if not error_occurred:
                    if not summary_result.get("summary"):
                        summary_result["summary"] = "reel summerry generation completed"
                    if not summary_result.get("key_points"):
                        summary_result["key_points"] = ["reel summerry generation completed"]
                    if not summary_result.get("topic"):
                        summary_result["topic"] = "Reel Analysis"

                summary = ReelSummary(
                    reel_id=reel.id,
                    ai_summary=summary_result,
                    topics=summary_result.get("topics", []),
                    products_mentioned=summary_result.get("products_mentioned", []),
                    key_points=summary_result.get("key_points", []),
                    faq=summary_result.get("faq", []),
                    transcript="[Transcription failed or skipped]" if error_occurred else "[Transcription handled internally by Gemini 2.5 Flash]",
                    analysis_model=analysis_model,
                )
                session.add(summary)
                await session.execute(
                    update(Reel).where(Reel.id == reel.id).values(is_analyzed=True)
                )
                await session.flush()
                await session.commit()
                logger.info("Reel %d analysis complete (model=%s) — summary stored", reel.id, analysis_model)

    except Exception:
        logger.exception("analyze_reel_task failed for reel_id=%s", reel_id)
    finally:
        await media_processor.close()
        await meta_api.close()
