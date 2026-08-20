"""Authentication router — Meta OAuth login, callback, token refresh.

Includes a ``/setup-test`` endpoint for development/testing that seeds a user
directly from the ``META_ACCESS_TOKEN`` env var, bypassing OAuth entirely.
The OAuth endpoints (``/login``, ``/callback``) are kept intact but will
return 503 if OAuth is not configured.

Flow (Production):
    1. ``GET /login`` → redirect to Meta OAuth consent screen
    2. ``GET /callback?code=...`` → exchange code, upsert user, return JWT
    3. ``GET /me`` → return current user profile from JWT
    4. ``POST /refresh`` → manually refresh Meta access token

Flow (Testing):
    1. ``POST /setup-test`` → seed user from META_ACCESS_TOKEN env var
    2. ``GET /me`` → return current user profile from JWT
"""

import logging
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db
from app.core.config import settings
from app.core.security import create_jwt, encrypt_token
from app.models.user import User, UserToken
from app.services.auth_service import AuthService
from app.schemas.auth import TokenResponse

logger = logging.getLogger(__name__)

router = APIRouter()

# --------------------------------------------------------------------------- #
#  Meta OAuth URLs
# --------------------------------------------------------------------------- #
META_AUTH_BASE = "https://www.facebook.com/v21.0/dialog/oauth"

# Permissions required for Instagram comment management
SCOPES = [
    "instagram_basic",
    "instagram_manage_comments",
    "pages_show_list",
    "pages_read_engagement",
]


def _is_oauth_configured() -> bool:
    """Check if Meta OAuth credentials are configured."""
    return bool(settings.META_APP_ID and settings.META_APP_SECRET)


# =========================================================================== #
#  TEST MODE — Direct token setup (no OAuth needed)
# =========================================================================== #

@router.post("/setup-test", response_model=TokenResponse, summary="Seed test user (no OAuth)")
async def setup_test_user(
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Create or update a test user directly from environment variables.

    This endpoint bypasses OAuth entirely. It uses:
    - ``META_ACCESS_TOKEN`` — your Meta Business API access token
    - ``META_INSTAGRAM_USER_ID`` — your Instagram Business Account ID

    It creates the user in the database, encrypts and stores the token,
    and returns a JWT session token for authenticating subsequent API calls.

    Raises:
        HTTPException 400: If META_ACCESS_TOKEN or META_INSTAGRAM_USER_ID
            are not set in the environment.
    """
    if not settings.META_ACCESS_TOKEN or not settings.META_INSTAGRAM_USER_ID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "META_ACCESS_TOKEN and META_INSTAGRAM_USER_ID must be set in "
                ".env to use /setup-test. See .env.example."
            ),
        )

    ig_user_id = settings.META_INSTAGRAM_USER_ID
    access_token = settings.META_ACCESS_TOKEN

    # Fetch profile from Meta to get username
    import httpx
    username = f"user_{ig_user_id}"  # Fallback
    full_name = None
    biography = None
    followers_count = None
    follows_count = None
    media_count = None

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{settings.meta_graph_url}/{ig_user_id}",
                params={
                    "fields": "id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url",
                    "access_token": access_token,
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                username = data.get("username", username)
                full_name = data.get("name")
                biography = data.get("biography")
                followers_count = data.get("followers_count")
                follows_count = data.get("follows_count")
                media_count = data.get("media_count")
                profile_picture_url = data.get("profile_picture_url")
                logger.info("Fetched profile for IG user: %s", username)
            else:
                logger.warning(
                    "Could not fetch IG profile (HTTP %d), using defaults",
                    resp.status_code,
                )
    except Exception:
        logger.warning("Failed to fetch IG profile, using defaults", exc_info=True)

    # Upsert user
    result = await db.execute(
        select(User).where(
            (User.instagram_user_id == ig_user_id) |
            ((User.username == username) & (User.username != ""))
        )
    )
    users = list(result.scalars().all())

    from app.models.reel import Reel

    if not users:
        user = User(
            instagram_user_id=ig_user_id,
            username=username,
            full_name=full_name,
            biography=biography,
            followers_count=followers_count,
            follows_count=follows_count,
            media_count=media_count,
            profile_picture_url=profile_picture_url,
            auto_reply_enabled=False,
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)
        logger.info("Created test user: id=%d, username=%s", user.id, username)
    else:
        # Keep the first matching user as the primary user
        user = users[0]

        # Merge and delete any secondary duplicates
        if len(users) > 1:
            for dup_user in users[1:]:
                logger.info("Deduplicating: merging reels from user id=%s to primary user id=%s", dup_user.id, user.id)
                # Re-assign reels to the primary user
                await db.execute(
                    update(Reel).where(Reel.user_id == dup_user.id).values(user_id=user.id)
                )
                # Delete the duplicate user (associated tokens cascade delete automatically)
                await db.execute(
                    delete(User).where(User.id == dup_user.id)
                )
            await db.flush()

        await db.execute(
            update(User).where(User.id == user.id).values(
                instagram_user_id=ig_user_id,
                username=username if username else user.username,
                full_name=full_name if full_name else user.full_name,
                biography=biography if biography is not None else user.biography,
                followers_count=followers_count if followers_count is not None else user.followers_count,
                follows_count=follows_count if follows_count is not None else user.follows_count,
                media_count=media_count if media_count is not None else user.media_count,
                profile_picture_url=profile_picture_url if profile_picture_url else user.profile_picture_url,
            )
        )
        await db.flush()

        logger.info("Updated existing test user: id=%d with instagram_user_id=%s", user.id, ig_user_id)

    # Encrypt and store the access token
    encrypted = encrypt_token(access_token, settings.ENCRYPTION_KEY)
    # Assume the direct token is long-lived (60 days) or doesn't expire
    expires_at = datetime.now(timezone.utc) + timedelta(days=60)

    result = await db.execute(
        select(UserToken)
        .where(UserToken.user_id == user.id)
        .order_by(UserToken.expires_at.desc())
        .limit(1)
    )
    existing_token = result.scalar_one_or_none()

    if existing_token:
        await db.execute(
            update(UserToken)
            .where(UserToken.id == existing_token.id)
            .values(
                encrypted_access_token=encrypted,
                expires_at=expires_at,
                token_type="long_lived",
            )
        )
        await db.flush()
    else:
        token = UserToken(
            user_id=user.id,
            encrypted_access_token=encrypted,
            token_type="long_lived",
            scopes=["instagram_basic", "instagram_manage_comments"],
            expires_at=expires_at,
        )
        db.add(token)
        await db.flush()

    await db.commit()

    # Issue JWT
    jwt_token = create_jwt(
        user_id=user.id,
        secret=settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
        expiry_hours=settings.JWT_EXPIRY_HOURS,
    )

    logger.info(
        "Test user setup complete -- user_id=%d, username=%s. "
        "Use the JWT token for authenticated API calls.",
        user.id,
        username,
    )

    return TokenResponse(
        access_token=jwt_token,
        token_type="bearer",
        expires_in=settings.JWT_EXPIRY_HOURS * 3600,
    )


# =========================================================================== #
#  OAuth Flow (disabled during testing — code preserved for production)
# =========================================================================== #

@router.get("/login", summary="Redirect to Meta OAuth")
async def login() -> RedirectResponse:
    """Build the Instagram Business OAuth authorization URL and redirect the user.

    Uses the Instagram OAuth endpoint (not Facebook) to match the token exchange
    logic in AuthService which exchanges codes at api.instagram.com.

    Raises:
        HTTPException 503: If OAuth is not configured (testing mode).
    """
    if not _is_oauth_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "OAuth is not configured. Set META_APP_ID and META_APP_SECRET "
                "in .env, or use POST /api/v1/auth/setup-test for testing."
            ),
        )

    params = {
        "client_id": settings.META_APP_ID,
        "redirect_uri": settings.META_REDIRECT_URI,
        "response_type": "code",
        "scope": "instagram_business_basic,instagram_business_manage_comments",
    }
    auth_url = f"https://www.instagram.com/oauth/authorize?{urlencode(params)}"
    logger.info("Redirecting user to Instagram OAuth: %s", auth_url)
    return RedirectResponse(url=auth_url)


@router.get("/callback", summary="OAuth callback")
async def oauth_callback(
    code: str,
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    """Handle the Meta OAuth callback and redirect to frontend with JWT.

    1. Exchange the authorization ``code`` for a short-lived access token.
    2. Exchange short-lived token for a long-lived token.
    3. Fetch the user's Instagram Business Account details.
    4. Upsert the user in the database (encrypt + store token).
    5. Redirect to the frontend with the JWT as a ``?token=`` query parameter.

    Raises:
        HTTPException 503: If OAuth is not configured.
    """
    if not _is_oauth_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OAuth is not configured. Use POST /api/v1/auth/setup-test.",
        )

    auth_service = AuthService(db)
    frontend_url = settings.FRONTEND_URL

    try:
        token_response = await auth_service.handle_oauth_callback(code)
        jwt_token = token_response["access_token"]
        logger.info("OAuth callback successful — redirecting to frontend")
        return RedirectResponse(
            url=f"{frontend_url}?token={jwt_token}",
            status_code=302,
        )
    except Exception as exc:
        logger.error("OAuth callback failed: %s", exc)
        return RedirectResponse(
            url=f"{frontend_url}?auth_error=oauth_failed",
            status_code=302,
        )


@router.get("/me", summary="Current user profile")
async def get_me(
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return the authenticated user's profile.

    Raises:
        HTTPException 404: If the user no longer exists in the DB.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return {
        "id": user.id,
        "instagram_user_id": user.instagram_user_id,
        "username": user.username,
        "full_name": user.full_name,
        "biography": user.biography,
        "followers_count": user.followers_count,
        "follows_count": user.follows_count,
        "media_count": user.media_count,
        "profile_picture_url": user.profile_picture_url,
        "auto_reply_enabled": user.auto_reply_enabled,
        "reply_tone": user.reply_tone,
        "reply_style": user.reply_style,
        "is_active": user.is_active,
    }



@router.post("/refresh", response_model=TokenResponse, summary="Refresh Meta token")
async def refresh_token(
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Manually refresh the current user's Meta long-lived access token.

    Raises:
        HTTPException 503: If OAuth is not configured.
        HTTPException 400: If the refresh operation fails.
    """
    if not _is_oauth_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "OAuth is not configured. In testing mode, update "
                "META_ACCESS_TOKEN in .env and call POST /api/v1/auth/setup-test."
            ),
        )

    auth_service = AuthService(db)

    try:
        token_response = await auth_service.refresh_meta_token(user_id)
    except ValueError as exc:
        logger.error("Token refresh failed for user_id=%s: %s", user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    logger.info("Meta token refreshed for user_id=%s", user_id)
    return token_response
