/**
 * SEAM A — HTTP contract: patient browser (T2) → edge-ai (T1), same laptop.
 *
 * FROZEN IN HOUR 1. If a field here changes, both T1 and T2 change together,
 * in the same five minutes, and it gets announced. Nothing else is shared.
 *
 * Python mirror: services/edge-ai/contracts.py — keep them identical.
 * Reference: Docs/Project_Vaidhya_V1_Build_Plan.md §2.1 / §2.3
 */

export type Language = "ml" | "ta" | "hi" | "en";

export type VitalsPhase = "pass_one_baseline" | "on_demand";

export type SessionPhase =
  | "pass_one"
  | "conversation"
  | "awaiting_finding"
  | "complete";

export type NextAction =
  | "ask_question"
  | "request_nurse_finding"
  | "complete_intake";

export type UrgencyLevel = "routine" | "elevated" | "urgent";

/** The five vitals the nurse enters on the dashboard (pass one). */
export const VITAL_TYPES = [
  "temperature",
  "blood_pressure",
  "pulse",
  "spo2",
  "respiratory_rate",
] as const;
export type VitalType = (typeof VITAL_TYPES)[number];

export interface VitalReadingInput {
  type: VitalType | string;
  value_numeric?: number;
  /** Used for non-numeric readings, e.g. blood_pressure "120/80". */
  value_text?: string;
  /** Temperature input unit; edge storage and rules use Celsius. */
  unit?: "celsius" | "fahrenheit";
}

export interface UrgencyFlag {
  rule_id: string;
  description: string;
}

export interface UrgencyTier {
  tier: UrgencyLevel;
  flags: UrgencyFlag[];
  flag_count: number;
}

/** A nurse action the bot paused to request mid-conversation. */
export interface PendingFinding {
  reading_id: string;
  type: string;
  instruction_en: string;
  elapsed_s?: number;
  status?: "requested" | "reminded";
}

/* ------------------------------------------------------------------ */
/* POST /session/start                                                 */
/* ------------------------------------------------------------------ */

export interface SessionStartRequest {
  visit_id: string;
  patient_id: string;
  language: Language;
}

export interface SessionStartResponse {
  session_id: string;
  greeting_text_en: string;
  greeting_text_native: string;
  greeting_audio_url: string;
}

/* ------------------------------------------------------------------ */
/* POST /vitals                                                        */
/* ------------------------------------------------------------------ */

export interface VitalsRequest {
  visit_id: string;
  phase: VitalsPhase;
  readings: VitalReadingInput[];
  /**
   * The nurse enters vitals before the language picker on the consult screen,
   * so this is often the first call of a visit. Sending these lets the edge
   * service open the session itself instead of 404-ing. Added after the
   * freeze, additively — see contracts.py for the mirror.
   */
  patient_id?: string;
  language?: Language;
}

export interface VitalsResponse {
  ok: boolean;
  fired_flags: UrgencyFlag[];
}

/* ------------------------------------------------------------------ */
/* POST /voice/turn/text   — typed-answer fallback (architecture R7)   */
/* ------------------------------------------------------------------ */

export interface VoiceTurnTextRequest {
  visit_id: string;
  text_en: string;
}

/* ------------------------------------------------------------------ */
/* POST /voice/turn   (multipart: audio=<webm blob>, visit_id=<string>) */
/* ------------------------------------------------------------------ */

export interface TurnResponse {
  transcript_native: string;
  transcript_en: string;
  bot_text_en: string;
  bot_text_native: string;
  bot_audio_url: string;
  next_action: NextAction;
  pending_finding: PendingFinding | null;
  intake_done: boolean;
}

/* ------------------------------------------------------------------ */
/* GET /session/{visit_id}/state   — poll every 2s                     */
/* ------------------------------------------------------------------ */

/**
 * A question the doctor sent over MQTT, already translated and voiced by the
 * edge service. The patient browser cannot subscribe to MQTT itself, so it
 * picks these up on its existing 2s poll.
 */
export interface DoctorQuestion {
  message_id: string;
  text_en: string;
  text_native: string;
  audio_url: string;
  asked_at: string;
}

export interface SessionState {
  visit_id: string;
  phase: SessionPhase;
  pending_finding: PendingFinding | null;
  turn_count: number;
  /** Added after the freeze, additively — see contracts.py for the mirror. */
  doctor_question?: DoctorQuestion | null;
}

/* ------------------------------------------------------------------ */
/* POST /intake/complete                                               */
/* ------------------------------------------------------------------ */

export interface IntakeCompleteRequest {
  visit_id: string;
}

export interface IntakeCompleteResponse {
  report_id: string;
  chief_complaint: string;
  summary_text: string;
  urgency_tier: UrgencyTier;
}

/* ------------------------------------------------------------------ */
/* POST /consult/ask   — TEST CONVENIENCE ONLY (real path is MQTT)     */
/* ------------------------------------------------------------------ */

export interface ConsultAskRequest {
  visit_id: string;
  question_en: string;
}

/* ------------------------------------------------------------------ */
/* GET /health                                                         */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* GET/POST /settings/model   — runtime model selection                 */
/* ------------------------------------------------------------------ */

export type ModelProvider = "lmstudio" | "groq";

export interface ModelOption {
  id: string;
  provider: ModelProvider;
  label: string;
}

export interface ModelsResponse {
  current: string;
  provider: ModelProvider;
  available: ModelOption[];
}

export interface SetModelRequest {
  model: string;
  provider: ModelProvider;
}

export type ServiceStatus = "ok" | "down";

export interface HealthResponse {
  llm: ServiceStatus;
  stt: ServiceStatus;
  tts: ServiceStatus;
  translate: ServiceStatus;
  mqtt: ServiceStatus;
}
