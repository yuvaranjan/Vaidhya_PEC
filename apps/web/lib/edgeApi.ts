/**
 * The ONE place the patient UI talks to T1's edge-ai service.
 *
 * Every component calls edgeApi.*; nothing calls fetch("http://localhost:8000")
 * directly. That is what makes the hour-8 flag flip a one-line change instead of
 * a grep across the app.
 *
 *   NEXT_PUBLIC_USE_MOCK_AI=true   → canned responses from lib/mockAi.ts
 *   NEXT_PUBLIC_USE_MOCK_AI=false  → real HTTP to NEXT_PUBLIC_EDGE_AI_URL
 */

import type {
  HealthResponse,
  IntakeCompleteResponse,
  ModelsResponse,
  SessionStartRequest,
  SessionStartResponse,
  SessionState,
  SetModelRequest,
  TurnResponse,
  VitalsRequest,
  VitalsResponse,
  VoiceTurnTextRequest,
} from "@vaidhya/shared";
import { mockAi } from "./mockAi";

export const USE_MOCK_AI = process.env.NEXT_PUBLIC_USE_MOCK_AI === "true";

const BASE = process.env.NEXT_PUBLIC_EDGE_AI_URL ?? "http://localhost:8000";

async function post<T>(path: string, body: unknown): Promise<T> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[edgeApi] POST ${path} → ${res.status}:`, text);
      throw new Error(`${path} → ${res.status} ${text}`);
    }
    return res.json() as Promise<T>;
  } catch (err: any) {
    if (err.name === "TypeError" || err.message?.includes("failed")) {
      throw new Error(`Edge AI service unavailable at ${BASE}. Please start the Python backend on port 8000 or set NEXT_PUBLIC_USE_MOCK_AI=true in apps/web/.env.local`);
    }
    throw err;
  }
}

async function get<T>(path: string): Promise<T> {
  try {
    const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[edgeApi] GET ${path} → ${res.status}:`, text);
      throw new Error(`${path} → ${res.status} ${text}`);
    }
    return res.json() as Promise<T>;
  } catch (err: any) {
    if (err.name === "TypeError" || err.message?.includes("failed")) {
      throw new Error(`Edge AI service unavailable at ${BASE}. Please start the Python backend on port 8000 or set NEXT_PUBLIC_USE_MOCK_AI=true in apps/web/.env.local`);
    }
    throw err;
  }
}

export const edgeApi = {
  /** Absolute URL for an audio path returned by the service (e.g. /audio/x.mp3). */
  audioUrl(url: string): string {
    if (!url) return "";
    return url.startsWith("http") ? url : `${BASE}${url}`;
  },

  sessionStart(req: SessionStartRequest): Promise<SessionStartResponse> {
    return USE_MOCK_AI ? mockAi.sessionStart(req) : post("/session/start", req);
  },

  vitals(req: VitalsRequest): Promise<VitalsResponse> {
    return USE_MOCK_AI ? mockAi.vitals(req) : post("/vitals", req);
  },

  /** multipart: audio=<webm blob from MediaRecorder>, visit_id=<string> */
  voiceTurn(visitId: string, audio: Blob): Promise<TurnResponse> {
    if (USE_MOCK_AI) return mockAi.voiceTurn(visitId, audio);
    const fd = new FormData();
    fd.append("audio", audio, "turn.webm");
    fd.append("visit_id", visitId);
    return fetch(`${BASE}/voice/turn`, { method: "POST", body: fd }).then((r) => {
      if (!r.ok) throw new Error(`/voice/turn → ${r.status}`);
      return r.json() as Promise<TurnResponse>;
    });
  },

  /** The typed-answer fallback — same turn loop as voiceTurn, minus STT. */
  voiceTurnText(req: VoiceTurnTextRequest): Promise<TurnResponse> {
    return USE_MOCK_AI
      ? mockAi.voiceTurn(req.visit_id)
      : post("/voice/turn/text", req);
  },

  /** Poll this every 2s while the assistant page is open. */
  sessionState(visitId: string): Promise<SessionState> {
    return USE_MOCK_AI
      ? mockAi.sessionState(visitId)
      : get(`/session/${visitId}/state`);
  },

  /** Nurse submits the finding the bot paused for — same /vitals endpoint, on_demand phase. */
  submitFinding(req: VitalsRequest): Promise<VitalsResponse> {
    return USE_MOCK_AI ? mockAi.submitFinding(req.visit_id) : post("/vitals", req);
  },

  intakeComplete(visitId: string): Promise<IntakeCompleteResponse> {
    return USE_MOCK_AI
      ? mockAi.intakeComplete(visitId)
      : post("/intake/complete", { visit_id: visitId });
  },

  health(): Promise<HealthResponse> {
    return USE_MOCK_AI ? mockAi.health() : get("/health");
  },

  /** Model selection has no mock — it's inherently a real-edge feature. */
  listModels(): Promise<ModelsResponse> {
    return get("/settings/models");
  },

  setModel(req: SetModelRequest): Promise<{ ok: boolean; current: string; provider: string }> {
    return post("/settings/model", req);
  },
};
