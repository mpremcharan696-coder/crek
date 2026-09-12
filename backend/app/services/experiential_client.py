"""Experiential Gateway client for claude-fable-5.

Speaks the OpenAI Chat Completions API via the Experiential Gateway.
"""

from __future__ import annotations

import os
from typing import Any
import httpx

from app.core.config import settings

def get_experiential_api_key() -> str:
    """Retrieve the Experiential API key or raise an instructive error."""
    key = settings.EXPLABS_API_KEY or os.getenv("EXPLABS_API_KEY", "")
    if not key:
        raise RuntimeError(
            "EXPLABS_API_KEY environment variable is not set. "
            "Please create one under Settings -> API keys and export it."
        )
    return key


class ExperientialClient:
    """OpenAI-compatible Chat Completions client pointing to the Experiential Gateway."""

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        model: str | None = None,
    ) -> None:
        self.base_url = (base_url or settings.EXPERIENTIAL_BASE_URL).rstrip("/")
        self.api_key = api_key or get_experiential_api_key()
        self.model = model or getattr(settings, "EXPERIENTIAL_MODEL_FABLE", "claude-fable-5")

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def create_chat_completion(
        self,
        messages: list[dict[str, Any]],
        temperature: float | None = None,
        stream: bool = False,
        tools: list[dict[str, Any]] | None = None,
        tool_choice: Any | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Send a chat completion request to the gateway."""
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "stream": stream,
            **kwargs,
        }
        if temperature is not None:
            payload["temperature"] = temperature
        if tools:
            payload["tools"] = tools
        if tool_choice:
            payload["tool_choice"] = tool_choice

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions",
                headers=self._headers(),
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()
