"""Comments router — list, generate AI reply, approve, reject.

All endpoints are scoped to the authenticated user.  AI reply generation
stores the result as ``pending`` by default.  The creator must explicitly
approve before the reply is posted to Instagram.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db
from app.schemas.comment import CommentResponse, CommentReplyResponse as ReplyResponse, ApproveReplyRequest
from app.services.comment_service import CommentService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/",
    response_model=list[CommentResponse],
    summary="List comments",
)
async def list_comments(
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    status_filter: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> list[CommentResponse]:
    """Return comments for the authenticated creator, optionally filtered by status.

    Args:
        status_filter: Optional filter — ``"pending"``, ``"replied"``, ``"no_reply"``, etc.
        skip: Offset for pagination.
        limit: Max records (capped at 100).
    """
    limit = min(limit, 100)
    comment_service = CommentService(db)
    comments = await comment_service.get_all_comments(
        user_id=user_id,
        status=status_filter,
        skip=skip,
        limit=limit,
    )
    return comments


@router.post(
    "/{comment_id}/reply",
    response_model=ReplyResponse,
    summary="Generate AI reply",
)
async def generate_reply(
    comment_id: int,
    auto_post: bool = False,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ReplyResponse:
    """Generate an AI reply for a comment.

    By default, stores it as ``pending``. If ``auto_post=True``, immediately
    posts it to Instagram.

    Raises:
        HTTPException 404: If the comment doesn't exist or doesn't belong to user.
        HTTPException 409: If a reply already exists for this comment.
        HTTPException 422: If the reel hasn't been analyzed yet (no summary).
    """
    comment_service = CommentService(db)

    # Verify comment ownership
    comment = await comment_service.get_comment(comment_id=comment_id, user_id=user_id)
    if comment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Comment {comment_id} not found",
        )

    # Check for existing reply
    existing_reply = await comment_service.get_reply_for_comment(comment_id=comment_id)
    if existing_reply is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A reply already exists for this comment",
        )

    try:
        reply = await comment_service.generate_ai_reply(
            comment_id=comment_id,
            user_id=user_id,
        )
    except ValueError as exc:
        logger.warning("Cannot generate reply for comment_id=%s: %s", comment_id, exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )

    if auto_post:
        from datetime import datetime, timezone
        from sqlalchemy import select, update
        from app.models.user import UserToken
        from app.models.comment import CommentReply
        from app.services.meta_api_service import MetaAPIService
        from app.core.config import settings
        from app.core.security import decrypt_token

        result = await db.execute(
            select(UserToken)
            .where(UserToken.user_id == user_id)
            .order_by(UserToken.expires_at.desc())
            .limit(1)
        )
        token_row = result.scalar_one_or_none()
        if token_row is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User has no linked Instagram token",
            )
        
        access_token = decrypt_token(
            token_row.encrypted_access_token,
            settings.ENCRYPTION_KEY,
        )

        meta_api = MetaAPIService()
        try:
            ig_reply_id = await meta_api.post_comment_reply(
                comment_id=comment.comment_id,
                message=reply.reply_text,
                token=access_token,
            )
            await db.execute(
                update(CommentReply)
                .where(CommentReply.id == reply.id)
                .values(
                    status="posted",
                    reply_ig_id=ig_reply_id,
                    posted_at=datetime.now(timezone.utc),
                )
            )
            await db.commit()
            
            # Refresh reply object
            reply = await comment_service.get_reply_for_comment(comment_id=comment_id)
            logger.info("AI reply generated and auto-posted for comment_id=%s", comment_id)
        except Exception as e:
            logger.exception("Failed to auto-post reply")
            await db.execute(
                update(CommentReply)
                .where(CommentReply.id == reply.id)
                .values(status="failed")
            )
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to post reply to Instagram: {str(e)}"
            )
        finally:
            await meta_api.close()
    else:
        logger.info("AI reply generated for comment_id=%s, status=pending", comment_id)
        
    return reply


@router.post(
    "/{comment_id}/approve",
    response_model=ReplyResponse,
    summary="Approve and post reply",
)
async def approve_reply(
    comment_id: int,
    request: Request,
    body: ApproveReplyRequest | None = None,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ReplyResponse:
    """Approve a pending AI reply and post it to Instagram (with optional edits).

    Steps:
    1. Verify the comment and reply belong to the user.
    2. Mark the reply status as ``approved``, updating text if edited.
    3. Post the reply text via the Meta Graph API.
    4. Update the reply status to ``posted``.

    Raises:
        HTTPException 404: If the comment or pending reply is not found.
        HTTPException 409: If the reply is not in ``pending`` or ``failed`` status.
        HTTPException 502: If posting to Instagram fails.
    """
    comment_service = CommentService(db)

    comment = await comment_service.get_comment(comment_id=comment_id, user_id=user_id)
    if comment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Comment {comment_id} not found",
        )

    reply = await comment_service.get_reply_for_comment(comment_id=comment_id)
    if reply is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No reply found for this comment",
        )

    if reply.status not in ("pending", "failed"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Reply is already in '{reply.status}' status, cannot approve",
        )

    reply_text = body.reply_text if body else None

    try:
        updated_reply = await comment_service.approve_and_post_reply(
            comment_id=comment_id,
            user_id=user_id,
            reply_text=reply_text,
        )
    except Exception as exc:
        logger.exception("Failed to post reply for comment_id=%s", comment_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to post reply to Instagram: {exc}",
        )

    logger.info("Reply approved and posted for comment_id=%s", comment_id)
    return updated_reply


@router.post(
    "/{comment_id}/reject",
    response_model=ReplyResponse,
    summary="Reject a pending reply",
)
async def reject_reply(
    comment_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ReplyResponse:
    """Reject a pending AI reply.

    The reply status is updated to ``rejected``.  The creator can later
    regenerate a new reply if desired.

    Raises:
        HTTPException 404: If the comment or pending reply is not found.
        HTTPException 409: If the reply is not in ``pending`` status.
    """
    comment_service = CommentService(db)

    comment = await comment_service.get_comment(comment_id=comment_id, user_id=user_id)
    if comment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Comment {comment_id} not found",
        )

    reply = await comment_service.get_reply_for_comment(comment_id=comment_id)
    if reply is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No reply found for this comment",
        )

    if reply.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Reply is already in '{reply.status}' status, cannot reject",
        )

    updated_reply = await comment_service.reject_reply(
        comment_id=comment_id,
        user_id=user_id,
    )

    logger.info("Reply rejected for comment_id=%s", comment_id)
    return updated_reply
