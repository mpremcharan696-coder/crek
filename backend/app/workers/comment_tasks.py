"""Background task for processing incoming Instagram comment webhook events.

Implements the core Pilotly pipeline:
    webhook → load context → AI decision → optional web search → generate reply
    → auto-post or queue for creator approval.

Includes exponential backoff to handle the race condition where a comment
arrives before its reel has been fully analysed.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from arq import Retry
from sqlalchemy import select, update

from app.core.config import settings
from app.core.security import decrypt_token
from app.models.user import User, UserToken
from app.models.reel import Reel, ReelSummary
from app.models.comment import Comment, CommentReply

logger = logging.getLogger(__name__)

# Exponential backoff delays (seconds) for when a reel summary isn't ready
_RETRY_DELAYS = [60, 120, 300]  # 1 min → 2 min → 5 min
_MAX_RETRIES = 3


async def process_comment_task(ctx: dict, comment_event: dict) -> None:
    """Process a single comment webhook event end-to-end.

    Args:
        ctx: ARQ context dict (contains ``redis``, ``db_session_factory``,
             ``job_try`` for retry tracking).
        comment_event: Parsed comment data from the webhook::

            {
                "comment_id": "<IG comment ID>",
                "text": "comment body",
                "media_id": "<IG media ID>",
                "commenter_id": "<IGSID or None>",
                "commenter_username": "<username or None>",
                "parent_id": "<parent comment ID or None>",
            }

    Flow:
        1. Find the reel by ``media_id``.
        2. If reel doesn't exist → enqueue reel analysis → ``Retry(defer=60)``.
        3. Load the reel's AI summary.
        4. If no summary → retry with exponential backoff (60s / 120s / 300s).
        5. After ``_MAX_RETRIES`` → log failure and bail.
        6. Store the incoming comment in the DB.
        7. Load creator preferences (style, tone, auto-reply flag).
        8. Generate AI reply via ``AIAgentService``.
        9. Store reply with status ``'pending'`` or ``'approved'`` depending
           on ``auto_reply_enabled``.
        10. If auto-reply is on → post immediately via Meta Graph API.
    """
    comment_id: str = comment_event.get("comment_id", "")
    comment_text: str = comment_event.get("text", "")
    media_id: str = comment_event.get("media_id", "")
    commenter_id: str | None = comment_event.get("commenter_id")
    commenter_username: str | None = comment_event.get("commenter_username")
    parent_id: str | None = comment_event.get("parent_id")

    if not comment_id or not media_id:
        logger.error("process_comment_task: missing comment_id or media_id: %s", comment_event)
        return

    # Current retry attempt (1-indexed by ARQ)
    job_try: int = ctx.get("job_try", 1)

    db_session_factory = ctx["db_session_factory"]

    from app.services.ai_agent_service import AIAgentService
    from app.services.meta_api_service import MetaAPIService

    async with db_session_factory() as session:
        # ------------------------------------------------------------ #
        #  1. Find the reel by Instagram media_id
        # ------------------------------------------------------------ #
        result = await session.execute(
            select(Reel).where(Reel.media_id == media_id)
        )
        reel = result.scalar_one_or_none()

        if reel is None:
            if ctx["job_try"] > _MAX_RETRIES:
                logger.error("Max retries exceeded for missing reel (media_id=%s)", media_id)
                return

            logger.info(
                "Reel with media_id=%s not found — enqueuing discovery + analysis",
                media_id,
            )
            # Enqueue reel analysis; it will fetch from Meta and create the record
            await ctx["redis"].enqueue_job("analyze_reel_task", media_id=media_id)
            # Retry this comment with backoff
            await session.commit()
            delay = _RETRY_DELAYS[min(ctx["job_try"] - 1, len(_RETRY_DELAYS) - 1)]
            raise Retry(defer=delay)

        # ------------------------------------------------------------ #
        #  2. Load the AI summary
        # ------------------------------------------------------------ #
        result = await session.execute(
            select(ReelSummary).where(ReelSummary.reel_id == reel.id)
        )
        summary = result.scalar_one_or_none()

        if summary is None:
            if ctx["job_try"] > _MAX_RETRIES:
                logger.error("Max retries exceeded waiting for summary of reel %d", reel.id)
                return

            logger.warning(
                "No summary found for reel %d, queuing analysis and delaying comment processing",
                reel.id,
            )
            await ctx["redis"].enqueue_job("analyze_reel_task", media_id=reel.media_id)
            await session.commit()
            delay = _RETRY_DELAYS[min(ctx["job_try"] - 1, len(_RETRY_DELAYS) - 1)]
            raise Retry(defer=delay)

        # ------------------------------------------------------------ #
        #  3. Ensure the comment is stored
        # ------------------------------------------------------------ #
        result = await session.execute(
            select(Comment).where(Comment.comment_id == comment_id)
        )
        existing_comment = result.scalar_one_or_none()

        if existing_comment is not None:
            if existing_comment.is_processed:
                logger.info(
                    "Comment %s already processed, skipping", comment_id
                )
                return
            db_comment = existing_comment
        else:
            db_comment = Comment(
                reel_id=reel.id,
                comment_id=comment_id,
                text=comment_text,
                commenter_id=commenter_id,
                commenter_username=commenter_username,
                parent_comment_id=parent_id,
            )
            session.add(db_comment)
            await session.flush()
            await session.refresh(db_comment)

        # ------------------------------------------------------------ #
        #  4. Load creator preferences
        # ------------------------------------------------------------ #
        result = await session.execute(
            select(User).where(User.id == reel.user_id)
        )
        creator = result.scalar_one_or_none()
        if creator is None:
            logger.error("Creator user_id=%d not found for reel %d", reel.user_id, reel.id)
            return

        # ------------------------------------------------------------ #
        #  4b. Skip auto-reply if commenter is the creator themselves
        # ------------------------------------------------------------ #
        is_self_comment = False
        if commenter_id and creator.instagram_user_id and str(commenter_id) == str(creator.instagram_user_id):
            is_self_comment = True
        elif commenter_username and creator.username and commenter_username.lower().strip() == creator.username.lower().strip():
            is_self_comment = True

        if is_self_comment:
            logger.info(
                "Comment %s is from creator @%s themselves — skipping auto-reply",
                comment_id,
                creator.username,
            )
            await session.execute(
                update(Comment).where(Comment.id == db_comment.id).values(is_processed=True)
            )
            await session.commit()
            return


        # ------------------------------------------------------------ #
        #  5. Generate AI reply
        # ------------------------------------------------------------ #
        ai_service = AIAgentService()

        reply_text = ""
        used_web_search = False
        reply_status = "pending"
        generation_failed = False

        try:
            reply_result = await ai_service.generate_reply(
                comment=comment_text,
                reel_summary=summary.ai_summary,
                creator_style=creator.reply_style or creator.reply_tone,
                creator_name=creator.username,
            )
            reply_text = reply_result.get("reply_text", "")
            used_web_search = reply_result.get("used_web_search", False)
            if not reply_text:
                reply_text = "reply gneration completed"
        except Exception as exc:
            logger.exception("AI reply generation failed for comment_id=%s", comment_id)
            generation_failed = True
            reply_text = f"Error: AI Reply Generation Failed: {str(exc)}"
            reply_status = "failed"

        # Determine status based on auto-reply setting if generation succeeded
        if not generation_failed:
            reply_status = "approved" if creator.auto_reply_enabled else "pending"

        reply = CommentReply(
            comment_id=db_comment.id,
            reply_text=reply_text,
            status=reply_status,
            used_web_search=used_web_search,
            ai_model="qwen/qwen3.6-27b",
        )
        session.add(reply)
        await session.flush()
        await session.refresh(reply)

        # ------------------------------------------------------------ #
        #  7. Auto-post if enabled and generation didn't fail
        # ------------------------------------------------------------ #
        if creator.auto_reply_enabled and not generation_failed:
            meta_api = MetaAPIService()
            try:
                result = await session.execute(
                    select(UserToken)
                    .where(UserToken.user_id == creator.id)
                    .order_by(UserToken.expires_at.desc())
                    .limit(1)
                )
                token_row = result.scalar_one_or_none()
                if token_row is None:
                    raise Exception("No token for user, cannot auto-post reply")

                access_token = decrypt_token(
                    token_row.encrypted_access_token,
                    settings.ENCRYPTION_KEY,
                )

                ig_reply_id = await meta_api.post_comment_reply(
                    comment_id=comment_id,  # Instagram comment ID
                    message=reply_text,
                    token=access_token,
                )

                await session.execute(
                    update(CommentReply)
                    .where(CommentReply.id == reply.id)
                    .values(
                        status="posted",
                        reply_ig_id=ig_reply_id,
                        posted_at=datetime.now(timezone.utc),
                    )
                )
                logger.info(
                    "Auto-replied to comment %s -> ig_reply_id=%s (web_search=%s)",
                    comment_id,
                    ig_reply_id,
                    used_web_search,
                )
            except Exception as post_exc:
                logger.exception("Failed to auto-post reply for comment_id=%s", comment_id)
                failed_text = f"Error: Instagram Post Failed: {str(post_exc)}\n{reply_text}"
                await session.execute(
                    update(CommentReply)
                    .where(CommentReply.id == reply.id)
                    .values(
                        status="failed",
                        reply_text=failed_text,
                    )
                )
            finally:
                await meta_api.close()
        else:
            if generation_failed:
                logger.info("Reply queued as 'failed' (generation failed) for comment_id=%s", comment_id)
            else:
                logger.info("Reply queued as 'pending' for creator approval (comment_id=%s)", comment_id)

        # Mark comment as processed only if generation succeeded.
        # If generation failed, keep is_processed = False so it remains in the active pending queue!
        is_processed_val = not generation_failed
        await session.execute(
            update(Comment).where(Comment.id == db_comment.id).values(is_processed=is_processed_val)
        )
        await session.commit()


async def sync_reel_comments_task(ctx: dict, reel_id: int, user_id: int) -> None:
    """Fetch comments for a reel and insert new ones into the DB.
    
    Filters to only process comments created after the user connected their account.
    """
    db_session_factory = ctx["db_session_factory"]
    
    from app.services.meta_api_service import MetaAPIService
    from datetime import datetime

    async with db_session_factory() as session:
        # Fetch user connection details
        result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        if not user:
            logger.error("sync_reel_comments_task: User %s not found", user_id)
            return

        connection_time = user.created_at

        result = await session.execute(
            select(Reel).where(Reel.id == reel_id, Reel.user_id == user_id)
        )
        reel = result.scalar_one_or_none()
        if not reel:
            logger.error("sync_reel_comments_task: Reel %s not found", reel_id)
            return

        result = await session.execute(
            select(UserToken)
            .where(UserToken.user_id == reel.user_id)
            .order_by(UserToken.expires_at.desc())
            .limit(1)
        )
        token_row = result.scalar_one_or_none()
        if not token_row:
            logger.error("sync_reel_comments_task: No token for user %s", reel.user_id)
            return

        access_token = decrypt_token(
            token_row.encrypted_access_token,
            settings.ENCRYPTION_KEY,
        )

        meta_api = MetaAPIService()
        try:
            logger.info("Fetching comments for reel %s (media_id=%s)", reel_id, reel.media_id)
            comments_data = await meta_api.fetch_comments(reel.media_id, access_token)
            
            new_comments = 0
            new_comment_events = []
            for c in comments_data:
                c_id = c.get("id")
                c_from_id = c.get("from", {}).get("id")
                c_from_uname = c.get("from", {}).get("username")

                # Filter out comments older than connection timestamp
                c_ts = c.get("timestamp")
                if c_ts:
                    try:
                        comment_time = datetime.fromisoformat(c_ts.replace("+0000", "+00:00"))
                        if comment_time < connection_time:
                            # Skip this comment and all its replies since they are older
                            continue
                    except Exception:
                        pass

                # Add root comment
                result = await session.execute(
                    select(Comment).where(Comment.comment_id == c_id)
                )
                existing = result.scalar_one_or_none()
                if not existing:
                    is_self = (
                        (c_from_id and user.instagram_user_id and str(c_from_id) == str(user.instagram_user_id)) or
                        (c_from_uname and user.username and c_from_uname.lower().strip() == user.username.lower().strip())
                    )
                    comment = Comment(
                        reel_id=reel.id,
                        comment_id=c_id,
                        text=c.get("text", ""),
                        commenter_id=c_from_id,
                        commenter_username=c_from_uname,
                        is_processed=is_self,  # Mark processed if self-comment so no AI reply generates
                    )
                    session.add(comment)
                    if not is_self:
                        new_comment_events.append({
                            "comment_id": c_id,
                            "text": c.get("text", ""),
                            "media_id": reel.media_id,
                            "commenter_id": c_from_id,
                            "commenter_username": c_from_uname,
                            "parent_id": None,
                        })
                    new_comments += 1
                
                # Add replies if any
                replies = c.get("replies", {}).get("data", [])
                for r in replies:
                    r_id = r.get("id")
                    r_from_id = r.get("from", {}).get("id")
                    r_from_uname = r.get("from", {}).get("username")

                    # Filter out replies older than connection timestamp
                    r_ts = r.get("timestamp")
                    if r_ts:
                        try:
                            reply_time = datetime.fromisoformat(r_ts.replace("+0000", "+00:00"))
                            if reply_time < connection_time:
                                continue
                        except Exception:
                            pass

                    result = await session.execute(
                        select(Comment).where(Comment.comment_id == r_id)
                    )
                    existing_reply = result.scalar_one_or_none()
                    if not existing_reply:
                        is_self_r = (
                            (r_from_id and user.instagram_user_id and str(r_from_id) == str(user.instagram_user_id)) or
                            (r_from_uname and user.username and r_from_uname.lower().strip() == user.username.lower().strip())
                        )
                        reply_comment = Comment(
                            reel_id=reel.id,
                            comment_id=r_id,
                            text=r.get("text", ""),
                            commenter_id=r_from_id,
                            commenter_username=r_from_uname,
                            parent_comment_id=c_id,
                            is_processed=is_self_r,
                        )
                        session.add(reply_comment)
                        if not is_self_r:
                            new_comment_events.append({
                                "comment_id": r_id,
                                "text": r.get("text", ""),
                                "media_id": reel.media_id,
                                "commenter_id": r_from_id,
                                "commenter_username": r_from_uname,
                                "parent_id": c_id,
                            })
                        new_comments += 1

            
            await session.commit()

            # Enqueue AI processing for each newly synced comment
            for evt in new_comment_events:
                await ctx["redis"].enqueue_job("process_comment_task", evt)

            logger.info("Synced %s new comments for reel %s, enqueued %s for processing", new_comments, reel_id, len(new_comment_events))
            
        except Exception:
            logger.exception("Failed to sync comments for reel %s", reel_id)
        finally:
            await meta_api.close()


async def sync_all_comments_task(ctx: dict) -> None:
    """Iterate over all active users and enqueue comment syncs for their 2 newest reels.
    
    This acts as a cron fallback for when webhooks are disabled, while staying 
    well within the 200 API calls/hour limit.
    """
    db_session_factory = ctx["db_session_factory"]

    try:
        async with db_session_factory() as session:
            # 1. Get all active users
            stmt_users = select(User.id).where(User.is_active.is_(True))
            result_users = await session.execute(stmt_users)
            user_ids = result_users.scalars().all()
            
            reels_to_sync = []
            
            # 2. For each user, get their 2 newest reels
            for uid in user_ids:
                stmt_reels = (
                    select(Reel.id)
                    .where(Reel.user_id == uid)
                    .order_by(Reel.published_at.desc())
                    .limit(2)
                )
                result_reels = await session.execute(stmt_reels)
                for rid in result_reels.scalars().all():
                    reels_to_sync.append((rid, uid))

            logger.info("sync_all_comments_task: enqueuing comment sync for %d reels (2 newest per user)", len(reels_to_sync))

            for rid, uid in reels_to_sync:
                await ctx["redis"].enqueue_job("sync_reel_comments_task", reel_id=rid, user_id=uid)

    except Exception:
        logger.exception("Failed to enqueue sync_all_comments_task jobs")
