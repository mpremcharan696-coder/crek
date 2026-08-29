"""Router for Reel-specific Custom Automation, Knowledge Base, and External API Tool Calling."""

from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db
from app.models.reel import Reel
from app.models.reel_automation import ReelAutomationConfig

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reels", tags=["reel-automations"])


class ReelAutomationConfigPayload(BaseModel):
    ai_reply_enabled: bool = True
    comment_dm_enabled: bool = False
    custom_instructions: str | None = None
    reference_knowledge: str | None = None
    api_enabled: bool = False
    api_endpoint: str | None = None
    api_method: str = "GET"
    api_headers: dict[str, Any] | None = None
    api_docs: str | None = None
    api_trigger_rule: str | None = None


class TestAPIPayload(BaseModel):
    api_endpoint: str
    api_method: str = "GET"
    api_headers: dict[str, Any] | None = None
    test_params: dict[str, Any] | None = None
    test_body: dict[str, Any] | None = None


@router.get("/{reel_id}/automation-config")
async def get_reel_automation_config(
    reel_id: int,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Retrieve the custom automation configuration for a specific reel."""
    # Verify reel belongs to current user
    result = await session.execute(
        select(Reel).where(Reel.id == reel_id, Reel.user_id == user_id)
    )
    reel = result.scalar_one_or_none()
    if not reel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reel not found or does not belong to the current user",
        )

    result = await session.execute(
        select(ReelAutomationConfig).where(ReelAutomationConfig.reel_id == reel_id)
    )
    config = result.scalar_one_or_none()

    if not config:
        return {
            "reel_id": reel_id,
            "ai_reply_enabled": True,
            "comment_dm_enabled": False,
            "custom_instructions": "",
            "reference_knowledge": "",
            "api_enabled": False,
            "api_endpoint": "",
            "api_method": "GET",
            "api_headers": {},
            "api_docs": "",
            "api_trigger_rule": "",
        }

    return {
        "id": config.id,
        "reel_id": config.reel_id,
        "ai_reply_enabled": config.ai_reply_enabled,
        "comment_dm_enabled": config.comment_dm_enabled,
        "custom_instructions": config.custom_instructions or "",
        "reference_knowledge": config.reference_knowledge or "",
        "api_enabled": config.api_enabled,
        "api_endpoint": config.api_endpoint or "",
        "api_method": config.api_method or "GET",
        "api_headers": config.api_headers or {},
        "api_docs": config.api_docs or "",
        "api_trigger_rule": config.api_trigger_rule or "",
    }


@router.post("/{reel_id}/automation-config")
async def upsert_reel_automation_config(
    reel_id: int,
    payload: ReelAutomationConfigPayload,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Upsert custom instructions, reference knowledge, and external API tool definition for a reel."""
    result = await session.execute(
        select(Reel).where(Reel.id == reel_id, Reel.user_id == user_id)
    )
    reel = result.scalar_one_or_none()
    if not reel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reel not found or does not belong to the current user",
        )

    result = await session.execute(
        select(ReelAutomationConfig).where(ReelAutomationConfig.reel_id == reel_id)
    )
    config = result.scalar_one_or_none()

    if config:
        config.ai_reply_enabled = payload.ai_reply_enabled
        config.comment_dm_enabled = payload.comment_dm_enabled
        config.custom_instructions = payload.custom_instructions
        config.reference_knowledge = payload.reference_knowledge
        config.api_enabled = payload.api_enabled
        config.api_endpoint = payload.api_endpoint
        config.api_method = payload.api_method
        config.api_headers = payload.api_headers
        config.api_docs = payload.api_docs
        config.api_trigger_rule = payload.api_trigger_rule
    else:
        config = ReelAutomationConfig(
            reel_id=reel_id,
            user_id=user_id,
            ai_reply_enabled=payload.ai_reply_enabled,
            comment_dm_enabled=payload.comment_dm_enabled,
            custom_instructions=payload.custom_instructions,
            reference_knowledge=payload.reference_knowledge,
            api_enabled=payload.api_enabled,
            api_endpoint=payload.api_endpoint,
            api_method=payload.api_method,
            api_headers=payload.api_headers,
            api_docs=payload.api_docs,
            api_trigger_rule=payload.api_trigger_rule,
        )
        session.add(config)

    await session.commit()
    await session.refresh(config)

    return {
        "status": "success",
        "message": "Reel automation configuration saved successfully",
        "config_id": config.id,
    }


@router.post("/{reel_id}/test-api")
async def test_reel_custom_api(
    reel_id: int,
    payload: TestAPIPayload,
    user_id: int = Depends(get_current_user_id),
) -> dict[str, Any]:
    """Test fire an external API endpoint configured for a reel to verify connectivity and response."""
    endpoint = payload.api_endpoint.strip()
    if not endpoint.startswith(("http://", "https://")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="API endpoint must start with http:// or https://",
        )

    headers = payload.api_headers or {}
    method = payload.api_method.upper()

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            if method == "GET":
                res = await client.get(endpoint, headers=headers, params=payload.test_params)
            elif method == "POST":
                res = await client.post(endpoint, headers=headers, json=payload.test_body or {})
            else:
                res = await client.request(method, endpoint, headers=headers)

            try:
                data = res.json()
            except Exception:
                data = res.text[:1000]

            return {
                "success": res.is_success,
                "status_code": res.status_code,
                "response_data": data,
            }
    except httpx.RequestError as exc:
        return {
            "success": False,
            "status_code": 0,
            "error": f"Failed to reach API endpoint: {str(exc)}",
        }
