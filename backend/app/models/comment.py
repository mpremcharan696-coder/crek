"""Comment and CommentReply SQLAlchemy models for Pilotly.

Comment represents an Instagram comment received on a tracked Reel.
CommentReply stores AI-generated (or manual) reply drafts and their posting status.
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

from app.models.base import Base


class Comment(Base):
    """An Instagram comment on a tracked Reel.

    Comments are ingested from webhook events and then processed by the
    AI reply pipeline. The `is_processed` flag indicates whether the AI
    pipeline has generated a reply for this comment.

    Attributes:
        id: Internal primary key.
        reel_id: FK to reels.id — the reel this comment belongs to.
        comment_id: Instagram's unique comment ID.
        text: Full text content of the comment.
        commenter_id: Instagram-scoped user ID of the commenter.
        commenter_username: Instagram username of the commenter.
        parent_comment_id: Instagram comment ID of the parent (for threaded replies).
        is_processed: Whether the AI pipeline has processed this comment.
        created_at: Row creation timestamp (no updated_at for immutable comments).
    """

    __tablename__ = "comments"
    __table_args__ = (
        Index("ix_comments_reel_id", "reel_id"),
        Index("ix_comments_comment_id", "comment_id", unique=True),
        Index("ix_comments_is_processed", "is_processed"),
        Index("ix_comments_reel_is_processed", "reel_id", "is_processed"),
        Index("ix_comments_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reel_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("reels.id", ondelete="CASCADE"), nullable=False
    )
    comment_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    commenter_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    commenter_username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    parent_comment_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_processed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    reel: Mapped["Reel"] = relationship("Reel", back_populates="comments")  # noqa: F821
    replies: Mapped[list["CommentReply"]] = relationship(
        "CommentReply",
        back_populates="comment",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Comment(id={self.id}, comment_id='{self.comment_id}')>"


class CommentReply(Base):
    """An AI-generated or manually drafted reply to a Comment.

    Replies go through a lifecycle: pending → approved → posted (or failed).
    When auto_reply_enabled is True for the user, replies skip 'pending'
    and go directly to 'posted' after the Instagram API call succeeds.

    Status values:
        - 'pending': Awaiting creator approval.
        - 'approved': Creator approved, waiting to be posted.
        - 'posted': Successfully posted to Instagram.
        - 'failed': Posting failed after max retries (3 attempts).

    Attributes:
        id: Internal primary key.
        comment_id: FK to comments.id.
        reply_text: The reply text to post.
        reply_ig_id: Instagram's ID for the posted reply (null while pending).
        status: Lifecycle status of this reply.
        used_web_search: Whether Tavily web search was used to enrich the reply.
        ai_model: Model identifier used for generation.
        retry_count: Number of posting attempts so far (max 3).
        posted_at: Timestamp when the reply was successfully posted.
        created_at: Row creation timestamp.
    """

    __tablename__ = "comment_replies"
    __table_args__ = (
        Index("ix_comment_replies_status", "status"),
        Index("ix_comment_replies_comment_id", "comment_id"),
        Index("ix_comment_replies_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    comment_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=False
    )
    reply_text: Mapped[str] = mapped_column(Text, nullable=False)
    reply_ig_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False
    )
    used_web_search: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ai_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    posted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    comment: Mapped["Comment"] = relationship("Comment", back_populates="replies")

    def __repr__(self) -> str:
        return f"<CommentReply(id={self.id}, status='{self.status}')>"
