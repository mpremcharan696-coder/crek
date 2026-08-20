"""Reels router — list, detail, comments, sync, and analysis endpoints.

All endpoints are scoped to the authenticated user via ``get_current_user_id``.
Heavy operations (sync from Meta, AI analysis) are delegated to service/worker
layers to keep request latency low.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db
from app.schemas.reel import ReelResponse, ReelDetailResponse
from app.schemas.comment import CommentResponse
from app.services.reel_service import ReelService
from app.services.meta_api_service import MetaAPIService
from app.services.comment_service import CommentService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/",
    response_model=list[ReelResponse],
    summary="List reels",
)
async def list_reels(
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 50,
) -> list[ReelResponse]:
    """Return a paginated list of the creator's reels.

    Args:
        skip: Number of records to skip (offset).
        limit: Maximum number of records to return (capped at 100).
    """
    limit = min(limit, 100)  # hard cap to prevent abuse
    reel_service = ReelService(db)
    reels = await reel_service.get_reels(user_id=user_id, skip=skip, limit=limit)
    return reels


@router.get(
    "/{reel_id}",
    response_model=ReelDetailResponse,
    summary="Get reel detail",
)
async def get_reel(
    reel_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ReelDetailResponse:
    """Return full details for a single reel, including its AI summary.

    Raises:
        HTTPException 404: If the reel doesn't exist or doesn't belong to the user.
    """
    reel_service = ReelService(db)
    reel = await reel_service.get_reel_detail(reel_id=reel_id, user_id=user_id)
    if reel is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Reel {reel_id} not found",
        )
    return reel


@router.get(
    "/{reel_id}/comments",
    response_model=list[CommentResponse],
    summary="Get reel comments",
)
async def get_reel_comments(
    reel_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[CommentResponse]:
    """Return all comments for a specific reel.

    Raises:
        HTTPException 404: If the reel doesn't exist or doesn't belong to the user.
    """
    reel_service = ReelService(db)

    # Verify the reel belongs to this user first
    reel = await reel_service.get_reel_detail(reel_id=reel_id, user_id=user_id)
    if reel is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Reel {reel_id} not found",
        )

    comment_service = CommentService(db)
    comments = await comment_service.get_comments_for_reel(reel_id=reel_id, user_id=user_id)
    return comments


@router.post(
    "/{reel_id}/comments/sync",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Sync reel comments",
)
async def sync_reel_comments(
    reel_id: int,
    request: Request,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Trigger a manual sync of comments for a specific reel."""
    reel_service = ReelService(db)

    # Verify the reel belongs to this user first
    reel = await reel_service.get_reel_detail(reel_id=reel_id, user_id=user_id)
    if reel is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Reel {reel_id} not found",
        )

    try:
        await request.app.state.arq_pool.enqueue_job(
            "sync_reel_comments_task",
            reel_id=reel_id,
        )
    except Exception:
        logger.exception("Failed to enqueue sync_reel_comments_task for reel_id=%s", reel_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start comment sync",
        )

    logger.info("Comment sync enqueued for reel_id=%s", reel_id)
    return {"status": "sync_started", "message": "Comment sync has been queued"}


from pydantic import BaseModel
import re

class ImportReelRequest(BaseModel):
    media_id: str | None = None
    url: str | None = None


@router.post(
    "/sync",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Sync reels from Instagram",
)
async def sync_reels(
    request: Request,
    limit: int | None = 5,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Trigger a manual reel sync from the Meta Graph API.

    This enqueues a background task to fetch reels for the user and
    returns immediately with a 202 Accepted.

    Args:
        limit: Max number of reels to sync (defaults to 5). Set to null or large value to sync all.
    """
    try:
        await request.app.state.arq_pool.enqueue_job(
            "sync_user_reels_task",
            user_id=user_id,
            limit=limit,
        )
    except Exception:
        logger.exception("Failed to enqueue sync_user_reels_task for user_id=%s", user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start reel sync",
        )

    logger.info("Reel sync enqueued for user_id=%s (limit=%s)", user_id, limit)
    return {"status": "sync_started", "message": "Reel sync has been queued"}


@router.post(
    "/import",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Import a specific reel by media ID or URL",
)
async def import_reel(
    body: ImportReelRequest,
    request: Request,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Import a specific reel from Meta by its Instagram media ID or URL.

    Fetches the details of the reel, stores it in the database (or updates it if
    it already exists), and enqueues it for analysis.
    """
    from sqlalchemy import select
    from app.core.security import decrypt_token
    from app.core.config import settings
    from app.models.user import UserToken
    from app.models.reel import Reel
    from datetime import datetime

    # 1. Fetch token from DB
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
            detail="No Instagram connection found for this user",
        )

    access_token = decrypt_token(token_row.encrypted_access_token, settings.ENCRYPTION_KEY)

    # 2. Resolve media_id if URL is provided
    media_id = body.media_id
    if not media_id and body.url:
        match = re.search(r"/(?:reel|p)/([A-Za-z0-9-_]+)", body.url)
        if not match:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Instagram Reel URL structure",
            )
        shortcode = match.group(1)

        from app.models.user import User
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        meta_api = MetaAPIService()
        try:
            media_items = await meta_api.fetch_user_media(user.instagram_user_id, access_token)
            for item in media_items:
                permalink = item.get("permalink", "")
                if shortcode in permalink:
                    media_id = item.get("id")
                    break
        except Exception as e:
            logger.exception("Failed to scan media for shortcode=%s", shortcode)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to scan Instagram profile for shortcode: {e}",
            )
        finally:
            await meta_api.close()

        if not media_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Could not find Reel with URL/shortcode '{shortcode}' in your Instagram account",
            )

    if not media_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either media_id or url must be provided",
        )

    # 3. Check if already exists in the database
    result = await db.execute(
        select(Reel).where(Reel.media_id == media_id)
    )
    existing = result.scalar_one_or_none()

    # 4. Fetch media details from Meta Graph API
    meta_api = MetaAPIService()
    try:
        item = await meta_api.fetch_media_details(media_id, access_token)
    except Exception as e:
        logger.exception("Failed to fetch media details for media_id=%s", media_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch media from Instagram: {e}",
        )
    finally:
        await meta_api.close()

    if item.get("media_product_type") != "REELS":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The specified media ID does not point to a Reel",
        )

    # 5. Save/Update in DB
    published_at = None
    ts = item.get("timestamp")
    if ts:
        try:
            published_at = datetime.fromisoformat(ts.replace("+0000", "+00:00"))
        except (ValueError, AttributeError):
            pass

    if existing:
        # Update existing record fields
        existing.caption = item.get("caption")
        existing.media_url = item.get("media_url")
        existing.thumbnail_url = item.get("thumbnail_url")
        existing.permalink = item.get("permalink")
        existing.like_count = item.get("like_count", 0)
        existing.comments_count = item.get("comments_count", 0)
        existing.published_at = published_at
        existing.is_analyzed = False  # Reset analysis status to force re-analysis if desired
        db.add(existing)
        reel_id_to_analyze = existing.id
        status_msg = "Reel details updated and analysis re-enqueued"
    else:
        # Create a new record
        new_reel = Reel(
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
        db.add(new_reel)
        await db.flush()
        await db.refresh(new_reel)
        reel_id_to_analyze = new_reel.id
        status_msg = "Reel imported and analysis enqueued"

    await db.commit()

    # 6. Enqueue analysis
    await request.app.state.arq_pool.enqueue_job("analyze_reel_task", reel_id=reel_id_to_analyze)

    return {
        "status": "imported",
        "reel_id": str(reel_id_to_analyze),
        "message": status_msg,
    }



@router.post(
    "/{reel_id}/analyze",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Analyze a reel with AI",
)
async def analyze_reel(
    reel_id: int,
    request: Request,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Trigger AI analysis for a specific reel.

    Downloads the video, extracts keyframes & audio, transcribes, and
    generates a summary via the AI agent.  Processing happens in the
    background; poll the reel detail endpoint for the result.

    Raises:
        HTTPException 404: If the reel doesn't exist or doesn't belong to the user.
        HTTPException 500: If enqueuing the background task fails.
    """
    reel_service = ReelService(db)
    reel = await reel_service.get_reel_detail(reel_id=reel_id, user_id=user_id)
    if reel is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Reel {reel_id} not found",
        )

    try:
        await request.app.state.arq_pool.enqueue_job(
            "analyze_reel_task",
            reel_id=reel_id,
        )
    except Exception:
        logger.exception("Failed to enqueue analyze_reel_task for reel_id=%s", reel_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start reel analysis",
        )

    logger.info("Reel analysis enqueued for reel_id=%s", reel_id)
    return {"status": "analysis_started", "message": "Reel analysis has been queued"}
