"""State-first patient intake with the original voice, translation and doctor relay."""
from __future__ import annotations

import json
import logging

from contracts import TurnResponse
from providers.llm import get_llm
from providers.stt import get_stt
from providers.translate import get_translate
from providers.tts import get_tts
from voicebot.clinical_state import CORE_SLOTS, compact_context, ensure_state, merge_slot_updates, next_required_slot
from voicebot.session import Session, Turn, as_contract
from voicebot.state_prompts import EXTRACTOR_PROMPT, EXTRACTOR_SCHEMA, QUESTIONER_PROMPT, QUESTIONER_SCHEMA

logger = logging.getLogger(__name__)
FALLBACK_QUESTIONS = {
    "complaint": "What brings you to the clinic today?",
    "onset": "When did this problem start?",
    "severity": "How severe is it right now, on a scale of 1 to 10?",
    "history": "Do you have any relevant medical history, allergies, or regular medicines?",
}


def _json(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = "\n".join(line for line in raw.splitlines() if not line.strip().startswith("```"))
    value = json.loads(raw)
    return value if isinstance(value, dict) else {}


async def _extract(session: Session, utterance: str) -> None:
    target = next_required_slot(session.clinical_state)
    if target == "severity":
        import re
        match = re.fullmatch(r"\s*(10|[0-9])\s*(?:/\s*10)?\s*", utterance)
        if match:
            session.clinical_state = merge_slot_updates(session.clinical_state, [{"slot": "severity", "value": f"{match.group(1)}/10"}])
            return
    try:
        request = json.dumps({"utterance_en": utterance, "target_slot": target, "target_slot_definition": CORE_SLOTS.get(target or ""), "allowed_slots": list(CORE_SLOTS), "state": compact_context(session.clinical_state)})
        reply = await get_llm().complete(EXTRACTOR_PROMPT, request, json_schema=EXTRACTOR_SCHEMA)
        session.clinical_state = merge_slot_updates(session.clinical_state, _json(reply).get("updates"), target_slot=target)
    except Exception as exc:
        logger.warning("clinical extraction failed: %s", exc)


async def _next_question(session: Session) -> tuple[str, str]:
    target = next_required_slot(session.clinical_state)
    if target is None:
        return "", "complete_intake"
    fallback = FALLBACK_QUESTIONS[target]
    try:
        request = json.dumps({"target_slot": target, "slot_definition": CORE_SLOTS[target], "state": compact_context(session.clinical_state)})
        question = _json(await get_llm().complete(QUESTIONER_PROMPT, request, json_schema=QUESTIONER_SCHEMA)).get("question_en")
        if not isinstance(question, str) or not question.strip():
            question = fallback
    except Exception as exc:
        logger.warning("question generation failed: %s", exc)
        question = fallback
    return question.strip()[:400], "ask_question"


async def run_turn(session: Session, audio_bytes: bytes) -> TurnResponse:
    try:
        transcript = await get_stt().transcribe(audio_bytes, session.language)
        return await run_text_turn(session, transcript.english, transcript.native)
    except Exception as exc:
        logger.error("STT failed: %s", exc)
        return TurnResponse(transcript_native="", transcript_en="", bot_text_en="I'm having trouble hearing you. Please type your answer.", bot_text_native="I'm having trouble hearing you. Please type your answer.", bot_audio_url="", next_action="ask_question", pending_finding=as_contract(session.pending_finding), intake_done=False)


async def run_text_turn(session: Session, text_en: str, text_native: str | None = None) -> TurnResponse:
    text_native = text_native or text_en
    session.clinical_state = ensure_state(session.clinical_state)
    is_doctor_reply = session.doctor_question is not None
    session.turns.append(Turn(speaker="patient_to_doctor" if is_doctor_reply else "patient", text_en=text_en, text_native=text_native))
    translate, tts = get_translate(), get_tts()

    if is_doctor_reply:
        acknowledgement = "I have sent your reply to the doctor."
        native = await translate.to_native(acknowledgement, session.language)
        audio = await tts.speak(native, session.language)
        session.turns.append(Turn(speaker="bot", text_en=acknowledgement, text_native=native))
        return TurnResponse(transcript_native=text_native, transcript_en=text_en, bot_text_en=acknowledgement, bot_text_native=native, bot_audio_url=audio, next_action="ask_question", pending_finding=as_contract(session.pending_finding), intake_done=False)

    await _extract(session, text_en)
    question, action = await _next_question(session)
    native = await translate.to_native(question, session.language) if question else ""
    audio = await tts.speak(native, session.language) if native else ""
    if question:
        session.turns.append(Turn(speaker="bot", text_en=question, text_native=native))
    session.phase = "complete" if action == "complete_intake" else "conversation"
    return TurnResponse(transcript_native=text_native, transcript_en=text_en, bot_text_en=question, bot_text_native=native, bot_audio_url=audio, next_action=action, pending_finding=as_contract(session.pending_finding), intake_done=action == "complete_intake")
