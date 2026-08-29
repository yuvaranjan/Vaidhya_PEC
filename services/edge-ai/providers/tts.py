"""
TTS provider — edge-tts. No API key, good Indic voices.

T1 task 4 (~1h). Writes an mp3 into AUDIO_DIR and returns the URL path that
main.py serves statically, e.g. "/audio/8f3a....mp3".
"""

import os
import uuid
from typing import Protocol

import edge_tts

from config import get_settings

# edge-tts voice per language. Verify these in the hour-2.5 risk spike —
# a voice name that does not exist fails at call time, not at import time.
VOICES = {
    "ml": "ml-IN-MidhunNeural",
    "ta": "ta-IN-ValluvarNeural",
    "hi": "hi-IN-MadhurNeural",
    "en": "en-IN-PrabhatNeural",
}


class TTSProvider(Protocol):
    async def speak(self, text: str, language: str) -> str:
        """Synthesize and return a URL path under /audio/."""
        ...

    async def healthy(self) -> bool: ...

class EdgeTTSProvider:
    def __init__(self) -> None:
        self.settings = get_settings()
        os.makedirs(self.settings.audio_dir, exist_ok=True)

    async def speak(self, text: str, language: str) -> str:
        import time, logging, asyncio
        logger = logging.getLogger(__name__)

        try:
            now = time.time()
            for f in os.listdir(self.settings.audio_dir):
                if f.endswith(".mp3"):
                    p = os.path.join(self.settings.audio_dir, f)
                    if os.path.isfile(p) and now - os.path.getmtime(p) > 3600:
                        os.remove(p)
        except Exception as e:
            logger.warning("TTS cleanup failed: %s", e)
            pass

        voice = VOICES.get(language, VOICES["en"])
        filename = f"{uuid.uuid4().hex}.mp3"
        filepath = os.path.join(self.settings.audio_dir, filename)
        
        communicate = edge_tts.Communicate(text, voice)
        try:
            await asyncio.wait_for(communicate.save(filepath), timeout=15.0)
        except Exception as e:
            logger.warning("TTS generation failed or timed out: %s", e)
            return ""
        
        return f"/audio/{filename}"

    async def healthy(self) -> bool:
        import asyncio, os, uuid
        filepath = os.path.join(self.settings.audio_dir, f"{uuid.uuid4().hex}_health.mp3")
        try:
            communicate = edge_tts.Communicate("test", VOICES["en"])
            await asyncio.wait_for(communicate.save(filepath), timeout=5.0)
            if os.path.exists(filepath):
                os.remove(filepath)
            return True
        except Exception:
            if os.path.exists(filepath):
                os.remove(filepath)
            return False


class ElevenLabsProvider:
    def __init__(self) -> None:
        self.settings = get_settings()
        os.makedirs(self.settings.audio_dir, exist_ok=True)
        from elevenlabs.client import AsyncElevenLabs
        self.client = AsyncElevenLabs(api_key=self.settings.elevenlabs_api_key)

    async def speak(self, text: str, language: str) -> str:
        import time, logging, asyncio
        logger = logging.getLogger(__name__)

        try:
            now = time.time()
            for f in os.listdir(self.settings.audio_dir):
                if f.endswith(".mp3"):
                    p = os.path.join(self.settings.audio_dir, f)
                    if os.path.isfile(p) and now - os.path.getmtime(p) > 3600:
                        os.remove(p)
        except Exception:
            pass

        # You can map languages to different ElevenLabs voices here
        # Example voice ID: Rachel (21m00Tcm4TlvDq8ikWAM)
        voice_id = "21m00Tcm4TlvDq8ikWAM"
        filename = f"{uuid.uuid4().hex}.mp3"
        filepath = os.path.join(self.settings.audio_dir, filename)
        
        try:
            generator = await self.client.text_to_speech.convert(
                voice_id=voice_id,
                output_format="mp3_44100_128",
                text=text,
                model_id="eleven_multilingual_v2",
            )
            
            with open(filepath, "wb") as f:
                async for chunk in generator:
                    if chunk:
                        f.write(chunk)
                        
            return f"/audio/{filename}"
        except Exception as e:
            logger.warning("ElevenLabs TTS failed: %s", e)
            return ""

    async def healthy(self) -> bool:
        return bool(self.settings.elevenlabs_api_key)

def get_tts() -> TTSProvider:
    settings = get_settings()
    if settings.tts_provider == "elevenlabs":
        return ElevenLabsProvider()
    return EdgeTTSProvider()
