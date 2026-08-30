"""
STT provider — Groq Whisper large-v3-turbo.

T1 task 3 (~1h). Returns BOTH the native-language transcript and an English one;
the UI shows them side by side and the LLM reasons over the English.
"""

import asyncio
from typing import NamedTuple, Protocol

from groq import AsyncGroq

from config import get_settings


class Transcript(NamedTuple):
    native: str
    english: str


class STTProvider(Protocol):
    async def transcribe(self, audio_bytes: bytes, language: str) -> Transcript: ...
    async def healthy(self) -> bool: ...


class GroqWhisperProvider:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.client = AsyncGroq(api_key=self.settings.groq_api_key) if self.settings.groq_api_key else None

    async def transcribe(self, audio_bytes: bytes, language: str) -> Transcript:
        if not self.client:
            raise RuntimeError("GROQ_API_KEY is not set.")

        # The browser records webm (MediaRecorder's default) — naming it
        # accurately, even though Groq tolerated "audio.wav" in practice.
        audio_file = ("audio.webm", audio_bytes)

        native_task = self.client.audio.transcriptions.create(
            file=audio_file,
            model=self.settings.groq_stt_model,
            language=language,
        )
        # Groq's /audio/translations endpoint only accepts whisper-large-v3 —
        # the turbo variant configured for transcription (GROQ_STT_MODEL)
        # rejects it with 400 "does not support translate". This is the one
        # call in the file that cannot follow that setting.
        english_task = self.client.audio.translations.create(
            file=audio_file,
            model="whisper-large-v3",
        )

        native_resp, english_resp = await asyncio.gather(native_task, english_task)

        return Transcript(
            native=native_resp.text,
            english=english_resp.text,
        )

    async def healthy(self) -> bool:
        return bool(self.settings.groq_api_key)


def get_stt() -> STTProvider:
    settings = get_settings()
    if getattr(settings, "stt_provider", "groq") == "sarvam":
        return SarvamSTTProvider()
    return GroqWhisperProvider()

class SarvamSTTProvider:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def transcribe(self, audio_bytes: bytes, language: str) -> Transcript:
        import httpx
        if not self.settings.sarvam_api_key:
            raise RuntimeError("SARVAM_API_KEY is not set.")

        headers = {"api-subscription-key": self.settings.sarvam_api_key}
        
        # sarvam language code mapping
        lang_map = {
            "hi": "hi-IN", "bn": "bn-IN", "kn": "kn-IN", "ml": "ml-IN", 
            "mr": "mr-IN", "od": "od-IN", "pa": "pa-IN", "ta": "ta-IN", 
            "te": "te-IN", "gu": "gu-IN", "en": "en-IN"
        }
        lang_code = lang_map.get(language, language)

        async with httpx.AsyncClient() as client:
            files_native = {"file": ("audio.webm", audio_bytes, "audio/webm")}
            data_native = {"model": "saaras:v3", "language_code": lang_code, "mode": "transcribe"}
            req_native = client.post("https://api.sarvam.ai/speech-to-text", headers=headers, data=data_native, files=files_native, timeout=30.0)
            
            files_english = {"file": ("audio.webm", audio_bytes, "audio/webm")}
            data_english = {"model": "saaras:v3", "language_code": lang_code, "mode": "translate"}
            req_english = client.post("https://api.sarvam.ai/speech-to-text", headers=headers, data=data_english, files=files_english, timeout=30.0)
            
            resp_native, resp_english = await asyncio.gather(req_native, req_english)
            
            resp_native.raise_for_status()
            resp_english.raise_for_status()
            
            native_text = resp_native.json().get("transcript", "")
            english_text = resp_english.json().get("transcript", "")
            
            return Transcript(native=native_text, english=english_text)

    async def healthy(self) -> bool:
        return bool(self.settings.sarvam_api_key)
