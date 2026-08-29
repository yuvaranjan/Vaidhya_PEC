/**
 * THE MOCK LAYER — highest-value file T2 writes all night.
 *
 * With NEXT_PUBLIC_USE_MOCK_AI=true, T2 can build and fully style the entire
 * patient flow before T1's model has finished downloading. Every response below
 * is in EXACTLY the shape defined in @vaidhya/shared/http. When T1 is ready,
 * flip the flag to false; if the contract held, it just works.
 *
 * Rule: if you change a shape here, you are changing the contract. Tell T1.
 * Reference: Docs/Project_Vaidhya_V1_Build_Plan.md §2.4
 */

import type {
  HealthResponse,
  IntakeCompleteResponse,
  SessionStartRequest,
  SessionStartResponse,
  SessionState,
  TurnResponse,
  VitalsRequest,
  VitalsResponse,
} from "@vaidhya/shared";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Per-visit turn counter, so the mock can script a multi-turn conversation. */
const turns = new Map<string, number>();
/** Set when the mock asks for a nurse finding; cleared when one is submitted. */
const pending = new Map<string, SessionState["pending_finding"]>();

const GREETINGS: Record<string, { native: string; en: string }> = {
  ml: {
    native: "നമസ്കാരം, എന്താണ് നിങ്ങളുടെ പ്രശ്നം?",
    en: "Hello, what brings you in today?",
  },
  ta: {
    native: "வணக்கம், உங்கள் பிரச்சனை என்ன?",
    en: "Hello, what brings you in today?",
  },
  hi: {
    native: "नमस्ते, आपकी क्या तकलीफ़ है?",
    en: "Hello, what brings you in today?",
  },
  en: { native: "Hello, what brings you in today?", en: "Hello, what brings you in today?" },
};

/** Scripted conversation. Turn 3 pauses for a nurse finding; turn 5 ends intake. */
const SCRIPT: Array<Pick<TurnResponse, "transcript_native" | "transcript_en" | "bot_text_en" | "bot_text_native">> = [
  {
    transcript_native: "വയറുവേദന രണ്ട് ദിവസമായി",
    transcript_en: "stomach pain for two days",
    bot_text_en: "Has the pain moved to the lower right side?",
    bot_text_native: "വേദന വലതു വശത്തേക്ക് മാറിയോ?",
  },
  {
    transcript_native: "അതെ, ഇന്നലെ മുതൽ",
    transcript_en: "yes, since yesterday",
    bot_text_en: "Have you had any fever or vomiting along with it?",
    bot_text_native: "പനിയോ ഛർദ്ദിയോ ഉണ്ടായിരുന്നോ?",
  },
  {
    transcript_native: "ചെറിയ പനി ഉണ്ട്",
    transcript_en: "there is a mild fever",
    bot_text_en:
      "I need the nurse to gently press the lower right abdomen and release. Please tell me if that hurts more on release.",
    bot_text_native:
      "നഴ്സ് വലത് അടിവയറ്റിൽ അമർത്തി വിടണം. വിടുമ്പോൾ വേദന കൂടുന്നുണ്ടോ എന്ന് പറയുക.",
  },
  {
    transcript_native: "വേദന കൂടുന്നുണ്ട്",
    transcript_en: "the pain increases",
    bot_text_en: "Are you able to eat and drink normally?",
    bot_text_native: "സാധാരണ പോലെ ഭക്ഷണം കഴിക്കാൻ കഴിയുന്നുണ്ടോ?",
  },
  {
    transcript_native: "ഇല്ല, വിശപ്പില്ല",
    transcript_en: "no, I have no appetite",
    bot_text_en: "Thank you. I have enough to prepare a summary for the doctor.",
    bot_text_native: "നന്ദി. ഡോക്ടർക്കുള്ള റിപ്പോർട്ട് തയ്യാറാക്കാൻ മതിയായ വിവരം ഉണ്ട്.",
  },
];

/** A short silent mp3 would go here; an empty string keeps <audio> harmless. */
const MOCK_AUDIO_URL = "";

export const mockAi = {
  async sessionStart(req: SessionStartRequest): Promise<SessionStartResponse> {
    await sleep(300);
    turns.set(req.visit_id, 0);
    pending.delete(req.visit_id);
    const g = GREETINGS[req.language] ?? GREETINGS.en;
    return {
      session_id: `mock_sess_${req.visit_id}`,
      greeting_text_en: g.en,
      greeting_text_native: g.native,
      greeting_audio_url: MOCK_AUDIO_URL,
    };
  },

  async vitals(req: VitalsRequest): Promise<VitalsResponse> {
    await sleep(200);
    const fired: VitalsResponse["fired_flags"] = [];
    for (const r of req.readings) {
      const temperatureC =
        r.type === "temperature" && r.value_numeric != null && r.unit === "fahrenheit"
          ? ((r.value_numeric - 32) * 5) / 9
          : r.value_numeric;
      if (r.type === "spo2" && (r.value_numeric ?? 100) < 92) {
        fired.push({
          rule_id: "rule_spo2_low",
          description: `low SpO2 (${r.value_numeric}%)`,
        });
      }
      if (r.type === "temperature" && (temperatureC ?? 0) >= 38.5) {
        fired.push({
          rule_id: "rule_fever_high",
          description: `high fever (${temperatureC?.toFixed(1)}°C)`,
        });
      }
    }
    return { ok: true, fired_flags: fired };
  },

  async voiceTurn(visitId: string, _audio?: Blob): Promise<TurnResponse> {
    await sleep(1200); // roughly the real round trip, so the UI's loading state gets exercised
    const n = (turns.get(visitId) ?? 0) + 1;
    turns.set(visitId, n);

    const line = SCRIPT[Math.min(n, SCRIPT.length) - 1];
    const isFindingTurn = n === 3;
    const isLastTurn = n >= SCRIPT.length;

    if (isFindingTurn) {
      pending.set(visitId, {
        reading_id: `mock_reading_${visitId}_3`,
        type: "rebound_tenderness",
        instruction_en:
          "Press the lower right abdomen and release. Does the pain worsen on release?",
        elapsed_s: 0,
        status: "requested",
      });
    }

    return {
      ...line,
      bot_audio_url: MOCK_AUDIO_URL,
      next_action: isFindingTurn
        ? "request_nurse_finding"
        : isLastTurn
          ? "complete_intake"
          : "ask_question",
      pending_finding: isFindingTurn ? (pending.get(visitId) ?? null) : null,
      intake_done: isLastTurn,
    };
  },

  async sessionState(visitId: string): Promise<SessionState> {
    await sleep(100);
    const n = turns.get(visitId) ?? 0;
    const p = pending.get(visitId) ?? null;
    return {
      visit_id: visitId,
      phase: p ? "awaiting_finding" : n >= SCRIPT.length ? "complete" : "conversation",
      pending_finding: p,
      turn_count: n,
    };
  },

  /** Called when the nurse submits the requested finding — clears the pause. */
  async submitFinding(visitId: string): Promise<VitalsResponse> {
    await sleep(200);
    pending.delete(visitId);
    return { ok: true, fired_flags: [] };
  },

  async intakeComplete(visitId: string): Promise<IntakeCompleteResponse> {
    await sleep(1500);
    return {
      report_id: `mock_report_${visitId}`,
      chief_complaint: "Right lower quadrant abdominal pain, 2 days",
      summary_text:
        "34-year-old presenting with two days of abdominal pain that migrated to the right lower quadrant, " +
        "with mild fever and loss of appetite. Rebound tenderness reported on nurse examination. " +
        "Vitals: temp 38.1°C, BP 118/76, pulse 96, SpO2 97%, resp 18. " +
        "Presentation is consistent with possible acute appendicitis; surgical review advised.",
      urgency_tier: {
        tier: "urgent",
        flags: [
          { rule_id: "rule_rebound_tenderness", description: "rebound tenderness present" },
          { rule_id: "rule_fever_moderate", description: "fever (38.1°C)" },
        ],
        flag_count: 2,
      },
    };
  },

  async health(): Promise<HealthResponse> {
    return { llm: "ok", stt: "ok", tts: "ok", translate: "ok", mqtt: "ok" };
  },
};
