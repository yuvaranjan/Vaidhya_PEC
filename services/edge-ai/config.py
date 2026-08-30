"""Environment configuration for edge-ai. Copy .env.example to .env first."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- identity -----------------------------------------------------
    jurisdiction_id: str = "jur_thrissur_01"

    # --- providers ----------------------------------------------------
    stt_provider: str = "groq"
    tts_provider: str = "edge_tts"
    translate_provider: str = "bank"
    edge_llm_provider: str = "lmstudio"

    edge_llm_url: str = "http://127.0.0.1:8080/v1"
    edge_llm_model: str = "medgemma"
    edge_llm_fallback: str = "groq"
    edge_llm_timeout_ms: int = 5_000

    groq_api_key: str = ""
    groq_stt_model: str = "whisper-large-v3-turbo"
    groq_fallback_model: str = "llama-3.3-70b-versatile"
    
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-pro"
    
    elevenlabs_api_key: str = ""

    # --- timing -------------------------------------------------------
    # Demo value. Production is 90s (architecture §5.4) — a nurse cannot
    # perform a physical check in 20 seconds, but a judge will not wait 90.
    on_demand_timeout_seconds: int = 20

    # A small local model (the offline story) does not reliably follow a
    # "wrap up by question N" instruction on its own — verified by testing
    # the identical conversation twice and getting different turn counts.
    # This is the deterministic backstop: past this many patient turns, the
    # code forces complete_intake regardless of what the model decides, so
    # the report is guaranteed to generate rather than merely likely to.
    max_intake_turns: int = 6

    # --- data ---------------------------------------------------------
    actian_vectorai_url: str = ""
    actian_vectorai_token: str = ""
    actian_vectorai_collection_prefix: str = "vaidhya_"
    actian_vectorai_dimension: int = 8
    edge_db_path: str = "edge.db"
    audio_dir: str = "audio_tmp"

    # --- mqtt ---------------------------------------------------------
    mqtt_url: str = ""
    mqtt_username: str = ""
    mqtt_password: str = ""

    # --- cors ---------------------------------------------------------
    web_origin: str = "http://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    return Settings()
