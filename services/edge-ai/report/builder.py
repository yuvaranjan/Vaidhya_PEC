"""
Diagnostic report builder + Supabase write (T1 task 10, ~1h).

On /intake/complete, do BOTH:
  1. write the report to Supabase — the durable record, so the queue survives a
     refresh and a doctor who logs in late still sees the visit
  2. publish to vaidhya/queue/new (retained) — so the doctor's queue updates
     live without polling

Neither replaces the other. About 30 lines for both.
"""

import json
import logging
import sqlite3
import uuid

from clock import now_iso
from config import get_settings
from contracts import TOPIC_QUEUE_NEW, IntakeCompleteResponse, UrgencyFlag
from mqtt_client import mqtt
from providers.llm import get_llm
from rules.engine import tier_for
from sync.worker import enqueue, flush_outbox
from voicebot.session import Session

logger = logging.getLogger(__name__)

SUMMARY_PROMPT = """You are Vaidhya, a clinical intake summarizer for a rural telemedicine service.

Return valid JSON with EXACTLY these two keys and no others:
  "chief_complaint": one line, the presenting problem in clinical language.
  "summary_text": one paragraph (3-5 sentences) for the reviewing doctor. State
    symptom onset and duration, severity as the patient reported it, the
    baseline vitals that matter, and any urgency flags that fired.

Write the summary from the transcript and vitals you are given. Never answer
with a placeholder such as "No summary." — if the transcript is thin, say what
little is known and name what is still missing."""

# Models routinely return the right prose under a different key. Map the ones
# seen in practice back onto the contract rather than discarding a good summary
# and falling through to the mechanical fallback.
_CHIEF_KEYS = ("chief_complaint", "chiefComplaint", "chief complaint", "complaint")
_SUMMARY_KEYS = (
    "summary_text",
    "summaryText",
    "summary",
    "paragraph_summary",
    "paragraphSummary",
    "assessment",
)


def _first_usable(parsed: dict, keys: tuple[str, ...]) -> str | None:
    for key in keys:
        value = parsed.get(key)
        if not _is_placeholder(value):
            return value.strip()  # type: ignore[union-attr]
    return None


def _fallback_report(session: Session) -> dict[str, str]:
    patient_turns = [t.text_en for t in session.turns if t.speaker == "patient"]
    clinical_turns = [
        f"{t.speaker}: {t.text_en}"
        for t in session.turns
        if t.speaker in {"patient", "nurse", "doctor"}
    ]
    vitals = []
    for reading in session.vitals:
        value = reading.get("value_text")
        if value is None:
            value = reading.get("value_numeric")
        if reading.get("type") == "temperature":
            vitals.append(f"temperature {value} C")
        elif reading.get("type") == "blood_pressure":
            vitals.append(f"blood pressure {value} mmHg")
        elif reading.get("type") == "pulse":
            vitals.append(f"heart rate {value} bpm")
        elif reading.get("type") == "spo2":
            vitals.append(f"SpO2 {value}%")
        elif reading.get("type") == "respiratory_rate":
            vitals.append(f"respiratory rate {value}/min")

    chief = patient_turns[0] if patient_turns else "Patient intake completed"
    details = "; ".join(clinical_turns) or "No patient-reported symptoms were recorded."
    vital_text = ", ".join(vitals) or "No baseline vitals recorded."
    return {
        "chief_complaint": chief,
        "summary_text": (
            f"Patient intake completed. Conversation findings: {details}. "
            f"Baseline vitals: {vital_text}."
        ),
    }


def _is_placeholder(value: object) -> bool:
    if not isinstance(value, str):
        return True
    normalized = value.strip().lower()
    return not normalized or normalized in {
        "no detailed summary.",
        "no detailed summary",
        "no summary.",
        "no summary",
        "could not generate",
        "could not generate summary.",
    }

async def build_and_publish(session: Session) -> IntakeCompleteResponse:
    llm = get_llm()
    settings = get_settings()

    # 1. Summary from LLM
    prompt = (
        "Baseline vitals (already measured; temperature is Celsius):\n"
        + "\n".join(json.dumps(v) for v in session.vitals)
        + "\n\nUrgency flags:\n"
        + "\n".join(f.get("description", "") for f in session.fired_flags)
        + "\n\nTranscript:\n"
        + "\n".join(f"{t.speaker}: {t.text_en}" for t in session.turns)
    )
    schema = {
        "type": "object",
        "properties": {
            "chief_complaint": {"type": "string"},
            "summary_text": {"type": "string"}
        },
        "required": ["chief_complaint", "summary_text"]
    }
    
    fallback = _fallback_report(session)
    chief_complaint: str | None = None
    summary_text: str | None = None

    try:
        resp_text = await llm.complete(SUMMARY_PROMPT, prompt, json_schema=schema)
        parsed = json.loads(resp_text)
        if not isinstance(parsed, dict):
            raise ValueError("LLM returned JSON that is not an object")

        chief_complaint = _first_usable(parsed, _CHIEF_KEYS)
        summary_text = _first_usable(parsed, _SUMMARY_KEYS)

        # Only the summary is worth failing over. A missing chief complaint is
        # recoverable from the first patient turn; a missing summary is the
        # whole point of the call.
        if summary_text is None:
            raise ValueError(
                f"LLM returned no usable summary (keys: {sorted(parsed)})"
            )
    except Exception as e:
        logger.warning("Report summary generation fell back to transcript: %s", e)

    chief_complaint = chief_complaint or fallback["chief_complaint"]
    summary_text = summary_text or fallback["summary_text"]

    # 2. Urgency
    flags = [UrgencyFlag(**f) for f in session.fired_flags] if session.fired_flags else []
    tier = tier_for(flags)

    report_id = uuid.uuid4().hex

    # 3. Local SQLite is the system of record. Supabase is downstream of the
    #    outbox — this function never waits on the network.
    transcript = [
        {"speaker": t.speaker, "text_en": t.text_en, "text_native": t.text_native}
        for t in session.turns
    ]
    generated_at = now_iso()

    report_row = {
        "report_id": report_id,
        "visit_id": session.visit_id,
        "transcript": transcript,
        "vitals_snapshot": session.vitals,
        "urgency_tier": tier.model_dump(),
        "chief_complaint": chief_complaint,
        "summary_text": summary_text,
        "generated_at": generated_at,
    }

    with sqlite3.connect(settings.edge_db_path) as conn:
        conn.execute(
            "update visits set status = 'awaiting_doctor' where visit_id = ?",
            (session.visit_id,),
        )
        conn.execute(
            "insert into diagnostic_reports (report_id, visit_id, transcript, "
            "vitals_snapshot, urgency_tier, chief_complaint, summary_text, "
            "generated_at) values (?,?,?,?,?,?,?,?)",
            (
                report_id,
                session.visit_id,
                json.dumps(transcript),
                json.dumps(session.vitals),
                tier.model_dump_json(),
                chief_complaint,
                summary_text,
                generated_at,
            ),
        )

        # The status change and the report are two separate rows in the queue so
        # the doctor's list flips to awaiting_doctor even if the report itself
        # is rejected downstream.
        enqueue(
            conn,
            "visits",
            session.visit_id,
            {
                "visit_id": session.visit_id,
                "status": "awaiting_doctor",
                "language": session.language,
                "patient_id": session.patient_id or None,
                "edge_jurisdiction_id": settings.jurisdiction_id,
            },
        )
        enqueue(conn, "diagnostic_reports", report_id, report_row)

    # session.phase is NOT forced to complete here, so early reports don't stop the bot.

    # 4. Best-effort immediate drain, so an online demo shows the queue update
    #    instantly instead of waiting up to a tick. Offline this fails in
    #    milliseconds and the backlog stays queued.
    try:
        await flush_outbox()
    except Exception:
        logger.info("intake/complete: immediate flush failed, left queued")

    # 5. MQTT publish for the live queue update (no-op without a broker).
    mqtt.publish(
        TOPIC_QUEUE_NEW,
        {
            "visit_id": session.visit_id,
            "patient_name": "Anjali Menon",
            "chief_complaint": chief_complaint,
            "summary_text": summary_text,
            "status": "awaiting_doctor",
            "urgency": tier.tier,
            "urgency_tier": tier.model_dump(),
            "generated_at": generated_at,
        },
        retain=True,
    )

    return IntakeCompleteResponse(
        report_id=report_id,
        chief_complaint=chief_complaint,
        summary_text=summary_text,
        urgency_tier=tier
    )
