from fastapi import APIRouter
from pydantic import BaseModel
import httpx
from app.core.config import settings
from app.services.ai_agent_service import VOICE_MODE_PROMPTS

router = APIRouter()

class DemoReplyRequest(BaseModel):
    comment: str
    product_context: str | None = ""
    mode: str | None = "casual_friend"
    tone: str | None = ""
    business_name: str | None = ""
    persona: str | None = ""
    knowledge: str | None = ""

class DemoReplyResponse(BaseModel):
    reply: str
    mode_used: str

@router.post("/draft-reply", response_model=DemoReplyResponse)
async def draft_reply(request: DemoReplyRequest):
    selected_mode = (request.mode or "casual_friend").lower().strip()
    mode_prompt = VOICE_MODE_PROMPTS.get(selected_mode, VOICE_MODE_PROMPTS.get("casual_friend", ""))
    
    b_name = request.business_name or "the account owner"
    ctx = request.knowledge or request.product_context or ""
    
    system_prompt = f"""You are an AI assistant managing Instagram comments for {b_name}.
{mode_prompt}

RULES:
- Keep reply very short, concise, and natural (1 to 2 sentences max).
- NEVER output robotic disclaimers such as "I don't have that info from the video" or "The video doesn't mention that".
- DO NOT use any emojis under any circumstances.
- Never claim to be human if asked.
"""
    if ctx:
        system_prompt += f"\nContext/Knowledge: {ctx}\n"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Comment: \"{request.comment}\"\n\nReply as {b_name}."}
    ]
    
    keys_to_try = [
        k for k in [
            settings.GROQ_API_KEY,
            getattr(settings, "GROQ_API_KEY_SECONDARY", "")
        ] if k and "placeholder" not in k
    ]

    reply_text = ""
    for api_key in keys_to_try:
        if hasattr(api_key, "get_secret_value"):
            api_key = api_key.get_secret_value()
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "qwen/qwen3.6-27b",
                        "messages": messages,
                        "temperature": 0.7,
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    choices = data.get("choices", [])
                    if choices:
                        raw_content = choices[0].get("message", {}).get("content", "")
                        import re
                        cleaned = re.sub(r"<think>.*?</think>", "", raw_content, flags=re.DOTALL)
                        cleaned = re.sub(r"<\/?think>", "", cleaned).strip()
                        reply_text = cleaned if cleaned else raw_content.strip()
                        break
        except Exception:
            continue

    if not reply_text:
        reply_text = "Thanks for your comment! Appreciate the support."
        
    return DemoReplyResponse(reply=reply_text, mode_used=selected_mode)


