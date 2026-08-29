"""User and UserToken SQLAlchemy models for Pilotly.

User represents an Instagram creator who has connected their account.
UserToken stores encrypted Meta/Instagram API tokens for each user.
"""

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class User(TimestampMixin, Base):
    """Instagram creator who has connected their account to Pilotly.

    Attributes:
        id: Internal primary key.
        instagram_user_id: Instagram-scoped user ID (IGSID), unique.
        username: Instagram username.
        full_name: Optional display name.
        profile_picture_url: URL to the user's Instagram profile picture.
        page_id: Facebook Page ID linked to the Instagram account (for DMs in Phase 2).
        auto_reply_enabled: Whether AI auto-replies are enabled. Defaults to False.
        reply_tone: Tone preset for AI-generated replies (e.g. 'friendly', 'professional').
        reply_style: Free-text custom style description for reply generation.
        is_active: Soft-delete / deactivation flag.
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    instagram_user_id: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    username: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    biography: Mapped[str | None] = mapped_column(Text, nullable=True)
    followers_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    follows_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    media_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    profile_picture_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    page_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    auto_reply_enabled: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    reply_tone: Mapped[str] = mapped_column(
        String(50), default="friendly", nullable=False
    )
    reply_style: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    tokens: Mapped[list["UserToken"]] = relationship(
        "UserToken", back_populates="user", cascade="all, delete-orphan", lazy="selectin"
    )
    reels: Mapped[list["Reel"]] = relationship(  # noqa: F821 — forward ref
        "Reel", back_populates="user", cascade="all, delete-orphan", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, username='{self.username}')>"


class UserToken(TimestampMixin, Base):
    """Encrypted API token for a User's Instagram/Meta access.

    Access tokens are Fernet-encrypted before storage and decrypted
    only when needed for API calls.

    Attributes:
        id: Internal primary key.
        user_id: FK to users.id.
        encrypted_access_token: Fernet-encrypted token bytes.
        token_type: Token lifecycle type ('short_lived', 'long_lived').
        scopes: List of OAuth scopes granted.
        expires_at: Token expiration timestamp.
    """

    __tablename__ = "user_tokens"
    __table_args__ = (
        Index("ix_user_tokens_expires_at", "expires_at"),
        Index("ix_user_tokens_user_id", "user_id"),
        Index("ix_user_tokens_user_expires", "user_id", "expires_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    encrypted_access_token: Mapped[bytes] = mapped_column(
        LargeBinary, nullable=False
    )
    token_type: Mapped[str] = mapped_column(
        String(50), default="long_lived", nullable=False
    )
    scopes: Mapped[list[str] | None] = mapped_column(
        ARRAY(String), nullable=True
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="tokens")

    def __repr__(self) -> str:
        return f"<UserToken(id={self.id}, user_id={self.user_id}, type='{self.token_type}')>"
