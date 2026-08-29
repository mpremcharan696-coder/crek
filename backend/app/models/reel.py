"""Reel and ReelSummary SQLAlchemy models for Pilotly.

Reel represents an Instagram Reel that belongs to a User.
ReelSummary stores the AI-generated analysis output for a Reel.
"""

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Reel(TimestampMixin, Base):
    """An Instagram Reel tracked by Pilotly.

    Attributes:
        id: Internal primary key.
        user_id: FK to users.id — the creator who owns this reel.
        media_id: Instagram media ID, unique across the platform.
        caption: Original caption text of the reel.
        media_url: Direct URL to the reel video (may expire).
        thumbnail_url: URL to the reel thumbnail image.
        permalink: Permanent Instagram link to the reel.
        like_count: Cached like count from the Instagram API.
        comments_count: Cached comment count from the Instagram API.
        is_analyzed: Whether the AI analysis pipeline has run on this reel.
        published_at: Original publication timestamp on Instagram.
    """

    __tablename__ = "reels"
    __table_args__ = (
        Index("ix_reels_user_id", "user_id"),
        Index("ix_reels_media_id", "media_id", unique=True),
        Index("ix_reels_user_media", "user_id", "media_id"),
        Index("ix_reels_user_is_analyzed", "user_id", "is_analyzed"),
        Index("ix_reels_published_at", "published_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    media_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    media_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    permalink: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    like_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    comments_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_analyzed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="reels")  # noqa: F821
    summary: Mapped["ReelSummary | None"] = relationship(
        "ReelSummary",
        back_populates="reel",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    comments: Mapped[list["Comment"]] = relationship(  # noqa: F821
        "Comment",
        back_populates="reel",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Reel(id={self.id}, media_id='{self.media_id}')>"


class ReelSummary(TimestampMixin, Base):
    """AI-generated analysis summary for a Reel.

    Produced by the analysis pipeline which transcribes audio,
    analyses visual content, and generates structured insights.

    Attributes:
        id: Internal primary key.
        reel_id: FK to reels.id (one-to-one).
        ai_summary: Full structured analysis output as a JSON dict.
        topics: Extracted topic tags.
        products_mentioned: Products/brands identified in the reel.
        key_points: Bullet-point summary of the reel content.
        faq: Predicted FAQ entries as a list of {question, answer} dicts.
        transcript: Full audio transcript from Whisper.
        analysis_model: Model identifier used for the analysis (e.g. 'qwen3-32b').
    """

    __tablename__ = "reel_summaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reel_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("reels.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    ai_summary: Mapped[dict] = mapped_column(JSON, nullable=False)
    topics: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    products_mentioned: Mapped[list[str] | None] = mapped_column(
        ARRAY(String), nullable=True
    )
    key_points: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    faq: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    analysis_model: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Relationships
    reel: Mapped["Reel"] = relationship("Reel", back_populates="summary")

    def __repr__(self) -> str:
        return f"<ReelSummary(id={self.id}, reel_id={self.reel_id})>"
