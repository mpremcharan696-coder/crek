"""Comment business logic service.

Handles incoming comment storage, retrieval with multi-tenant isolation,
and reply lifecycle management (approve / reject / post to Instagram).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.security import decrypt_token
from app.models.comment import Comment, CommentReply
from app.models.reel import Reel, ReelSummary
from app.models.user import User, UserToken
from app.services.ai_agent_service import AIAgentService
from app.services.meta_api_service import MetaAPIService
from app.services.webhook_service import CommentWebhookEvent

logger = logging.getLogger(__name__)


class CommentServiceError(Exception):
    """Base exception for comment service errors."""


class CommentNotFoundError(CommentServiceError):
    """Raised when a comment or reply cannot be found."""


class ReplyPostError(CommentServiceError):
    """Raised when posting a reply to Instagram fails."""


class CommentService:
    """Business logic layer for comments and replies.

    Provides methods for:
    - Storing incoming webhook comments.
    - Retrieving comments with multi-tenant filtering.
    - Approving pending replies (posting to Instagram).
    - Rejecting pending replies.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ------------------------------------------------------------------
    # Incoming Comment Processing
    # ------------------------------------------------------------------

    async def process_incoming_comment(self, event: CommentWebhookEvent) -> Comment:
        """Store an incoming comment from a webhook event.

        Resolves the internal user and reel IDs from the webhook event's
        Instagram identifiers, then upserts the comment.

        Args:
            event: Parsed webhook comment event.

        Returns:
            The created or updated :class:`Comment` model instance.

        Raises:
            CommentServiceError: If the user or reel cannot be resolved.
        """
        # Resolve user by IG account ID
        result = await self.session.execute(
            select(User).where(User.instagram_user_id == event.ig_account_id)
        )
        user = result.scalar_one_or_none()
        if user is None:
            raise CommentServiceError(
                f"No user found for IG account {event.ig_account_id}"
            )

        # Resolve reel by IG media ID
        result = await self.session.execute(
            select(Reel).where(Reel.media_id == event.media_id, Reel.user_id == user.id)
        )
        reel = result.scalar_one_or_none()
        if reel is None:
            logger.warning(
                "No reel found for media %s (user_id=%s). Creating placeholder.",
                event.media_id,
                user.id,
            )
            # Create a placeholder reel so the comment can be stored
            reel = Reel(
                user_id=user.id,
                media_id=event.media_id,
            )
            self.session.add(reel)
            await self.session.flush()
            await self.session.refresh(reel)

        # Check for existing comment (idempotency)
        result = await self.session.execute(
            select(Comment).where(Comment.comment_id == event.comment_id)
        )
        existing = result.scalar_one_or_none()
        if existing is not None:
            logger.info(
                "Comment %s already exists (id=%s), skipping",
                event.comment_id,
                existing.id,
            )
            return existing

        # Create the comment
        comment = Comment(
            reel_id=reel.id,
            comment_id=event.comment_id,
            text=event.text,
            commenter_id=event.from_id,
            commenter_username=event.from_username,
        )
        self.session.add(comment)
        await self.session.flush()
        await self.session.refresh(comment)
        await self.session.commit()

        logger.info(
            "Stored comment id=%s (ig=%s) on reel_id=%s for user_id=%s",
            comment.id,
            event.comment_id,
            reel.id,
            user.id,
        )
        return comment

    # ------------------------------------------------------------------
    # Comment Retrieval
    # ------------------------------------------------------------------

    async def get_comments_for_reel(
        self,
        reel_id: int,
        user_id: int,
        skip: int = 0,
        limit: int = 50,
    ) -> list[Comment]:
        """Get comments for a specific reel with multi-tenant isolation.

        Args:
            reel_id: Internal reel ID.
            user_id: Authenticated user's internal ID.
            skip: Number of records to skip (pagination offset).
            limit: Maximum number of records to return.

        Returns:
            List of :class:`Comment` instances.

        Raises:
            CommentNotFoundError: If the reel does not belong to the user.
        """
        # Verify reel ownership
        result = await self.session.execute(
            select(Reel).options(selectinload(Reel.summary))
            .where(Reel.id == reel_id, Reel.user_id == user_id)
        )
        reel = result.scalar_one_or_none()
        if reel is None:
            raise CommentNotFoundError(
                f"Reel {reel_id} not found for user {user_id}"
            )

        result = await self.session.execute(
            select(Comment)
            .join(Reel, Comment.reel_id == Reel.id)
            .options(selectinload(Comment.replies))
            .where(Reel.id == reel_id, Reel.user_id == user_id)
            .order_by(Comment.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_all_comments(
        self,
        user_id: int,
        status: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> list[Comment]:
        """Get all comments across reels for a user.

        Args:
            user_id: Authenticated user's internal ID.
            status: Optional filter by reply status (e.g. ``pending``, ``approved``).
            skip: Pagination offset.
            limit: Maximum results.

        Returns:
            List of :class:`Comment` instances.
        """
        query = (
            select(Comment)
            .join(Reel, Comment.reel_id == Reel.id)
            .options(selectinload(Comment.replies))
            .where(Reel.user_id == user_id)
        )
        if status:
            query = query.join(
                CommentReply, Comment.id == CommentReply.comment_id
            ).where(CommentReply.status == status)
        query = query.order_by(Comment.created_at.desc()).offset(skip).limit(limit)

        result = await self.session.execute(query)
        return list(result.unique().scalars().all())

    # ------------------------------------------------------------------
    # Reply Lifecycle
    # ------------------------------------------------------------------

    async def get_comment(self, comment_id: int, user_id: int) -> Comment | None:
        """Fetch a single comment by ID with ownership check."""
        result = await self.session.execute(
            select(Comment)
            .join(Reel, Comment.reel_id == Reel.id)
            .options(selectinload(Comment.replies))
            .where(Comment.id == comment_id, Reel.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_reply_for_comment(self, comment_id: int) -> CommentReply | None:
        """Fetch the reply for a specific comment."""
        result = await self.session.execute(
            select(CommentReply).where(CommentReply.comment_id == comment_id)
        )
        return result.scalar_one_or_none()

    async def generate_ai_reply(self, comment_id: int, user_id: int) -> CommentReply:
        """Generate an AI reply draft for a comment and store it as pending."""
        comment = await self.get_comment(comment_id, user_id)
        if comment is None:
            raise CommentNotFoundError(f"Comment {comment_id} not found")

        result = await self.session.execute(
            select(Reel).options(selectinload(Reel.summary))
            .where(Reel.id == comment.reel_id, Reel.user_id == user_id)
        )
        reel = result.scalar_one_or_none()
        if reel is None or reel.summary is None or not reel.summary.ai_summary:
            raise ValueError("Reel has not been analyzed yet")

        result = await self.session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        if user is None:
            raise CommentServiceError(f"User {user_id} not found")

        ai_agent = AIAgentService()
        ai_result = await ai_agent.generate_reply(
            comment=comment.text,
            reel_summary=reel.summary.ai_summary,
            creator_style=user.reply_style,
            creator_name=user.full_name or user.username,
        )

        reply = CommentReply(
            comment_id=comment_id,
            reply_text=ai_result["reply_text"],
            status="pending",
            used_web_search=ai_result["used_web_search"],
            ai_model="qwen/qwen3.6-27b",
        )
        self.session.add(reply)
        await self.session.flush()
        await self.session.refresh(reply)
        await self.session.commit()
        return reply

    # ------------------------------------------------------------------
    # Approve / Reject
    # ------------------------------------------------------------------

    async def approve_and_post_reply(
        self, comment_id: int, user_id: int, reply_text: str | None = None
    ) -> CommentReply:
        """Approve a pending/failed reply and post it to Instagram (with optional edit).

        Steps:
        1. Fetch the reply and verify ownership.
        2. Validate the reply is in a valid state (pending or failed).
        3. Save custom reply text if provided.
        4. Retrieve and decrypt the user's Meta access token.
        5. Post the reply to Instagram via the Meta Graph API.
        6. Update status to 'posted' or handle failures.

        Args:
            comment_id: Parent comment ID.
            user_id: Authenticated user's internal ID.
            reply_text: Optional custom edited reply text.

        Returns:
            Updated :class:`CommentReply` instance.
        """
        # Fetch reply with ownership check
        result = await self.session.execute(
            select(CommentReply)
            .join(Comment, CommentReply.comment_id == Comment.id)
            .join(Reel, Comment.reel_id == Reel.id)
            .where(CommentReply.comment_id == comment_id, Reel.user_id == user_id)
        )
        reply = result.scalar_one_or_none()
        if reply is None:
            raise CommentNotFoundError(
                f"Reply for comment {comment_id} not found for user {user_id}"
            )

        if reply.status not in ("pending", "failed"):
            raise CommentServiceError(
                f"Reply {reply.id} is not in a modifiable state (status={reply.status})"
            )

        # Update reply text in database if edited by the user
        if reply_text is not None:
            # Strip previous error messages if any before updating
            import re
            cleaned_text = re.sub(r"^Error:.*?\n", "", reply_text).strip()
            reply.reply_text = cleaned_text
            await self.session.flush()

        # Get the comment to find the IG comment ID
        comment = await self.get_comment(comment_id, user_id)
        if comment is None:
            raise CommentNotFoundError(
                f"Parent comment {comment_id} not found"
            )

        # Decrypt user's Meta token
        result = await self.session.execute(
            select(UserToken)
            .where(UserToken.user_id == user_id)
            .order_by(UserToken.expires_at.desc())
            .limit(1)
        )
        user_token = result.scalar_one_or_none()
        if user_token is None:
            raise CommentServiceError(
                f"No Meta token found for user {user_id}"
            )
        access_token = decrypt_token(
            user_token.encrypted_access_token,
            settings.ENCRYPTION_KEY,
        )

        # Post to Instagram
        meta_api = MetaAPIService()
        try:
            ig_reply_id = await meta_api.post_comment_reply(
                comment_id=comment.comment_id,
                message=reply.reply_text,
                token=access_token,
            )
            
            # Update reply status to posted
            await self.session.execute(
                update(CommentReply)
                .where(CommentReply.id == reply.id)
                .values(
                    status="posted",
                    reply_ig_id=ig_reply_id,
                    posted_at=datetime.now(timezone.utc),
                )
            )
            await self.session.flush()
            await self.session.commit()
            
            # Refresh to get updated values
            result = await self.session.execute(
                select(CommentReply).where(CommentReply.id == reply.id)
            )
            updated_reply = result.scalar_one_or_none()
            
            logger.info(
                "Approved and posted reply id=%s (ig_reply_id=%s) for comment %s",
                reply.id,
                ig_reply_id,
                comment.comment_id,
            )
            return updated_reply

        except Exception as exc:
            logger.error(
                "Failed to post reply %s to Instagram: %s",
                reply.id,
                exc,
                exc_info=True,
            )
            # Store the error details directly inside reply_text without emojis
            error_reason = str(exc)
            import re
            clean_reply = re.sub(r"^Error:.*?\n", "", reply.reply_text).strip()
            failed_text = f"Error: Instagram Post Failed: {error_reason}\n{clean_reply}"
            
            await self.session.execute(
                update(CommentReply)
                .where(CommentReply.id == reply.id)
                .values(
                    status="failed",
                    reply_text=failed_text,
                )
            )
            await self.session.flush()
            await self.session.commit()
            
            # Refresh and return
            result = await self.session.execute(
                select(CommentReply).where(CommentReply.id == reply.id)
            )
            return result.scalar_one_or_none()
        finally:
            await meta_api.close()

    async def reject_reply(self, comment_id: int, user_id: int) -> CommentReply:
        """Reject a pending reply.

        Updates the reply status to ``rejected``. The reply will not be posted
        to Instagram.

        Args:
            comment_id: Parent comment ID.
            user_id: Authenticated user's internal ID.

        Returns:
            Updated :class:`CommentReply` instance.

        Raises:
            CommentNotFoundError: If the reply doesn't exist or doesn't belong to the user.
            CommentServiceError: If the reply is not in ``pending`` status.
        """
        result = await self.session.execute(
            select(CommentReply)
            .join(Comment, CommentReply.comment_id == Comment.id)
            .join(Reel, Comment.reel_id == Reel.id)
            .where(CommentReply.comment_id == comment_id, Reel.user_id == user_id)
        )
        reply = result.scalar_one_or_none()
        if reply is None:
            raise CommentNotFoundError(
                f"Reply for comment {comment_id} not found for user {user_id}"
            )

        if reply.status != "pending":
            raise CommentServiceError(
                f"Reply {reply.id} is not pending (status={reply.status})"
            )

        await self.session.execute(
            update(CommentReply)
            .where(CommentReply.id == reply.id)
            .values(status="rejected")
        )
        await self.session.flush()
        await self.session.commit()

        # Refresh
        result = await self.session.execute(
            select(CommentReply).where(CommentReply.id == reply.id)
        )
        updated_reply = result.scalar_one_or_none()

        logger.info("Rejected reply id=%s for user_id=%s", reply.id, user_id)
        return updated_reply
