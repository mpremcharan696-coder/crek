"""Authentication service for Meta OAuth and JWT session management.

Handles the full OAuth flow: authorization URL generation, callback handling
(code-to-token exchange, user creation/update), token refresh, and JWT issuance.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_jwt, decrypt_token, encrypt_token
from app.models.user import User, UserToken
from app.schemas.user import UserSettingsUpdate

logger = logging.getLogger(__name__)


class AuthServiceError(Exception):
    """Base exception for authentication service errors."""


class OAuthExchangeError(AuthServiceError):
    """Raised when the OAuth code-to-token exchange fails."""


class TokenRefreshError(AuthServiceError):
    """Raised when a Meta token refresh fails."""


class AuthService:
    """Manages Meta OAuth authentication and JWT session lifecycle.

    This service encapsulates:
    - Building the Meta/Instagram OAuth authorization URL
    - Exchanging auth codes for short-lived and long-lived tokens
    - Fetching and upserting user profiles
    - Encrypting and storing access tokens
    - Issuing JWT session tokens for the dashboard API
    - Refreshing long-lived Meta tokens before expiry
    """

    META_OAUTH_AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize"
    META_TOKEN_EXCHANGE_URL = "https://api.instagram.com/oauth/access_token"
    META_LONG_LIVED_TOKEN_URL = "https://graph.instagram.com/access_token"
    META_REFRESH_TOKEN_URL = "https://graph.instagram.com/refresh_access_token"

    OAUTH_SCOPES = "instagram_business_basic,instagram_business_manage_comments"

    # Fields that can be updated via user settings
    _ALLOWED_SETTINGS_FIELDS = {
        "auto_reply_enabled",
        "reply_style",
        "reply_tone",
        "auto_reply_delay_seconds",
    }

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.http_client = httpx.AsyncClient(timeout=30.0)

    # ------------------------------------------------------------------
    # Authorization URL
    # ------------------------------------------------------------------

    def get_authorization_url(self) -> str:
        """Build the Meta/Instagram OAuth authorization URL.

        Returns:
            Fully-formed authorization URL to redirect the user to.
        """
        params = {
            "client_id": settings.META_APP_ID,
            "redirect_uri": settings.META_REDIRECT_URI,
            "response_type": "code",
            "scope": self.OAUTH_SCOPES,
        }
        url = f"{self.META_OAUTH_AUTHORIZE_URL}?{urlencode(params)}"
        logger.debug("Generated OAuth authorization URL (client_id=%s)", settings.META_APP_ID)
        return url

    async def get_user_profile(self, user_id: int) -> User | None:
        """Fetch the user record from the database."""
        result = await self.session.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def update_user_settings(
        self, user_id: int, settings_data: UserSettingsUpdate
    ) -> User | None:
        """Update and return the user settings."""
        update_data = {
            k: v
            for k, v in settings_data.model_dump(exclude_unset=True).items()
            if k in self._ALLOWED_SETTINGS_FIELDS
        }
        if not update_data:
            return await self.get_user_profile(user_id)

        await self.session.execute(
            update(User).where(User.id == user_id).values(**update_data)
        )
        await self.session.flush()
        return await self.get_user_profile(user_id)

    # ------------------------------------------------------------------
    # OAuth Callback
    # ------------------------------------------------------------------

    async def handle_oauth_callback(self, code: str) -> dict:
        """Exchange an authorization code for tokens, create/update user, return JWT.

        Flow:
        1. Exchange code → short-lived token via Instagram API.
        2. Exchange short-lived → long-lived token via Graph API.
        3. Fetch user profile from Meta.
        4. Upsert user record in database.
        5. Encrypt and store the long-lived token.
        6. Issue a JWT session token.

        Args:
            code: OAuth authorization code from Meta redirect.

        Returns:
            Dict with ``access_token`` (JWT), ``token_type``, and ``user`` info.

        Raises:
            OAuthExchangeError: On any failure during the exchange pipeline.
        """
        try:
            # Step 1 – short-lived token
            short_lived_token, ig_user_id = await self._exchange_code_for_short_token(code)
            logger.info("Obtained short-lived token for IG user %s", ig_user_id)

            # Step 2 – long-lived token
            long_lived_token, expires_in = await self._exchange_for_long_lived_token(short_lived_token)
            logger.info("Exchanged for long-lived token (expires_in=%s)", expires_in)

            # Step 3 – user profile
            profile = await self._fetch_user_profile(ig_user_id, long_lived_token)
            logger.info("Fetched Meta profile for username=%s", profile.get("username"))

            # Step 4 – upsert user
            username = profile.get("username", "")
            result = await self.session.execute(
                select(User).where(
                    (User.instagram_user_id == ig_user_id) |
                    ((User.username == username) & (User.username != ""))
                )
            )
            users = list(result.scalars().all())

            # Lazy import Reel inside the method block to avoid circular import issues
            from app.models.reel import Reel

            if not users:
                user = User(
                    instagram_user_id=ig_user_id,
                    username=username,
                    full_name=profile.get("name"),
                    biography=profile.get("biography"),
                    followers_count=profile.get("followers_count"),
                    follows_count=profile.get("follows_count"),
                    media_count=profile.get("media_count"),
                    profile_picture_url=profile.get("profile_picture_url"),
                    auto_reply_enabled=False,
                )
                self.session.add(user)
                await self.session.flush()
                await self.session.refresh(user)
                logger.info("Created new user id=%s for IG user %s", user.id, ig_user_id)
            else:
                # Keep the first matching user as the primary user
                user = users[0]

                # Merge and delete any secondary duplicates
                if len(users) > 1:
                    for dup_user in users[1:]:
                        logger.info("Deduplicating: merging reels from user id=%s to primary user id=%s", dup_user.id, user.id)
                        # Re-assign reels to the primary user
                        await self.session.execute(
                            update(Reel).where(Reel.user_id == dup_user.id).values(user_id=user.id)
                        )
                        # Delete the duplicate user (associated tokens cascade delete automatically)
                        await self.session.execute(
                            delete(User).where(User.id == dup_user.id)
                        )
                    await self.session.flush()

                await self.session.execute(
                    update(User).where(User.id == user.id).values(
                        instagram_user_id=ig_user_id,
                        username=username if username else user.username,
                        full_name=profile.get("name", user.full_name),
                        biography=profile.get("biography", user.biography),
                        followers_count=profile.get("followers_count", user.followers_count),
                        follows_count=profile.get("follows_count", user.follows_count),
                        media_count=profile.get("media_count", user.media_count),
                        profile_picture_url=profile.get(
                            "profile_picture_url", user.profile_picture_url
                        ),
                    )
                )

                await self.session.flush()
                logger.info("Updated existing user id=%s with active instagram_user_id=%s", user.id, ig_user_id)

            # Step 5 – encrypt & store token
            encrypted = encrypt_token(long_lived_token, settings.ENCRYPTION_KEY)
            token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

            # Upsert token
            result = await self.session.execute(
                select(UserToken)
                .where(UserToken.user_id == user.id)
                .order_by(UserToken.expires_at.desc())
                .limit(1)
            )
            existing_token = result.scalar_one_or_none()

            if existing_token:
                await self.session.execute(
                    update(UserToken)
                    .where(UserToken.id == existing_token.id)
                    .values(
                        encrypted_access_token=encrypted,
                        expires_at=token_expires_at,
                        token_type="long_lived",
                    )
                )
            else:
                new_token = UserToken(
                    user_id=user.id,
                    encrypted_access_token=encrypted,
                    token_type="long_lived",
                    scopes=["instagram_business_basic", "instagram_business_manage_comments"],
                    expires_at=token_expires_at,
                )
                self.session.add(new_token)

            await self.session.flush()

            # Step 6 – JWT session
            jwt_token = self.create_session_jwt(user.id)

            await self.session.commit()

            return {
                "access_token": jwt_token,
                "token_type": "bearer",
                "user": {
                    "id": user.id,
                    "instagram_user_id": user.instagram_user_id,
                    "username": user.username,
                    "full_name": user.full_name,
                    "profile_picture_url": user.profile_picture_url,
                },
            }

        except httpx.HTTPError as exc:
            logger.error("HTTP error during OAuth callback: %s", exc, exc_info=True)
            await self.session.rollback()
            raise OAuthExchangeError(f"HTTP error during OAuth exchange: {exc}") from exc
        except Exception as exc:
            logger.error("Unexpected error during OAuth callback: %s", exc, exc_info=True)
            await self.session.rollback()
            raise OAuthExchangeError(f"OAuth callback failed: {exc}") from exc

    # ------------------------------------------------------------------
    # Token Refresh
    # ------------------------------------------------------------------

    async def refresh_meta_token(self, user_id: int) -> bool:
        """Refresh a long-lived Meta token.

        The token must be >24 h old and <60 days old to be refreshable.

        Args:
            user_id: Internal user ID.

        Returns:
            True if the refresh succeeded, False otherwise.

        Raises:
            TokenRefreshError: On HTTP or decryption failures.
        """
        try:
            current_token = await self.get_decrypted_token(user_id)

            response = await self.http_client.get(
                self.META_REFRESH_TOKEN_URL,
                params={
                    "grant_type": "ig_refresh_token",
                    "access_token": current_token,
                },
            )
            response.raise_for_status()
            data = response.json()

            new_token = data["access_token"]
            expires_in = data.get("expires_in", 5_184_000)  # default 60 days

            encrypted = encrypt_token(new_token, settings.ENCRYPTION_KEY)
            token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

            # Update existing token
            result = await self.session.execute(
                select(UserToken)
                .where(UserToken.user_id == user_id)
                .order_by(UserToken.expires_at.desc())
                .limit(1)
            )
            existing = result.scalar_one_or_none()

            if existing:
                await self.session.execute(
                    update(UserToken)
                    .where(UserToken.id == existing.id)
                    .values(
                        encrypted_access_token=encrypted,
                        expires_at=token_expires_at,
                        token_type="long_lived",
                    )
                )
            else:
                new_token_row = UserToken(
                    user_id=user_id,
                    encrypted_access_token=encrypted,
                    token_type="long_lived",
                    scopes=["instagram_business_basic", "instagram_business_manage_comments"],
                    expires_at=token_expires_at,
                )
                self.session.add(new_token_row)

            await self.session.flush()
            await self.session.commit()

            logger.info("Refreshed Meta token for user_id=%s (expires_in=%s)", user_id, expires_in)
            return True

        except httpx.HTTPStatusError as exc:
            logger.error(
                "Meta token refresh HTTP error for user_id=%s: %s %s",
                user_id,
                exc.response.status_code,
                exc.response.text,
            )
            await self.session.rollback()
            raise TokenRefreshError(
                f"Meta token refresh failed ({exc.response.status_code})"
            ) from exc
        except Exception as exc:
            logger.error("Token refresh failed for user_id=%s: %s", user_id, exc, exc_info=True)
            await self.session.rollback()
            raise TokenRefreshError(f"Token refresh failed: {exc}") from exc

    # ------------------------------------------------------------------
    # Token Retrieval
    # ------------------------------------------------------------------

    async def get_decrypted_token(self, user_id: int) -> str:
        """Retrieve and decrypt the user's stored Meta access token.

        Args:
            user_id: Internal user ID.

        Returns:
            Plaintext access token.

        Raises:
            AuthServiceError: If no token is found for the user.
        """
        result = await self.session.execute(
            select(UserToken)
            .where(UserToken.user_id == user_id)
            .order_by(UserToken.expires_at.desc())
            .limit(1)
        )
        user_token = result.scalar_one_or_none()
        if user_token is None:
            raise AuthServiceError(f"No stored token found for user_id={user_id}")
        return decrypt_token(user_token.encrypted_access_token, settings.ENCRYPTION_KEY)

    # ------------------------------------------------------------------
    # JWT Issuance
    # ------------------------------------------------------------------

    def create_session_jwt(self, user_id: int) -> str:
        """Issue a JWT for dashboard API authentication.

        Args:
            user_id: Internal user ID to encode as the ``sub`` claim.

        Returns:
            Encoded JWT string.
        """
        return create_jwt(
            user_id=user_id,
            secret=settings.JWT_SECRET,
            algorithm=settings.JWT_ALGORITHM,
            expiry_hours=settings.JWT_EXPIRY_HOURS,
        )

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self.http_client.aclose()

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _exchange_code_for_short_token(self, code: str) -> tuple[str, str]:
        """Exchange authorization code for a short-lived token.

        Returns:
            Tuple of (short_lived_token, ig_user_id).
        """
        response = await self.http_client.post(
            self.META_TOKEN_EXCHANGE_URL,
            data={
                "client_id": settings.META_APP_ID,
                "client_secret": settings.META_APP_SECRET,
                "grant_type": "authorization_code",
                "redirect_uri": settings.META_REDIRECT_URI,
                "code": code,
            },
        )
        response.raise_for_status()
        data = response.json()
        return data["access_token"], str(data["user_id"])

    async def _exchange_for_long_lived_token(self, short_lived_token: str) -> tuple[str, int]:
        """Exchange a short-lived token for a long-lived one.

        Returns:
            Tuple of (long_lived_token, expires_in_seconds).
        """
        response = await self.http_client.get(
            self.META_LONG_LIVED_TOKEN_URL,
            params={
                "grant_type": "ig_exchange_token",
                "client_secret": settings.META_APP_SECRET,
                "access_token": short_lived_token,
            },
        )
        response.raise_for_status()
        data = response.json()
        return data["access_token"], data.get("expires_in", 5_184_000)

    async def _fetch_user_profile(self, ig_user_id: str, token: str) -> dict:
        """Fetch user profile from Meta Graph API.

        Returns:
            Dict with ``id``, ``username``, ``name``, ``profile_picture_url``.
        """
        url = f"https://graph.instagram.com/{settings.META_GRAPH_API_VERSION}/{ig_user_id}"
        response = await self.http_client.get(
            url,
            params={
                "fields": "id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url",
                "access_token": token,
            },
        )
        response.raise_for_status()
        return response.json()

