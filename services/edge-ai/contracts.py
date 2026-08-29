"""
The frozen contracts, Python side.

TypeScript mirror: packages/shared/http.ts and packages/shared/mqtt.ts.
If a field changes here it changes there too, in the same five minutes.

Reference: Docs/Project_Vaidhya_V1_Build_Plan.md §2
"""

from typing import Literal

from pydantic import BaseModel, Field

Language = Literal["ml", "ta", "hi", "en"]
VitalsPhase = Literal["pass_one_baseline", "on_demand"]
SessionPhase = Literal["pass_one", "conversation", "awaiting_finding", "complete"]
NextAction = Literal["ask_question", "request_nurse_finding", "complete_intake"]
UrgencyLevel = Literal["routine", "elevated", "urgent"]
ServiceStatus = Literal["ok", "down"]

VITAL_TYPES = ("temperature", "blood_pressure", "pulse", "spo2", "respiratory_rate")


class VitalReadingInput(BaseModel):
    type: str
    value_numeric: float | None = None
    value_text: str | None = None
    # Temperature is entered as Fahrenheit in the nurse UI but stored and
    # evaluated canonically as Celsius at the edge.
    unit: Literal["celsius", "fahrenheit"] | None = None


class UrgencyFlag(BaseModel):
    rule_id: str
    description: str


class UrgencyTier(BaseModel):
    tier: UrgencyLevel
    flags: list[UrgencyFlag] = Field(default_factory=list)
    flag_count: int = 0


class PendingFinding(BaseModel):
    reading_id: str
    type: str
    instruction_en: str
    elapsed_s: int | None = None
    status: Literal["requested", "reminded"] | None = None


# --- POST /session/start ------------------------------------------------


class SessionStartRequest(BaseModel):
    visit_id: str
    patient_id: str
    language: Language


class SessionStartResponse(BaseModel):
    session_id: str
    greeting_text_en: str
    greeting_text_native: str
    greeting_audio_url: str


# --- POST /vitals -------------------------------------------------------


class VitalsRequest(BaseModel):
    visit_id: str
    phase: VitalsPhase
    readings: list[VitalReadingInput]
    # The nurse enters vitals before the language picker on the consult screen,
    # so /vitals is often the first call of a visit. These let it open the
    # session itself rather than 404. Added after the freeze, additively —
    # mirrored in packages/shared/http.ts.
    patient_id: str | None = None
    language: Language | None = None


class VitalsResponse(BaseModel):
    ok: bool
    fired_flags: list[UrgencyFlag] = Field(default_factory=list)


# --- POST /voice/turn/text  (typed-answer fallback, R7) ------------------


class VoiceTurnTextRequest(BaseModel):
    visit_id: str
    text_en: str


# --- POST /voice/turn ---------------------------------------------------


class TurnResponse(BaseModel):
    transcript_native: str
    transcript_en: str
    bot_text_en: str
    bot_text_native: str
    bot_audio_url: str
    next_action: NextAction
    pending_finding: PendingFinding | None = None
    intake_done: bool = False


# --- GET /session/{visit_id}/state --------------------------------------


class DoctorQuestion(BaseModel):
    """
    A doctor's MQTT question, already translated and voiced here on the edge.
    The patient browser has no broker connection, so it collects these on the
    2s session poll it is already making.
    """

    message_id: str
    text_en: str
    text_native: str
    audio_url: str
    asked_at: str


class SessionState(BaseModel):
    visit_id: str
    phase: SessionPhase
    pending_finding: PendingFinding | None = None
    turn_count: int = 0
    # Added after the freeze, additively — mirrored in packages/shared/http.ts.
    doctor_question: DoctorQuestion | None = None


# --- POST /intake/complete ----------------------------------------------


class IntakeCompleteRequest(BaseModel):
    visit_id: str


class IntakeCompleteResponse(BaseModel):
    report_id: str
    chief_complaint: str
    summary_text: str
    urgency_tier: UrgencyTier


# --- POST /consult/ask  (test convenience only; real path is MQTT) ------


class ConsultAskRequest(BaseModel):
    visit_id: str
    question_en: str


# --- GET/POST /settings/model  (runtime model selection) -----------------

ModelProvider = Literal["lmstudio", "groq"]


class ModelOption(BaseModel):
    id: str
    provider: ModelProvider
    label: str


class ModelsResponse(BaseModel):
    current: str
    provider: ModelProvider
    available: list[ModelOption] = Field(default_factory=list)


class SetModelRequest(BaseModel):
    model: str
    provider: ModelProvider


# --- GET /health --------------------------------------------------------


class HealthResponse(BaseModel):
    llm: ServiceStatus = "down"
    stt: ServiceStatus = "down"
    tts: ServiceStatus = "down"
    translate: ServiceStatus = "down"
    mqtt: ServiceStatus = "down"


# --- Seam B topics (mirror of packages/shared/mqtt.ts) ------------------

TOPIC_QUEUE_NEW = "vaidhya/queue/new"


def topic_doctor_to_patient(visit_id: str) -> str:
    return f"vaidhya/consult/{visit_id}/doctor_to_patient"


def topic_patient_to_doctor(visit_id: str) -> str:
    return f"vaidhya/consult/{visit_id}/patient_to_doctor"


def topic_status(visit_id: str) -> str:
    return f"vaidhya/consult/{visit_id}/status"


def edge_client_id(jurisdiction_id: str) -> str:
    return f"vaidhya-edge-{jurisdiction_id}"
