"""
Translate provider — question_bank cache lookup, then IndicTrans2 (or the LLM).

T1 task 5 (~1.5h). The cache is an optimisation, not a source of truth:
A CACHE MISS IS NORMAL, NOT AN ERROR. The system runs correctly with the
question_bank table completely empty.
"""

import re
import sqlite3
from typing import Protocol

from config import get_settings
from providers.llm import get_llm


def cache_key(text_en: str) -> str:
    """Normalisation used as question_bank.cache_key: lowercased, punctuation stripped."""
    return re.sub(r"[^a-z0-9 ]", "", text_en.lower()).strip()


# A small model does not reliably read "ml" as Malayalam — asked to translate
# into "ml" it tends to rephrase in English instead. Naming the language, and
# the script it is written in, is what makes the cache-miss path actually
# produce Indic text.
LANGUAGE_NAMES = {
    "ml": ("Malayalam", "Malayalam script"),
    "ta": ("Tamil", "Tamil script"),
    "hi": ("Hindi", "Devanagari script"),
    "en": ("English", "Latin script"),
}


def language_name(code: str) -> str:
    return LANGUAGE_NAMES.get(code, (code, "its native script"))[0]


def _script(code: str) -> str:
    return LANGUAGE_NAMES.get(code, (code, "its native script"))[1]


def _looks_latin(text: str) -> bool:
    """True if the text is essentially all ASCII — i.e. not Indic script."""
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return True
    return sum(1 for c in letters if ord(c) < 128) / len(letters) > 0.8


class TranslateProvider(Protocol):
    async def to_native(self, text_en: str, language: str) -> str: ...
    async def to_english(self, text_native: str, language: str) -> str: ...
    async def healthy(self) -> bool: ...


class BankThenModelProvider:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.llm = get_llm()
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.settings.edge_db_path) as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS question_bank (
                    cache_key TEXT PRIMARY KEY,
                    text_en TEXT NOT NULL,
                    text_hi TEXT,
                    text_ta TEXT,
                    text_ml TEXT
                )
            ''')

    def _get_db(self):
        conn = sqlite3.connect(self.settings.edge_db_path)
        conn.row_factory = sqlite3.Row
        return conn

    async def to_native(self, text_en: str, language: str) -> str:
        key = cache_key(text_en)
        col = f"text_{language}"
        
        with self._get_db() as conn:
            cur = conn.cursor()
            try:
                cur.execute(f"SELECT {col} FROM question_bank WHERE cache_key = ?", (key,))
                row = cur.fetchone()
                if row and row[col]:
                    return row[col]
            except sqlite3.OperationalError:
                pass

        # Cache miss — normal, not an error.
        if language == "en":
            return text_en

        prompt = (
            f"You are a medical translator. Translate the English text into "
            f"{language_name(language)}, written in {_script(language)}. "
            f"Return ONLY the {language_name(language)} translation — no "
            f"explanation, no markdown, no quotes, no English."
        )
        translated = await self.llm.complete(prompt, text_en)
        translated = translated.strip()

        # If the model handed back English anyway, keep the English rather than
        # caching a bad translation — the UI shows both languages, so a visible
        # untranslated line is honest. Silently caching it would make the miss
        # permanent.
        if not translated or _looks_latin(translated):
            return text_en

        # Write back
        with self._get_db() as conn:
            cur = conn.cursor()
            try:
                cur.execute(f"""
                    INSERT INTO question_bank (cache_key, text_en, {col})
                    VALUES (?, ?, ?)
                    ON CONFLICT(cache_key) DO UPDATE SET {col}=excluded.{col}
                """, (key, text_en, translated))
                conn.commit()
            except sqlite3.OperationalError:
                pass

        return translated

    async def to_english(self, text_native: str, language: str) -> str:
        if language == "en":
            return text_native
        prompt = (
            f"You are a medical translator. Translate the following "
            f"{language_name(language)} text into English. Return ONLY the "
            f"English translation — no explanation, markdown, or quotes."
        )
        translated = await self.llm.complete(prompt, text_native)
        return translated.strip()

    async def healthy(self) -> bool:
        return True  # the cache path always works, even when empty


def get_translate() -> TranslateProvider:
    return BankThenModelProvider()
