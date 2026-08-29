"use client";

import type { DoctorToPatientMessage, PatientToDoctorMessage } from "@vaidhya/shared";

export type ConsultMessage = DoctorToPatientMessage | PatientToDoctorMessage;

const key = (visitId: string) => `vaidhya:consult-history:${visitId}`;
const outboxKey = (visitId: string) => `vaidhya:consult-outbox:${visitId}`;

export function loadConsultHistory(visitId: string): ConsultMessage[] {
  try {
    const value = window.localStorage.getItem(key(visitId));
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveConsultHistory(visitId: string, messages: ConsultMessage[]) {
  try {
    window.localStorage.setItem(key(visitId), JSON.stringify(messages));
  } catch {
    // Storage is an enhancement; server history remains the durable source.
  }
}

export function mergeConsultMessages(existing: ConsultMessage[], incoming: ConsultMessage[]): ConsultMessage[] {
  const byId = new Map(existing.map((message) => [message.message_id, message]));
  for (const message of incoming) byId.set(message.message_id, message);
  return [...byId.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function serverMessageToConsultMessage(value: { message_id: string; speaker: string; text_en: string; timestamp: string }): ConsultMessage | null {
  if (value.speaker === "doctor") {
    return { message_id: value.message_id, sender: "doctor", text: value.text_en, timestamp: value.timestamp };
  }
  if (value.speaker === "patient") {
    return { message_id: value.message_id, sender: "patient_voicebot", text: value.text_en, timestamp: value.timestamp };
  }
  return null;
}

/** Durable browser outbox for doctor questions not yet handed to the broker. */
export function loadConsultOutbox(visitId: string): DoctorToPatientMessage[] {
  try {
    const value = window.localStorage.getItem(outboxKey(visitId));
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function enqueueConsultMessage(visitId: string, message: DoctorToPatientMessage) {
  const next = mergeConsultMessages(loadConsultOutbox(visitId), [message]) as DoctorToPatientMessage[];
  try { window.localStorage.setItem(outboxKey(visitId), JSON.stringify(next)); } catch { /* best effort */ }
}

export function removeConsultOutboxMessage(visitId: string, messageId: string) {
  try {
    const remaining = loadConsultOutbox(visitId).filter((message) => message.message_id !== messageId);
    window.localStorage.setItem(outboxKey(visitId), JSON.stringify(remaining));
  } catch { /* best effort */ }
}
