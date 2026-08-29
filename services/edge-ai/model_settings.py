"""
Runtime-overridable LLM model selection.

`config.Settings` is frozen at startup (env-derived, cached via @lru_cache) —
right for API keys and URLs, wrong for "the nurse just picked a bigger model
from the settings page" mid-demo. This is a separate, mutable store so that
choice takes effect on the very next turn, no restart.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from config import get_settings

Provider = Literal["lmstudio", "groq", "gemini"]


@dataclass
class ActiveModel:
    provider: Provider
    model: str


_active: ActiveModel | None = None


def get_active() -> ActiveModel:
    global _active
    if _active is None:
        s = get_settings()
        provider: Provider = "groq" if s.edge_llm_provider == "groq" else "lmstudio"
        _active = ActiveModel(provider=provider, model=s.edge_llm_model)
    return _active


def set_active(provider: Provider, model: str) -> None:
    global _active
    _active = ActiveModel(provider=provider, model=model)
