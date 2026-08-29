"""DM Automation Service for managing and executing Comment-to-DM rules."""

from __future__ import annotations

import logging
import re
from typing import Any

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dm_rule import CommentDMRule
from app.models.user import User, UserToken
from app.services.meta_api_service import MetaAPIService

logger = logging.getLogger(__name__)


class DMAutomationService:
    """Service for Comment-to-DM rules management and execution."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_rules(self, user_id: int) -> list[CommentDMRule]:
        """Fetch all DM rules (global and per-reel) for a given user."""
        result = await self.session.execute(
            select(CommentDMRule)
            .where(CommentDMRule.user_id == user_id)
            .order_by(CommentDMRule.reel_id.nulls_first(), CommentDMRule.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_global_rule(self, user_id: int) -> CommentDMRule | None:
        """Fetch the default global rule (reel_id is NULL) for a user."""
        result = await self.session.execute(
            select(CommentDMRule).where(
                CommentDMRule.user_id == user_id,
                CommentDMRule.reel_id.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def get_rule_for_reel(self, user_id: int, reel_id: int | None) -> CommentDMRule | None:
        """Get the specific rule for a reel, falling back to global if none exists."""
        if reel_id is not None:
            res = await self.session.execute(
                select(CommentDMRule).where(
                    CommentDMRule.user_id == user_id,
                    CommentDMRule.reel_id == reel_id,
                )
            )
            rule = res.scalar_one_or_none()
            if rule is not None:
                return rule

        return await self.get_global_rule(user_id)

    async def upsert_rule(self, user_id: int, data: dict[str, Any]) -> CommentDMRule:
        """Create or update a Comment-to-DM rule."""
        rule_id = data.get("id")
        reel_id = data.get("reel_id")

        rule = None
        if rule_id:
            res = await self.session.execute(
                select(CommentDMRule).where(
                    CommentDMRule.id == rule_id,
                    CommentDMRule.user_id == user_id,
                )
            )
            rule = res.scalar_one_or_none()
        elif reel_id is None:
            # Upsert global rule
            rule = await self.get_global_rule(user_id)
        else:
            # Upsert specific reel rule
            res = await self.session.execute(
                select(CommentDMRule).where(
                    CommentDMRule.user_id == user_id,
                    CommentDMRule.reel_id == reel_id,
                )
            )
            rule = res.scalar_one_or_none()

        keywords = data.get("trigger_keywords", "link,guide")
        if isinstance(keywords, list):
            keywords = ",".join(keywords)

        initial_msg = data.get("initial_message")
        if not initial_msg or not str(initial_msg).strip():
            initial_msg = "Want to get the link? Click below and I'll send you the details in a moment. ✨"

        button_txt = data.get("button_text")
        if not button_txt or not str(button_txt).strip():
            button_txt = "Send me the link"

        payload_msg = data.get("payload_message", "Here is your step-by-step guide & link:")
        payload_url = data.get("payload_url", "")
        max_dms = int(data.get("max_dms_per_reel") or 0)
        is_enabled = data.get("is_enabled", True)
        trigger_type = data.get("trigger_type", "keyword")
        delivery_mode = data.get("delivery_mode", "interactive_button")

        if rule is None:
            rule = CommentDMRule(
                user_id=user_id,
                reel_id=reel_id,
                is_enabled=is_enabled,
                trigger_type=trigger_type,
                trigger_keywords=keywords,
                delivery_mode=delivery_mode,
                initial_message=initial_msg,
                button_text=button_txt,
                payload_message=payload_msg,
                payload_url=payload_url,
                max_dms_per_reel=max_dms,
                sent_dm_count=0,
            )
            self.session.add(rule)
        else:
            rule.is_enabled = is_enabled
            rule.trigger_type = trigger_type
            rule.trigger_keywords = keywords
            rule.delivery_mode = delivery_mode
            rule.initial_message = initial_msg
            rule.button_text = button_txt
            rule.payload_message = payload_msg
            rule.payload_url = payload_url
            rule.max_dms_per_reel = max_dms

        await self.session.flush()
        await self.session.refresh(rule)
        await self.session.commit()
        return rule

    async def delete_rule(self, user_id: int, rule_id: int) -> bool:
        """Delete a rule by ID."""
        result = await self.session.execute(
            delete(CommentDMRule).where(
                CommentDMRule.id == rule_id,
                CommentDMRule.user_id == user_id,
            )
        )
        await self.session.commit()
        return result.rowcount > 0

    async def evaluate_and_send_dm(
        self,
        user_id: int,
        reel_id: int | None,
        comment_id: str,
        comment_text: str,
        commenter_id: str | None = None,
    ) -> bool:
        """Check if incoming comment qualifies for Comment-to-DM, and execute sending."""
        rule = await self.get_rule_for_reel(user_id, reel_id)
        if not rule or not rule.is_enabled:
            logger.debug("No active DM rule for user=%s, reel=%s", user_id, reel_id)
            return False

        # Check limit cap
        if rule.max_dms_per_reel > 0 and rule.sent_dm_count >= rule.max_dms_per_reel:
            logger.info("DM limit reached (%d/%d) for rule id=%s", rule.sent_dm_count, rule.max_dms_per_reel, rule.id)
            return False

        # Match trigger
        should_trigger = False
        if rule.trigger_type == "all_comments":
            should_trigger = True
        else:
            # Keyword matching
            keywords = [k.strip().lower() for k in rule.trigger_keywords.split(",") if k.strip()]
            cleaned_text = re.sub(r"[^\w\s]", " ", comment_text.lower())
            words = set(cleaned_text.split())

            for kw in keywords:
                if kw in comment_text.lower() or kw in words:
                    should_trigger = True
                    break

        if not should_trigger:
            return False

        # Get Meta access token
        token_res = await self.session.execute(
            select(UserToken)
            .where(UserToken.user_id == user_id)
            .order_by(UserToken.expires_at.desc())
            .limit(1)
        )
        token_row = token_res.scalar_one_or_none()
        if not token_row:
            logger.warning("No token found to send DM for user_id=%s", user_id)
            return False

        from app.core.security import decrypt_token
        access_token = decrypt_token(token_row.encrypted_access_token)

        meta_api = MetaAPIService()
        try:
            if rule.delivery_mode == "interactive_button":
                # Step 1: Send initial message with "Send me the link" button
                await meta_api.send_private_reply(
                    comment_id=comment_id,
                    message_text=rule.initial_message,
                    token=access_token,
                    quick_reply_title=rule.button_text,
                )
            else:
                # Direct Link delivery
                full_msg = rule.initial_message
                if rule.payload_url:
                    full_msg = f"{full_msg}\n\n🔗 {rule.payload_url}"
                await meta_api.send_private_reply(
                    comment_id=comment_id,
                    message_text=full_msg,
                    token=access_token,
                )

            # Increment sent count
            rule.sent_dm_count += 1
            await self.session.execute(
                update(CommentDMRule)
                .where(CommentDMRule.id == rule.id)
                .values(sent_dm_count=rule.sent_dm_count)
            )
            await self.session.commit()
            logger.info("Successfully sent Comment-to-DM for comment_id=%s via rule_id=%s", comment_id, rule.id)
            return True

        except Exception as exc:
            logger.error("Failed to send Comment-to-DM for comment_id=%s: %s", comment_id, exc)
            return False
        finally:
            await meta_api.http_client.aclose()
