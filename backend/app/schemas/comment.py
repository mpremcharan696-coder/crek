"""Comment and CommentReply response schemas for Pilotly."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class CommentReplyResponse(BaseModel):
    """Response schema for a single reply to a comment.

    Attributes:
        id: Internal reply ID.
        reply_text: The reply text content.
        status: Lifecycle status ('pending', 'approved', 'posted', 'failed').
        used_web_search: Whether real-time web search enriched this reply.
        posted_at: When the reply was posted to Instagram (null if not yet posted).
        created_at: When the reply was generated.
    """

    id: int
    reply_text: str
    status: str
    used_web_search: bool
    posted_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CommentResponse(BaseModel):
    """Response schema for a single Instagram comment with its replies.

    Attributes:
        id: Internal comment ID.
        comment_id: Instagram comment ID.
        text: Full comment text.
        commenter_username: Instagram username of the commenter.
        is_processed: Whether the AI pipeline has processed this comment.
        created_at: When the comment was ingested.
        replies: List of AI-generated or manual replies.
    """

    id: int
    comment_id: str
    text: str
    commenter_username: str | None = None
    is_processed: bool
    created_at: datetime
    replies: list[CommentReplyResponse] = []

    model_config = {"from_attributes": True}


class ApproveReplyRequest(BaseModel):
    """Request schema for approving a reply, with optional custom edited text.

    Attributes:
        reply_text: Optional custom edited reply text. If not provided,
            the original AI-generated reply is posted.
    """

    reply_text: str | None = None
