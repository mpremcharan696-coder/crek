"""Users router — profile and settings management.

Provides endpoints for the authenticated creator to view and update their
profile settings (auto-reply toggle, reply tone, etc.).
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db
from app.schemas.user import UserProfile, UserSettingsUpdate
from app.services.auth_service import AuthService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/me",
    response_model=UserProfile,
    summary="Get user profile",
)
async def get_profile(
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> UserProfile:
    """Return the full profile of the authenticated user.

    Raises:
        HTTPException 404: If the user no longer exists.
    """
    auth_service = AuthService(db)
    profile = await auth_service.get_user_profile(user_id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return profile


@router.put(
    "/me/settings",
    response_model=UserProfile,
    summary="Update user settings",
)
async def update_settings(
    settings_update: UserSettingsUpdate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> UserProfile:
    """Update the authenticated user's settings.

    Supported fields in ``UserSettingsUpdate``:
    - ``auto_reply_enabled`` (bool) — whether AI replies are automatically
      posted or held for manual approval.  Defaults to False for new users.
    - ``reply_tone`` (str | None) — preferred reply tone/style
      (e.g. "friendly", "professional").
    - ``reply_language`` (str | None) — preferred reply language code.

    Raises:
        HTTPException 404: If the user doesn't exist.
    """
    auth_service = AuthService(db)

    # Verify user exists
    existing = await auth_service.get_user_profile(user_id)
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    updated_profile = await auth_service.update_user_settings(
        user_id=user_id,
        settings_data=settings_update,
    )

    # Invalidate Redis cache for user profile
    from app.core.cache import delete_cached
    await delete_cached(f"user:{user_id}:profile")

    logger.info(
        "Settings updated for user_id=%s: auto_reply=%s, tone=%s",
        user_id,
        settings_update.auto_reply_enabled,
        settings_update.reply_tone,
    )
    return updated_profile


@router.post(
    "/me/scan-voice-profile",
    summary="Scan user reels and profile to AI-generate voice profile",
)
async def scan_voice_profile(
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Analyze recent user reels and bio using Groq Qwen to generate default voice profile settings."""
    from sqlalchemy import select
    from app.models.user import User
    from app.models.reel import Reel
    from app.services.ai_agent_service import AIAgentService

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    reels_result = await db.execute(
        select(Reel)
        .where(Reel.user_id == user_id)
        .order_by(Reel.created_at.desc())
        .limit(10)
    )
    reels = list(reels_result.scalars().all())
    captions = [r.caption for r in reels if r.caption]

    ai_service = AIAgentService()
    profile_name = user.full_name or user.username or "Instagram Creator"
    generated_profile = await ai_service.analyze_voice_profile_from_content(
        profile_name=profile_name,
        bio=user.biography or "",
        captions=captions,
    )

    return generated_profile
