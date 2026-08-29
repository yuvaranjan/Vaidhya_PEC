"""
LLM provider — LM Studio (local, the offline claim) with a Groq fallback.

T1 task 2 (~1h). Behaviour that matters:
  - call LM Studio's OpenAI-compatible /chat/completions directly
  - if it exceeds EDGE_LLM_TIMEOUT_MS or errors, fall back to Groq and say so
  - the fallback must be visible in /health, never silent
"""

import logging
from typing import Protocol

import httpx
from groq import AsyncGroq

from config import get_settings
from model_settings import get_active

logger = logging.getLogger(__name__)


class LLMProvider(Protocol):
    async def complete(self, system: str, user: str, *, json_schema: dict | None = None) -> str:
        """Return the assistant message content. JSON mode when a schema is given."""
        ...

    async def healthy(self) -> bool: ...


class LMStudioProvider:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.groq_client = AsyncGroq(api_key=self.settings.groq_api_key) if self.settings.groq_api_key else None

    async def complete(self, system: str, user: str, *, json_schema: dict | None = None) -> str:
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]

        active = get_active()
        if active.provider == "gemini":
            return await self._complete_gemini(messages, active.model, json_schema)
        if active.provider == "groq":
            # Chosen explicitly from the settings page — this is primary, not
            # a fallback, so a Groq failure here is a real error, not a
            # reason to fall further back to anything.
            return await self._complete_groq(messages, active.model, json_schema)

        return await self._complete_lmstudio(messages, active.model, json_schema)

    async def _complete_lmstudio(
        self, messages: list[dict], model: str, json_schema: dict | None
    ) -> str:
        payload = {
            "model": model,
            "messages": messages,
            "temperature": 0.0,
        }

        if json_schema:
            msgs = [dict(m) for m in messages]
            has_json = any("json" in str(m.get("content", "")).lower() for m in msgs)
            if not has_json and msgs:
                msgs[0]["content"] = msgs[0]["content"] + "\n\nRespond in valid JSON."
            payload["messages"] = msgs
            # LM Studio rejects {"type": "json_object"} outright — it accepts
            # only "json_schema" or "text" and 400s on anything else, which
            # sent every structured call silently down the Groq fallback and
            # quietly broke the offline claim. Send the real schema instead;
            # it also pins the key names, which json_object never did.
            payload["response_format"] = {
                "type": "json_schema",
                "json_schema": {
                    "name": "structured_response",
                    "strict": True,
                    "schema": json_schema,
                },
            }

        # Use larger timeout (minimum 60s) for local GPU/CPU inference in LM Studio
        timeout = max(self.settings.edge_llm_timeout_ms / 1000.0, 60.0)

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(
                    f"{self.settings.edge_llm_url}/chat/completions",
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"]
        except Exception as e:
            logger.warning(f"[FALLBACK] LM Studio chat/completions failed ({e}), falling back to Groq...")
            if not self.groq_client:
                raise RuntimeError("LM Studio failed and GROQ_API_KEY is not set for fallback") from e
            return await self._complete_groq(messages, self.settings.groq_fallback_model, json_schema)

    async def _complete_groq(
        self, messages: list[dict], model: str, json_schema: dict | None
    ) -> str:
        if not self.groq_client:
            raise RuntimeError("GROQ_API_KEY is not set")
        try:
            msgs = [dict(m) for m in messages]
            completion_kwargs = {
                "model": model,
                "messages": msgs,
                "temperature": 0.0,
            }
            if json_schema:
                has_json = any("json" in str(m.get("content", "")).lower() for m in msgs)
                if not has_json and msgs:
                    msgs[0]["content"] = msgs[0]["content"] + "\n\nRespond in valid JSON."
                completion_kwargs["response_format"] = {"type": "json_object"}

            groq_resp = await self.groq_client.chat.completions.create(**completion_kwargs)
            return groq_resp.choices[0].message.content or ""
        except Exception as groq_e:
            logger.error(f"Groq call failed: {groq_e}")
            raise

    async def _complete_gemini(
        self, messages: list[dict], model: str, json_schema: dict | None
    ) -> str:
        if not self.settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not set")
            
        from google import genai
        from google.genai import types
        
        client = genai.Client(api_key=self.settings.gemini_api_key)
        
        system_instruction = None
        gemini_messages = []
        for m in messages:
            if m["role"] == "system":
                system_instruction = m["content"]
            else:
                gemini_messages.append(m["content"])
                
        config_kwargs = {}
        if system_instruction:
            config_kwargs["system_instruction"] = system_instruction
            
        if json_schema:
            config_kwargs["response_mime_type"] = "application/json"
            config_kwargs["response_schema"] = json_schema
            
        # Use sync call in thread or async when supported
        import asyncio
        loop = asyncio.get_event_loop()
        
        def run_gemini():
            return client.models.generate_content(
                model=model,
                contents=gemini_messages,
                config=types.GenerateContentConfig(**config_kwargs) if config_kwargs else None,
            )
            
        response = await loop.run_in_executor(None, run_gemini)
        return response.text

    async def healthy(self) -> bool:
        active = get_active()
        if active.provider == "gemini":
            return bool(self.settings.gemini_api_key)
        if active.provider == "groq":
            return bool(self.settings.groq_api_key)
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                resp = await client.get(f"{self.settings.edge_llm_url}/models")
                return resp.status_code == 200
        except Exception:
            return False


def get_llm() -> LLMProvider:
    return LMStudioProvider()
