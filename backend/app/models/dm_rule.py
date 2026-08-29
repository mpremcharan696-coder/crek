"""CommentDMRule SQLAlchemy model for Comment-to-DM Automation in Pilotly.

Allows creators to automatically send private Instagram DMs when followers
comment on their Reels, completely decoupled from AI comment replies.
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
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class CommentDMRule(TimestampMixin, Base):
    """Configuration rule for sending automated Direct Messages from comments.

    Attributes:
        id: Internal primary key.
        user_id: FK to users.id.
        reel_id: Optional FK to reels.id (null = applies as Global rule to all reels).
        is_enabled: Master toggle for this specific rule.
        trigger_type: 'keyword' (matches trigger_keywords) or 'all_comments' (every comment).
        trigger_keywords: Comma-separated or JSON list of trigger keywords (e.g. "claude,link,guide").
        delivery_mode: 'interactive_button' (2-step button) or 'direct_link' (1-step instant link).
        initial_message: The text sent in the 1st DM (defaults to friendly prompt).
        button_text: Text on the quick-reply button (e.g. "Send me the link").
        payload_message: The text accompanying the final link/doc payload.
        payload_url: The actual resource link or document URL to send.
        max_dms_per_reel: Max limit of DMs allowed for this reel (0 = unlimited).
        sent_dm_count: Running count of successfully sent DMs.
    """

    __tablename__ = "comment_dm_rules"
    __table_args__ = (
        Index("ix_dm_rules_user_id", "user_id"),
        Index("ix_dm_rules_reel_id", "reel_id"),
        Index("ix_dm_rules_user_reel", "user_id", "reel_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    reel_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("reels.id", ondelete="CASCADE"), nullable=True
    )
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    trigger_type: Mapped[str] = mapped_column(
        String(50), default="keyword", nullable=False
    )  # 'keyword' | 'all_comments'
    trigger_keywords: Mapped[str] = mapped_column(
        Text, default="link,guide", nullable=False
    )
    delivery_mode: Mapped[str] = mapped_column(
        String(50), default="interactive_button", nullable=False
    )  # 'interactive_button' | 'direct_link'
    initial_message: Mapped[str] = mapped_column(
        Text,
        default="Want to get the link? Click below and I'll send you the details in a moment. ✨",
        nullable=False,
    )
    button_text: Mapped[str] = mapped_column(
        String(100), default="Send me the link", nullable=False
    )
    payload_message: Mapped[str] = mapped_column(
        Text, default="Here is your step-by-step guide & link:", nullable=False
    )
    payload_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    max_dms_per_reel: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # 0 = unlimited
    sent_dm_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", backref="dm_rules")  # noqa: F821
    reel: Mapped["Reel | None"] = relationship("Reel", backref="dm_rules")  # noqa: F821

    def __repr__(self) -> str:
        return f"<CommentDMRule(id={self.id}, user_id={self.user_id}, reel_id={self.reel_id}, enabled={self.is_enabled})>"
