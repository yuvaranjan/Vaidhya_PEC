"""
The MQTT consult relay (demo step 9).

Doctor types English on Node B → broker → here. This module translates it,
voices it in the patient's language, and parks it on the session. The patient
browser picks it up on the 2s poll it already makes, plays the audio, and the
patient's spoken reply comes back through /voice/turn — which calls
`answer_doctor` to publish the English text to the doctor's screen.

Both directions carry a message_id, because QoS 1 is at-least-once and the
doctor's client de-dupes on exactly this field.
"""

from __future__ import annotations

import logging
import uuid

from clock import now_iso
from contracts import DoctorQuestion, topic_patient_to_doctor
from mqtt_client import mqtt
from voicebot.session import Session, Turn, store
from consult_history import append as append_history

logger = logging.getLogger(__name__)


async def handle_doctor_question(visit_id: str, payload: dict) -> None:
    """Called from paho's thread via run_coroutine_threadsafe."""
    session = store.get(visit_id)
    if session is None:
        logger.warning("consult: question for unknown visit %s", visit_id)
        return

    text_en = (payload.get("text") or "").strip()
    if not text_en:
        return

    await ask_patient(session, text_en, message_id=payload.get("message_id"))


async def ask_patient(
    session: Session, text_en: str, message_id: str | None = None
) -> DoctorQuestion:
    """Translate, voice, and park a doctor question on the session."""
    from providers.translate import get_translate
    from providers.tts import get_tts

    try:
        text_native = await get_translate().to_native(text_en, session.language)
    except Exception:
        logger.exception("consult: translation failed, falling back to English")
        text_native = text_en

    try:
        audio_url = await get_tts().speak(text_native, session.language)
    except Exception:
        logger.exception("consult: TTS failed, question will be text-only")
        audio_url = ""

    question = DoctorQuestion(
        message_id=message_id or uuid.uuid4().hex,
        text_en=text_en,
        text_native=text_native,
        audio_url=audio_url,
        asked_at=now_iso(),
    )

    session.doctor_question = question.model_dump()
    session.turns.append(Turn(speaker="doctor", text_en=text_en, text_native=text_native))
    append_history(session.visit_id, "doctor", text_en, text_native, question.message_id)
    store.put(session)

    logger.info("consult: relayed doctor question to visit %s", session.visit_id)
    return question


def answer_doctor(session: Session, text_en: str) -> None:
    """
    Publish the patient's answer back. Called from /voice/turn once the session
    has a doctor question outstanding — which is also what clears it, so the
    patient is not asked the same thing on the next poll.
    """
    if not session.doctor_question:
        return

    answer = append_history(session.visit_id, "patient", text_en)
    mqtt.publish(
        topic_patient_to_doctor(session.visit_id),
        {
            "message_id": answer["message_id"],
            "sender": "patient_voicebot",
            "text": text_en,
            "timestamp": now_iso(),
        },
    )
    session.doctor_question = None
