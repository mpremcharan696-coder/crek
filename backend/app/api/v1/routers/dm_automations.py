"""Comment-to-DM Automations Router for managing rules and interactive simulations."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db
from app.services.dm_automation_service import DMAutomationService

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Pydantic Schemas ──────────────────────────────────────────────────

class DMRuleUpsertRequest(BaseModel):
    id: int | None = None
    reel_id: int | None = None
    is_enabled: bool = True
    trigger_type: str = Field(default="keyword")  # 'keyword' | 'all_comments'
    trigger_keywords: str = Field(default="link,guide")
    delivery_mode: str = Field(default="interactive_button")  # 'interactive_button' | 'direct_link'
    initial_message: str = Field(
        default="Want to get the link? Click below and I'll send you the details in a moment. ✨"
    )
    button_text: str = Field(default="Send me the link")
    payload_message: str = Field(default="Here is your step-by-step guide & link:")
    payload_url: str | None = None
    max_dms_per_reel: int = 0  # 0 = unlimited


class DMRuleResponse(BaseModel):
    id: int
    user_id: int
    reel_id: int | None = None
    is_enabled: bool
    trigger_type: str
    trigger_keywords: str
    delivery_mode: str
    initial_message: str
    button_text: str
    payload_message: str
    payload_url: str | None = None
    max_dms_per_reel: int
    sent_dm_count: int
    created_at: Any = None
    updated_at: Any = None


class DMSimulateRequest(BaseModel):
    comment_text: str
    trigger_type: str = "keyword"
    trigger_keywords: str = "link,guide"
    delivery_mode: str = "interactive_button"
    initial_message: str = "Want to get the link? Click below and I'll send you the details in a moment. ✨"
    button_text: str = "Send me the link"
    payload_message: str = "Here is your step-by-step guide & link:"
    payload_url: str | None = "https://example.com/claude-guide"


class DMSimulateResponse(BaseModel):
    matched: bool
    delivery_mode: str
    step_1_message: str
    step_1_button: str | None = None
    step_2_message: str | None = None
    step_2_url: str | None = None


# ── Endpoints ─────────────────────────────────────────────────────────

@router.get("", summary="Get all DM automation rules")
async def get_dm_rules(
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Retrieve all global and per-reel Comment-to-DM rules for current user."""
    service = DMAutomationService(db)
    rules = await service.get_rules(user_id)
    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "reel_id": r.reel_id,
            "is_enabled": r.is_enabled,
            "trigger_type": r.trigger_type,
            "trigger_keywords": r.trigger_keywords,
            "delivery_mode": r.delivery_mode,
            "initial_message": r.initial_message,
            "button_text": r.button_text,
            "payload_message": r.payload_message,
            "payload_url": r.payload_url,
            "max_dms_per_reel": r.max_dms_per_reel,
            "sent_dm_count": r.sent_dm_count,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in rules
    ]


@router.post("", summary="Create or update DM automation rule")
async def upsert_dm_rule(
    payload: DMRuleUpsertRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Upsert a Comment-to-DM rule."""
    service = DMAutomationService(db)
    rule = await service.upsert_rule(user_id, payload.model_dump())
    return {
        "id": rule.id,
        "user_id": rule.user_id,
        "reel_id": rule.reel_id,
        "is_enabled": rule.is_enabled,
        "trigger_type": rule.trigger_type,
        "trigger_keywords": rule.trigger_keywords,
        "delivery_mode": rule.delivery_mode,
        "initial_message": rule.initial_message,
        "button_text": rule.button_text,
        "payload_message": rule.payload_message,
        "payload_url": rule.payload_url,
        "max_dms_per_reel": rule.max_dms_per_reel,
        "sent_dm_count": rule.sent_dm_count,
    }


@router.delete("/{rule_id}", summary="Delete DM automation rule")
async def delete_dm_rule(
    rule_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Delete a Comment-to-DM rule."""
    service = DMAutomationService(db)
    success = await service.delete_rule(user_id, rule_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")
    return {"status": "deleted", "rule_id": rule_id}


@router.post("/simulate", response_model=DMSimulateResponse, summary="Simulate Comment-to-DM flow")
async def simulate_dm(
    req: DMSimulateRequest,
) -> DMSimulateResponse:
    """Live interactive simulator for Comment-to-DM flow."""
    import re

    matched = False
    if req.trigger_type == "all_comments":
        matched = True
    else:
        keywords = [k.strip().lower() for k in req.trigger_keywords.split(",") if k.strip()]
        cleaned = re.sub(r"[^\w\s]", " ", req.comment_text.lower())
        words = set(cleaned.split())
        for kw in keywords:
            if kw in req.comment_text.lower() or kw in words:
                matched = True
                break

    initial_msg = req.initial_message or "Want to get the link? Click below and I'll send you the details in a moment. ✨"
    button_txt = req.button_text or "Send me the link"

    if req.delivery_mode == "direct_link":
        final_msg = f"{initial_msg}\n\n🔗 {req.payload_url or 'https://example.com'}"
        return DMSimulateResponse(
            matched=matched,
            delivery_mode="direct_link",
            step_1_message=final_msg,
            step_1_button=None,
            step_2_message=None,
            step_2_url=None,
        )

    # Interactive 2-Step Button mode
    return DMSimulateResponse(
        matched=matched,
        delivery_mode="interactive_button",
        step_1_message=initial_msg,
        step_1_button=button_txt,
        step_2_message=req.payload_message or "Here is your step-by-step guide & link:",
        step_2_url=req.payload_url or "https://example.com/guide",
    )
