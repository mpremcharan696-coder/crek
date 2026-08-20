"""Video processing pipeline: downloading reels for Gemini API analysis.

Uses httpx to stream-download Instagram Reel videos to a temporary file.
The temporary file path is yielded so that the caller can upload it to Gemini
and then clean it up afterwards.
"""

from __future__ import annotations

import logging
import tempfile
from pathlib import Path
from typing import AsyncGenerator

import httpx

logger = logging.getLogger(__name__)


class MediaProcessorError(Exception):
    """Base exception for media processing failures."""


class MediaProcessor:
    """Processes Instagram Reels by downloading them for external API upload.
    
    Yields the local path to the downloaded MP4 file. The file is automatically
    deleted when the async generator exits.
    """

    def __init__(self) -> None:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        self.http_client = httpx.AsyncClient(timeout=120.0, headers=headers)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def download_reel(self, media_url: str) -> AsyncGenerator[Path, None]:
        """Stream-download a video file to a temporary location.
        
        Yields the Path to the downloaded MP4 file. The temporary directory
        and the file are automatically cleaned up when the generator closes.

        Args:
            media_url: Public URL of the reel video.

        Yields:
            Path object pointing to the downloaded local .mp4 file.

        Raises:
            MediaProcessorError: If the download fails.
        """
        with tempfile.TemporaryDirectory(prefix="pilotly_reel_") as tmpdir:
            tmp_path = Path(tmpdir)
            video_path = tmp_path / "input.mp4"

            try:
                logger.info("Downloading reel video from %s", media_url[:80])
                await self._download_video(media_url, video_path)
                
                # Yield the path to the caller so they can use the file
                yield video_path
                
            except MediaProcessorError:
                raise
            except Exception as exc:
                logger.error("Reel download failed: %s", exc, exc_info=True)
                raise MediaProcessorError(f"Reel download failed: {exc}") from exc

    # ------------------------------------------------------------------
    # Download
    # ------------------------------------------------------------------

    async def _download_video(self, url: str, dest: Path) -> None:
        """Stream-download a video file to disk.

        Args:
            url: Public video URL.
            dest: Destination file path.

        Raises:
            MediaProcessorError: If the download fails.
        """
        try:
            async with self.http_client.stream("GET", url) as response:
                response.raise_for_status()
                with open(dest, "wb") as f:
                    async for chunk in response.aiter_bytes(chunk_size=65_536):
                        f.write(chunk)
        except httpx.HTTPError as exc:
            raise MediaProcessorError(f"Failed to download video: {exc}") from exc

        file_size = dest.stat().st_size
        if file_size == 0:
            raise MediaProcessorError("Downloaded video file is empty")
        logger.debug("Downloaded video: %s (%.2f MB)", dest.name, file_size / 1_048_576)

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self.http_client.aclose()
