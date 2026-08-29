"""ReelAutomationConfig model for reel-specific automation rules and custom API integrations."""

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
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class ReelAutomationConfig(TimestampMixin, Base):
    """Stores per-reel customized instructions, reference knowledge, and external API tool definitions.

    Attributes:
        id: Internal primary key.
        reel_id: FK to reels.id (unique one-to-one).
        user_id: FK to users.id.
        ai_reply_enabled: Whether AI comment reply is enabled for this reel.
        comment_dm_enabled: Whether Comment-to-DM is enabled for this reel.
        custom_instructions: Specific AI prompt guidelines for this reel.
        reference_knowledge: Specific documents, links, pricing, product notes.
        api_enabled: Whether external API tool calling is active for this reel.
        api_endpoint: External base URL.
        api_method: HTTP method ('GET' or 'POST').
        api_headers: Key-value headers/tokens (stored as JSON dict).
        api_docs: API documentation, OpenAPI schema, or usage guide.
        api_trigger_rule: Plain English rule on when the AI should call this API.
    """

    __tablename__ = "reel_automation_configs"
    __table_args__ = (
        Index("ix_reel_auto_reel_id", "reel_id", unique=True),
        Index("ix_reel_auto_user_id", "user_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reel_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("reels.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    ai_reply_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    comment_dm_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    custom_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    reference_knowledge: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # External API Tool Calling Fields
    api_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    api_endpoint: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    api_method: Mapped[str] = mapped_column(String(10), default="GET", nullable=False)
    api_headers: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    api_docs: Mapped[str | None] = mapped_column(Text, nullable=True)
    api_trigger_rule: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    reel: Mapped["Reel"] = relationship("Reel", lazy="selectin")  # noqa: F821
    user: Mapped["User"] = relationship("User", lazy="selectin")  # noqa: F821

    def __repr__(self) -> str:
        return f"<ReelAutomationConfig(id={self.id}, reel_id={self.reel_id}, api_enabled={self.api_enabled})>"
