import os
import sys
import json
import base64
import asyncio
import httpx
from pathlib import Path

# Configured API Keys (Replace with your keys if they change)
GROQ_API_KEY = "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"
OPENROUTER_API_KEY = "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"
GEMINI_API_KEY = "AIzaSyAMOHd8FhDzfpkRIEnWGP85Z3MutjEd8oo"

OPENROUTER_MODEL = "google/gemini-2.5-flash"

def extract_audio(video_path: Path, output_audio_path: Path) -> bool:
    """Extracts audio track from video file using MoviePy."""
    print("[WAIT] Extracting audio from video using MoviePy...")
    try:
        from moviepy import VideoFileClip
        video = VideoFileClip(str(video_path))
        if video.audio is not None:
            video.audio.write_audiofile(
                str(output_audio_path),
                fps=16000,
                codec='libmp3lame',
                logger=None
            )
            video.close()
            print(f"[SUCCESS] Audio extracted to: {output_audio_path}")
            return True
        else:
            print("[ERROR] Video contains no audio track.")
            video.close()
            return False
    except Exception as e:
        print(f"[ERROR] Error extracting audio via MoviePy: {e}")
        return False

def extract_keyframes(video_path: Path, output_dir: Path, num_frames: int = 5) -> list[Path]:
    """Extracts evenly spaced keyframes from the video using OpenCV (cv2)."""
    print(f"[WAIT] Extracting {num_frames} keyframes using OpenCV...")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        import cv2
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            print("[ERROR] Could not open video file with OpenCV.")
            return []
            
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_frames <= 0:
            print("[ERROR] Total frames is zero or negative.")
            cap.release()
            return []
            
        frames = []
        interval = total_frames // (num_frames + 1)
        
        for i in range(num_frames):
            target_frame = interval * (i + 1)
            cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
            success, frame = cap.read()
            
            if success:
                frame_path = output_dir / f"frame_{i}.jpg"
                cv2.imwrite(str(frame_path), frame)
                frames.append(frame_path)
                
        cap.release()
        print(f"[SUCCESS] Extracted {len(frames)} keyframes using OpenCV.")
        return frames
    except Exception as e:
        print(f"[ERROR] Error extracting keyframes via OpenCV: {e}")
        return []

async def transcribe_audio_groq(audio_path: Path) -> str:
    """Calls Groq Whisper API to transcribe audio file."""
    print("[WAIT] Transcribing audio via Groq Whisper API...")
    url = "https://api.groq.com/openai/v1/audio/transcriptions"
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}"}
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        with open(audio_path, "rb") as f:
            files = {
                "file": (audio_path.name, f, "audio/mpeg"),
                "model": (None, "whisper-large-v3-turbo")
            }
            resp = await client.post(url, headers=headers, files=files)
            
        if resp.status_code != 200:
            print(f"[ERROR] Groq Whisper API Error: {resp.text}")
            return ""
            
        data = resp.json()
        transcript = data.get("text", "")
        print("[SUCCESS] Audio Transcription complete.")
        return transcript

async def transcribe_audio_gemini(audio_path: Path) -> str:
    """Calls Google Gemini API to transcribe audio file."""
    print("[WAIT] Transcribing audio via Google Gemini 2.5 Flash...")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    
    with open(audio_path, "rb") as f:
        encoded = base64.b64encode(f.read()).decode("utf-8")
        
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "inlineData": {
                            "mimeType": "audio/mp3",
                            "data": encoded
                        }
                    },
                    {
                        "text": "Please transcribe the speech in this audio file exactly word for word. If there is only background music or no speech, describe what sounds or audio elements are present."
                    }
                ]
            }
        ]
    }
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(url, json=payload)
        
    if resp.status_code != 200:
        print(f"[ERROR] Gemini API Error: {resp.text}")
        return ""
        
    data = resp.json()
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        print("[SUCCESS] Gemini Transcription complete.")
        return text.strip()
    except Exception as e:
        print(f"[ERROR] Parsing Gemini response: {e}")
        return ""

async def analyze_video_openrouter(transcript: str, frames: list[Path]) -> str:
    """Calls OpenRouter vision model to analyze video keyframes & audio transcript."""
    print(f"[WAIT] Analyzing content via OpenRouter ({OPENROUTER_MODEL})...")
    url = "https://openrouter.ai/api/v1/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://pilotly.ai",
        "X-Title": "Pilotly Test Suite"
    }
    
    content = []
    if frames:
        prompt = (
            "Analyze the provided video frames and audio transcript of this social media reel.\n\n"
            f"Audio Transcript:\n{transcript}\n\n"
            "Generate a structured summary containing:\n"
            "1. Topic / Theme\n"
            "2. Products Mentioned\n"
            "3. Key Points\n"
            "4. FAQ (Viewer questions and answers)"
        )
        content.append({"type": "text", "text": prompt})
        
        for frame in frames:
            with open(frame, "rb") as f:
                encoded = base64.b64encode(f.read()).decode("utf-8")
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{encoded}"}
            })
    else:
        content = (
            "You are an expert content analyzer. Analyze the following transcript of a creator's social media video:\n\n"
            f"Transcript:\n{transcript}\n\n"
            "Generate a structured summary containing:\n"
            "1. Topic / Theme\n"
            "2. Products Mentioned\n"
            "3. Key Points\n"
            "4. FAQ (Viewer questions and answers)"
        )
        
    async with httpx.AsyncClient(timeout=90.0) as client:
        resp = await client.post(
            url,
            headers=headers,
            json={
                "model": OPENROUTER_MODEL,
                "messages": [{"role": "user", "content": content}],
                "max_tokens": 1500
            }
        )
        
    if resp.status_code != 200:
        print(f"[ERROR] OpenRouter API Error: {resp.text}")
        return ""
        
    data = resp.json()
    result = data["choices"][0]["message"]["content"]
    print("[SUCCESS] Content analysis complete.")
    return result

async def main():
    if len(sys.argv) < 2:
        print("Usage: python test_reel_analysis_models.py <path_to_file>")
        return
        
    input_file = Path(sys.argv[1])
    if not input_file.exists():
        print(f"Error: Input file does not exist: {input_file}")
        return
        
    is_audio_only = input_file.suffix.lower() in ['.mp3', '.wav', '.m4a', '.flac', '.ogg']
    audio_file = input_file
    frames = []
    temp_frames_dir = None
    
    if not is_audio_only:
        temp_audio = input_file.parent / "temp_audio.mp3"
        temp_frames_dir = input_file.parent / "temp_frames"
        
        audio_ok = extract_audio(input_file, temp_audio)
        if audio_ok and temp_audio.exists():
            audio_file = temp_audio
            
        frames = extract_keyframes(input_file, temp_frames_dir)
        
    try:
        # Audio Transcription
        groq_transcript = await transcribe_audio_groq(audio_file)
        print(f"\n--- [Groq Whisper Transcript] ---\n{groq_transcript}\n")
        
        gemini_transcript = await transcribe_audio_gemini(audio_file)
        print(f"\n--- [Google Gemini Transcript] ---\n{gemini_transcript}\n")
        
        best_transcript = gemini_transcript if len(gemini_transcript) > len(groq_transcript) else groq_transcript
        
        # Analyze Content
        if best_transcript or frames:
            analysis = await analyze_video_openrouter(best_transcript, frames)
            print(f"\n--- [Model Analysis Output] ---\n{analysis}\n")
            
    finally:
        # Cleanup temp assets
        if not is_audio_only:
            if audio_file.exists() and audio_file != input_file:
                try: audio_file.unlink()
                except Exception: pass
            if temp_frames_dir and temp_frames_dir.exists():
                for f in temp_frames_dir.glob("*"):
                    try: f.unlink()
                    except Exception: pass
                try: temp_frames_dir.rmdir()
                except Exception: pass

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
