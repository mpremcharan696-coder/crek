"""AI Agent service for reel analysis and comment reply generation.

Uses:
- **Google Gemini 2.5 Flash**: Video & Audio understanding for reel analysis ONLY.
- **Groq (Qwen 3.6-27B)**: Fast text LLM for comment reply generation via OpenAI-compatible API.
- **xAI Grok**: Real-time web context, called only when the LLM determines it's needed.
"""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any

import httpx
from google import genai
from google.genai import types

from app.core.config import settings

logger = logging.getLogger(__name__)


class AIAgentError(Exception):
    """Base exception for AI agent service errors."""


class AnalysisError(AIAgentError):
    """Raised when reel analysis fails."""


class ReplyGenerationError(AIAgentError):
    """Raised when reply generation fails."""


# System prompt template for reply generation
_REPLY_SYSTEM_PROMPT = """You are an AI assistant managing Instagram comments for {creator_name}.
Your personality and tone: {creator_style}.

You have been given the Reel Context summary. Use it to answer viewer questions.

DECISION WORKFLOW:
1. If you can answer using the Reel Context provided: answer directly.
2. If you CANNOT answer because you need real-time data (live prices, current news, scores, weather, etc.): respond with EXACTLY this JSON format and nothing else:
   {{"needs_realtime": true, "query": "the specific question to search for"}}
3. If you receive real-time data from a search, synthesize it into a natural reply.

RULES:
- Keep replies concise, natural, and matching the creator's tone.
- NEVER output robotic disclaimers such as "I don't have that info from the video" or "The video doesn't state that".
- If a question is about general tech, finance, or general knowledge, use your intelligence to give a helpful, concise answer as the creator.
- DO NOT use any emojis under any circumstances.
- If a user directly asks whether you are an AI or a bot, confirm honestly. Never claim to be human.
- Never share personal information about the creator beyond what's in the reel."""

VOICE_MODE_PROMPTS = {
    "witty": "Adopt a witty, clever persona with fast wordplay and sharp banter. Keep responses short, smart, and delightfully intelligent.",
    "funny": "Adopt a funny, humorous persona. Deliver playful punchlines, humorous takes, and lighthearted commentary while remaining helpful.",
    "roast": "Adopt a hilarious roast persona. Give cheeky, witty comebacks and playful burns to commenter questions. Keep it funny, lighthearted, and playful without being genuinely offensive or toxic.",
    "sarcastic": "Adopt a sarcastic persona with dry deadpan humor, cheeky irony, and witty retorts. Stay clever and funny.",
    "helpful_expert": "Adopt an authoritative, knowledgeable expert persona. Give clear, educational, confident answers that showcase domain mastery.",
    "casual_friend": "Adopt a warm, casual friend persona. Use friendly, conversational language like chatting with a close buddy.",
    "professional": "Adopt a polished, articulate, professional business persona. Be polite, clear, and customer-service ready.",
    "hype_friend": "Adopt an energetic hype-friend persona. Be super supportive, enthusiastic, exciting, and encouraging."
}



# System prompt for reel analysis
_ANALYSIS_SYSTEM_PROMPT = """You are an expert content analyst specializing in Instagram Reels.
Analyze the provided video and produce a structured JSON summary.

The creator's name is: {creator_name}

Please output the result as JSON containing these exact keys:
- "topic": string — main topic of the reel
- "products_mentioned": list of strings — any products, brands, or services mentioned
- "key_points": list of strings — main points or claims made
- "faq": list of objects with "question" and "answer" keys — anticipated viewer questions
- "context": string — broader context or background relevant to the content
- "creator_intent": string — what the creator likely aims to achieve
- "summary": string — concise 2-3 sentence summary of the reel"""


class AIAgentService:
    """Orchestrates AI analysis and reply generation.

    - **Google Gemini 2.5 Flash**: Strictly for Reel Video & Audio Analysis.
    - **Groq (Qwen 3.6-27B)**: Primary text LLM for comment reply generation.
    - **xAI Grok**: Real-time data provider, called only when needed.
    """

    def __init__(self) -> None:
        # Gemini 2.5 Flash — STRICTLY for Reel Video Analysis
        if not settings.GEMINI_API_KEY or "placeholder" in settings.GEMINI_API_KEY:
            logger.warning("GEMINI_API_KEY is missing or invalid.")
        self.gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.gemini_model = "gemini-2.5-flash"

        # Groq config
        self.groq_api_key = settings.GROQ_API_KEY
        self.groq_base_url = "https://api.groq.com/openai/v1"
        self.groq_model = "qwen/qwen3.6-27b"

        # xAI Grok config
        self.xai_api_key = settings.XAI_API_KEY
        self.xai_base_url = "https://api.x.ai/v1"
        self.grok_model = "grok-2-latest"

    # ------------------------------------------------------------------
    # Reel Analysis (Gemini 2.5 Flash ONLY)
    # ------------------------------------------------------------------

    async def analyze_reel(
        self,
        video_path: Path,
        caption: str | None,
        creator_name: str,
    ) -> dict[str, Any]:
        """Generate a structured AI summary of an Instagram Reel video using local extraction, Groq Whisper, and OpenRouter."""
        temp_audio = video_path.parent / f"temp_{video_path.stem}_audio.mp3"
        temp_frames_dir = video_path.parent / f"temp_{video_path.stem}_frames"
        temp_frames_dir.mkdir(parents=True, exist_ok=True)
        
        try:
            # 1. Extract audio via MoviePy
            logger.info("Extracting audio from video via MoviePy...")
            has_audio = False
            try:
                from moviepy import VideoFileClip
                video = VideoFileClip(str(video_path))
                if video.audio is not None:
                    video.audio.write_audiofile(
                        str(temp_audio),
                        fps=16000,
                        codec='libmp3lame',
                        logger=None
                    )
                    has_audio = True
                video.close()
            except Exception as e:
                logger.warning("MoviePy audio extraction failed: %s", e)

            # 2. Extract keyframes via OpenCV
            logger.info("Extracting 5 keyframes from video via OpenCV...")
            frames = []
            try:
                import cv2
                cap = cv2.VideoCapture(str(video_path))
                if cap.isOpened():
                    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                    if total_frames > 0:
                        interval = total_frames // 6
                        for i in range(5):
                            target_frame = interval * (i + 1)
                            cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
                            success, frame = cap.read()
                            if success:
                                frame_path = temp_frames_dir / f"frame_{i}.jpg"
                                cv2.imwrite(str(frame_path), frame)
                                frames.append(frame_path)
                    cap.release()
            except Exception as e:
                logger.warning("OpenCV keyframe extraction failed: %s", e)

            # 3. Audio Transcription (Groq Whisper)
            transcript = ""
            if has_audio and temp_audio.exists():
                logger.info("Transcribing audio via Groq Whisper API...")
                try:
                    url = f"{self.groq_base_url}/audio/transcriptions"
                    async with httpx.AsyncClient(timeout=60.0) as client:
                        with open(temp_audio, "rb") as f:
                            files = {
                                "file": (temp_audio.name, f, "audio/mpeg"),
                                "model": (None, "whisper-large-v3-turbo")
                            }
                            resp = await client.post(
                                url,
                                headers={"Authorization": f"Bearer {self.groq_api_key}"},
                                files=files
                            )
                        resp.raise_for_status()
                        transcript = resp.json().get("text", "")
                except Exception as e:
                    logger.warning("Groq Whisper transcription failed: %s", e)
            
            if not transcript:
                transcript = "[No speech / Background music only]"

            # 4. Multimodal Vision Analysis via OpenRouter
            logger.info("Calling OpenRouter multimodal API to analyze reel...")
            import base64
            openrouter_key = settings.OPENROUTER_API_KEY or "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"
            
            system_instruction = _ANALYSIS_SYSTEM_PROMPT.format(creator_name=creator_name)
            
            content = []
            prompt = (
                f"{system_instruction}\n\n"
                "Analyze the provided video frames and audio transcript of this social media reel.\n\n"
                f"Audio Transcript:\n{transcript}\n"
            )
            if caption:
                prompt += f"\nInstagram Caption:\n{caption}\n"
                
            prompt += (
                "\nGenerate a strictly valid JSON response with the following exact keys:\n"
                "- \"topic\": string (Main theme)\n"
                "- \"products_mentioned\": list of strings (All brand names and accessories)\n"
                "- \"key_points\": list of strings (3-5 bullet points)\n"
                "- \"faq\": list of dicts with keys \"q\" (question) and \"a\" (answer)\n"
                "- \"context\": string (Complete context description)\n"
                "- \"creator_intent\": string (Goal of the video)\n"
                "- \"summary\": string (Detailed narrative summary)\n\n"
                "Do NOT wrap in markdown block, output strictly raw JSON only."
            )
            content.append({"type": "text", "text": prompt})
            
            for frame in frames:
                if frame.exists():
                    with open(frame, "rb") as f:
                        encoded = base64.b64encode(f.read()).decode("utf-8")
                    content.append({
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{encoded}"}
                    })

            async with httpx.AsyncClient(timeout=90.0) as client:
                resp = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {openrouter_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://pilotly.ai",
                        "X-Title": "Pilotly Production Suite"
                    },
                    json={
                        "model": "google/gemini-2.5-flash",
                        "messages": [{"role": "user", "content": content}],
                        "max_tokens": 2000,
                        "response_format": {"type": "json_object"}
                    }
                )
                resp.raise_for_status()
                response_text = resp.json()["choices"][0]["message"]["content"]

            # Parse JSON robustly
            analysis = self._parse_json_robust(response_text)
            if not analysis:
                raise AnalysisError("Invalid JSON returned from OpenRouter model")

            # Ensure all required keys are present
            required_keys = {
                "topic", "products_mentioned", "key_points",
                "faq", "context", "creator_intent", "summary",
            }
            missing = required_keys - set(analysis.keys())
            if missing:
                for key in missing:
                    analysis[key] = [] if key in ("products_mentioned", "key_points", "faq") else ""

            # 5. Real-time Context enrichment using Grok, with Tavily fallback
            topic = analysis.get("topic", "")
            products = analysis.get("products_mentioned", [])
            
            if topic or products:
                products_str = ", ".join(products) if products else "none"
                search_query = (
                    f"Find the latest real-time context, news, current pricing, and details about "
                    f"products: [{products_str}] or topic: [{topic}] in relation to this post context: {caption or ''}"
                )
                
                realtime_data = ""
                if self.xai_api_key:
                    realtime_data = await self._fetch_from_grok(search_query)
                if not realtime_data and settings.TAVILY_API_KEY:
                    realtime_data = await self._fetch_from_tavily(search_query)
                
                if realtime_data:
                    analysis["realtime_context"] = realtime_data
                    orig_context = analysis.get("context", "")
                    analysis["context"] = f"{orig_context}\n\n[Real-time Search Context]: {realtime_data}".strip()

            return analysis

        except Exception as exc:
            logger.error("Reel analysis failed: %s", exc, exc_info=True)
            return {
                "error": f"Summary generation failed: {str(exc)}",
                "topic": "Failed",
                "summary": f"Failed to generate summary: {str(exc)}",
                "products_mentioned": [],
                "key_points": [],
                "faq": [],
                "context": f"Error: Summary generation failed: {str(exc)}",
                "creator_intent": "Failed",
                "realtime_context": None
            }

        finally:
            # Cleanup temp files
            if temp_audio.exists():
                try: temp_audio.unlink()
                except Exception: pass
            if temp_frames_dir.exists():
                for f in temp_frames_dir.glob("*"):
                    try: f.unlink()
                    except Exception: pass
                try: temp_frames_dir.rmdir()
                except Exception: pass


    # ------------------------------------------------------------------
    # Groq Chat Completion (direct httpx call)
    # ------------------------------------------------------------------

    async def _call_groq(self, messages: list[dict[str, str]]) -> str:
        """Send a chat completion request to Groq's OpenAI-compatible API."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self.groq_base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.groq_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.groq_model,
                    "messages": messages,
                    "temperature": 0.3,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            choices = data.get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content", "")
        return ""



    # ------------------------------------------------------------------
    # xAI Grok Real-Time Fetch (direct httpx call)
    # ------------------------------------------------------------------

    async def _fetch_from_grok(self, query: str) -> str:
        """Fetch real-time info from xAI Grok. Returns empty string on failure."""
        if not self.xai_api_key:
            return ""

        try:
            logger.info("Fetching real-time context from xAI Grok: '%s'", query[:80])
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{self.xai_base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.xai_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.grok_model,
                        "messages": [
                            {
                                "role": "system",
                                "content": "Provide concise, factual real-time information.",
                            },
                            {"role": "user", "content": query},
                        ],
                        "temperature": 0.1,
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    choices = data.get("choices", [])
                    if choices:
                        return choices[0].get("message", {}).get("content", "")
                else:
                    logger.warning("xAI Grok returned status %s: %s", resp.status_code, resp.text)
        except Exception as e:
            logger.warning("xAI Grok fetch failed: %s", e)

        return ""

    # ------------------------------------------------------------------
    # Tavily Web Search (direct httpx call, fallback for Grok)
    # ------------------------------------------------------------------

    async def _fetch_from_tavily(self, query: str) -> str:
        """Fetch search context from Tavily. Returns empty string on failure."""
        tavily_key = settings.TAVILY_API_KEY
        if not tavily_key:
            return ""

        try:
            logger.info("Fetching real-time context from Tavily search: '%s'", query[:80])
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    "https://api.tavily.com/search",
                    headers={"Content-Type": "application/json"},
                    json={
                        "api_key": tavily_key,
                        "query": query,
                        "search_depth": "basic",
                        "include_answer": True,
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    answer = data.get("answer")
                    if answer:
                        return answer
                    # Fallback to listing snippet results if no direct answer is provided
                    results = data.get("results", [])
                    if results:
                        snippets = [
                            f"- {r.get('title')}: {r.get('content')} ({r.get('url')})"
                            for r in results[:3]
                        ]
                        return "\n".join(snippets)
                else:
                    logger.warning("Tavily returned status %s: %s", resp.status_code, resp.text)
        except Exception as e:
            logger.warning("Tavily search fetch failed: %s", e)

        return ""

    # ------------------------------------------------------------------
    # Reply Generation (Groq + optional Grok real-time context)
    # ------------------------------------------------------------------

    async def generate_reply(
        self,
        comment: str,
        reel_summary: dict[str, Any],
        creator_style: str | None,
        creator_name: str,
        conversation_history: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Generate an intelligent reply. Groq decides if real-time data is needed."""
        try:
            style = creator_style or "friendly, helpful, and conversational"
            
            try:
                style_json = json.loads(style)
                b_name = style_json.get("business_name", creator_name)
                industry = style_json.get("industry", "general")
                audience = style_json.get("audience", "general public")
                knowledge = style_json.get("knowledge", "")
                persona = style_json.get("persona", "")
                tone = style_json.get("tone_description", "")
                formality = style_json.get("formality", 3)
                sig_phrases = style_json.get("signature_phrases", [])
                avoid_w = style_json.get("avoid_words", [])
                avoid_t = style_json.get("avoid_topics", [])
                dm_t = style_json.get("dm_topics", [])
                
                system_prompt = f"""You are an AI assistant managing Instagram comments for {b_name} (Industry: {industry}).
Your audience: {audience}
Your persona: {persona}
Your tone: {tone} (Formality level: {formality}/5)
Knowledge base: {knowledge}

You have been given the Reel Context summary. Use it to answer viewer questions.

DECISION WORKFLOW:
1. If you can answer using the Reel Context provided: answer directly.
2. If you CANNOT answer because you need real-time data (live prices, current news, scores, weather, etc.): respond with EXACTLY this JSON format and nothing else:
   {{"needs_realtime": true, "query": "the specific question to search for"}}
3. If you receive real-time data from a search, synthesize it into a natural reply.

RULES:
- Keep replies very short, concise, and natural (1 to 2 sentences max).
- NEVER output robotic disclaimers such as "I don't have that info from the video" or "The video doesn't mention that".
- If a question is about general tech, GPUs, finance, or general knowledge, use your intelligence to give a helpful, concise answer as the creator.
- DO NOT use any emojis under any circumstances.
- If a user directly asks whether you are an AI or a bot, confirm honestly. Never claim to be human.
- Never share personal information about the creator beyond what's in the reel.
"""

                mode = style_json.get("mode") or style_json.get("tone_mode") or ""
                mode_instruction = VOICE_MODE_PROMPTS.get(mode.lower().strip(), "")
                if mode_instruction:
                    system_prompt += f"\nVOICE MODE INSTRUCTION ({mode.upper()}): {mode_instruction}\n"


                if sig_phrases:
                    system_prompt += f"- Consider using these signature phrases naturally: {', '.join(sig_phrases)}\n"
                if avoid_w:
                    system_prompt += f"- DO NOT use these words: {', '.join(avoid_w)}\n"
                if avoid_t:
                    system_prompt += f"- DO NOT discuss these topics: {', '.join(avoid_t)}\n"
                if dm_t:
                    system_prompt += f"- For these topics, suggest sending a DM instead of answering fully: {', '.join(dm_t)}\n"
            except json.JSONDecodeError:
                system_prompt = _REPLY_SYSTEM_PROMPT.format(
                    creator_name=creator_name,
                    creator_style=style,
                )

            reel_context_str = json.dumps(reel_summary, indent=2, ensure_ascii=False)

            messages: list[dict[str, str]] = [
                {"role": "system", "content": system_prompt},
            ]

            if conversation_history:
                for msg in conversation_history:
                    messages.append({
                        "role": msg.get("role", "user"),
                        "content": msg.get("content", ""),
                    })

            messages.append({
                "role": "user",
                "content": (
                    f"[REEL CONTEXT]\n{reel_context_str}\n\n"
                    f"Viewer comment: \"{comment}\"\n\n"
                    f"Reply as {creator_name}."
                ),
            })

            # Step 1: Ask Groq (Qwen) to reply or request real-time data
            response_text = await self._call_groq(messages)
            response_text = self._clean_reply_text(response_text)
            used_web_search = False

            # Step 2: Check if the LLM requested real-time data
            if response_text.strip().startswith("{") and "needs_realtime" in response_text:
                try:
                    decision = json.loads(response_text)
                    if decision.get("needs_realtime"):
                        query = decision.get("query", comment)
                        realtime_data = await self._fetch_from_grok(query)

                        if realtime_data:
                            used_web_search = True
                            messages.append({"role": "assistant", "content": response_text})
                            messages.append({
                                "role": "user",
                                "content": f"[REAL-TIME DATA]\n{realtime_data}\n\nNow reply naturally.",
                            })
                            response_text = await self._call_groq(messages)
                            response_text = self._clean_reply_text(response_text)
                except json.JSONDecodeError:
                    pass  # Not a JSON request, treat as normal reply

            if not response_text:
                raise ReplyGenerationError("No reply generated")

            result = {
                "reply_text": response_text,
                "used_web_search": used_web_search,
                "reasoning": f"Generated via Groq"
                             f"{' + xAI Grok' if used_web_search else ''}",
            }

            safe_text = response_text.encode("ascii", "ignore").decode("ascii")
            logger.info("Generated reply (grok=%s): %s", used_web_search, safe_text[:100])
            return result

        except ReplyGenerationError:
            raise
        except Exception as exc:
            logger.error("Reply generation failed: %s", exc, exc_info=True)
            raise ReplyGenerationError(f"Reply generation failed: {exc}") from exc

    async def analyze_voice_profile_from_content(
        self,
        profile_name: str,
        bio: str,
        captions: list[str],
    ) -> dict[str, Any]:
        """Use Groq (Qwen) to analyze profile info and captions, returning a structured JSON voice profile."""
        captions_str = "\n---\n".join(captions[:5]) if captions else "No reel captions available yet."
        prompt = f"""You are an expert social media brand analyst.
Analyze this Instagram creator profile and produce a structured JSON voice profile.

Creator Profile Name: {profile_name}
Bio: {bio if bio else "N/A"}
Recent Post/Reel Captions:
{captions_str}

Please output ONLY a valid JSON object with these exact keys:
- "business_name": string (e.g. "{profile_name}")
- "industry": string (e.g. "Finance creator", "Tech / SaaS", "Beauty & Skincare", "Fitness & Health", etc.)
- "audience": string (2-sentence description of who this account serves)
- "knowledge": string (2-3 paragraphs detailing what the creator does, their products/topics, hours/policies, FAQs)
- "persona": string ("founder", "creator", "brand", "expert", or "custom")
- "tone_description": string (1-2 sentence description of their tone)
- "formality": integer (1 to 5)
- "signature_phrases": list of strings (2-4 phrases typical for this creator)
- "avoid_words": list of strings (2-3 words/cliches to avoid)
- "avoid_topics": list of strings (2-3 topics to avoid publicly)
- "dm_topics": list of strings (2-3 topics to redirect to DM)

Do NOT include any markdown block syntax or explanation, output ONLY the JSON object."""

        messages = [
            {
                "role": "system",
                "content": (
                    "You are an expert social media brand analyst. You MUST analyze the creator's exact profile details, bio, and content captions "
                    "to generate a 100% unique voice profile tailored specifically to their brand, niche, and audience. Do NOT use generic or template responses. "
                    "You output strictly valid JSON objects only."
                ),
            },
            {"role": "user", "content": prompt},
        ]
        
        raw_res = await self._call_groq(messages)
        parsed = self._parse_json_robust(raw_res)
        
        if parsed and isinstance(parsed, dict):
            return parsed

        # Dynamic fallback derived specifically from the creator's profile name and bio
        bio_desc = bio.strip() if bio else f"Content creator {profile_name}"
        return {
            "business_name": profile_name,
            "industry": f"{profile_name} Niche & Content",
            "audience": f"Followers and community members interested in {bio_desc}.",
            "knowledge": f"{profile_name} produces content around: {bio_desc}. Always provide helpful, accurate responses matching this topic focus.",
            "persona": "creator",
            "tone_description": "Engaging, helpful, and conversational.",
            "formality": 3,
            "signature_phrases": [f"Thanks for watching!", f"Stay tuned!"],
            "avoid_words": ["Spam", "Unverified claims"],
            "avoid_topics": ["Off-topic discussions", "Private personal information"],
            "dm_topics": ["Collaborations", "Direct business inquiries"],
        }


    @staticmethod
    def _parse_json_robust(text: str) -> dict[str, Any] | None:
        """Parse JSON with cleanup for common LLM formatting issues."""
        import re
        import json
        cleaned = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
        idx = cleaned.find("{")
        if idx != -1:
            try:
                obj, _ = json.JSONDecoder(strict=False).raw_decode(cleaned[idx:])
                if isinstance(obj, dict):
                    return obj
            except Exception as err:
                logger.warning("raw_decode failed: %s", err)

        try:
            return json.loads(cleaned, strict=False)
        except Exception:
            return None



    @staticmethod
    def _clean_reply_text(text: str) -> str:
        """Remove thinking tags and other artifacts from the reply text."""
        import re
        cleaned = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
        cleaned = re.sub(r"<\/?think>", "", cleaned)
        cleaned = cleaned.strip()
        return cleaned if cleaned else text.strip()

