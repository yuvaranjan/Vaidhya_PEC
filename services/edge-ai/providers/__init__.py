"""
Provider abstraction (architecture §4).

Every external capability sits behind a Protocol so the implementation can be
swapped by an env var — and so a provider that is down degrades one feature
instead of taking the service with it.

T1 build order: llm → stt → tts → translate.
"""

from .llm import LLMProvider, get_llm
from .stt import STTProvider, get_stt
from .translate import TranslateProvider, get_translate
from .tts import TTSProvider, get_tts

__all__ = [
    "LLMProvider",
    "STTProvider",
    "TTSProvider",
    "TranslateProvider",
    "get_llm",
    "get_stt",
    "get_tts",
    "get_translate",
]
