"""Reel and ReelSummary response schemas for Pilotly."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ReelSummaryResponse(BaseModel):
    """Response schema for an AI-generated reel analysis summary.

    Attributes:
        ai_summary: Full structured analysis as a dict.
        topics: Extracted topic tags.
        products_mentioned: Products/brands identified.
        key_points: Bullet-point content summary.
        faq: Predicted FAQ entries as list of {question, answer} dicts.
        transcript: Full audio transcript.
        analysis_model: AI model identifier used.
        created_at: When the analysis was created.
    """

    ai_summary: dict[str, Any]
    topics: list[str] | None = None
    products_mentioned: list[str] | None = None
    key_points: list[str] | None = None
    faq: list[dict[str, Any]] | None = None
    transcript: str | None = None
    analysis_model: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ReelResponse(BaseModel):
    """Response schema for a single Reel.

    Attributes:
        id: Internal reel ID.
        media_id: Instagram media ID.
        caption: Reel caption text.
        thumbnail_url: Thumbnail image URL.
        permalink: Permanent Instagram link.
        like_count: Number of likes.
        comments_count: Number of comments.
        is_analyzed: Whether AI analysis has been performed.
        published_at: Original publication time on Instagram.
        created_at: When the reel was ingested into Pilotly.
    """

    id: int
    media_id: str
    caption: str | None = None
    thumbnail_url: str | None = None
    permalink: str | None = None
    like_count: int
    comments_count: int
    is_analyzed: bool
    published_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ReelDetailResponse(ReelResponse):
    """Extended reel response that includes the AI analysis summary.

    Attributes:
        summary: The AI-generated analysis summary, if available.
    """

    summary: ReelSummaryResponse | None = None
