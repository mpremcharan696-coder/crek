from fastapi import APIRouter
from pydantic import BaseModel
import httpx
from app.core.config import settings

router = APIRouter()

class DemoReplyRequest(BaseModel):
    comment: str
    product_context: str

class DemoReplyResponse(BaseModel):
    reply: str

@router.post("/draft-reply", response_model=DemoReplyResponse)
async def draft_reply(request: DemoReplyRequest):
    system_prompt = "You are a helpful assistant writing a reply to an Instagram comment. Keep it concise."
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Product Context: {request.product_context}\n\nComment: {request.comment}"}
    ]
    
    groq_api_key = settings.GROQ_API_KEY
    if hasattr(groq_api_key, "get_secret_value"):
        groq_api_key = groq_api_key.get_secret_value()
        
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {groq_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "qwen/qwen3.6-27b",
                "messages": messages,
                "temperature": 0.7,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        choices = data.get("choices", [])
        reply_text = ""
        if choices:
            reply_text = choices[0].get("message", {}).get("content", "")
            
    return DemoReplyResponse(reply=reply_text)
