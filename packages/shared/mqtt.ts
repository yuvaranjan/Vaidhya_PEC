/**
 * SEAM B — MQTT contract: doctor browser (T2) ↔ edge-ai (T1), across laptops.
 *
 * The doctor is on a different machine, so http://localhost:8000 is
 * unreachable from there. Every doctor↔edge interaction goes over MQTT.
 *
 * Python mirror: services/edge-ai/contracts.py — keep them identical.
 * Reference: Docs/Project_Vaidhya_V1_Build_Plan.md §2.2
 */

import type { UrgencyTier } from "./http";

/** Retained — a doctor who logs in late still receives the last queue event. */
export const TOPIC_QUEUE_NEW = "vaidhya/queue/new";

export const topics = {
  queueNew: () => TOPIC_QUEUE_NEW,
  doctorToPatient: (visitId: string) =>
    `vaidhya/consult/${visitId}/doctor_to_patient`,
  patientToDoctor: (visitId: string) =>
    `vaidhya/consult/${visitId}/patient_to_doctor`,
  status: (visitId: string) => `vaidhya/consult/${visitId}/status`,
  webrtcOffer: (visitId: string) => `vaidhya/consult/${visitId}/webrtc/offer`,
  webrtcAnswer: (visitId: string) => `vaidhya/consult/${visitId}/webrtc/answer`,
  webrtcIce: (visitId: string) => `vaidhya/consult/${visitId}/webrtc/ice`,
  networkStatus: (visitId: string) => `vaidhya/consult/${visitId}/network`,
} as const;

/** Stable client ids — required for QoS 1 + clean_session=false to queue. */
export const clientId = {
  edge: (jurisdictionId: string) => `vaidhya-edge-${jurisdictionId}`,
  doctor: (doctorId: string) => `vaidhya-doctor-${doctorId}`,
} as const;

/** edge-ai → doctor browser, retained. Published alongside the Supabase write. */
export interface QueueNewMessage {
  visit_id: string;
  patient_name: string;
  chief_complaint: string;
  urgency_tier: UrgencyTier;
  generated_at: string;
}

/** doctor browser → edge-ai. */
export interface DoctorToPatientMessage {
  message_id: string;
  sender: "doctor";
  text: string;
  timestamp: string;
}

/** edge-ai → doctor browser. */
export interface PatientToDoctorMessage {
  message_id: string;
  sender: "patient_voicebot";
  text: string;
  timestamp: string;
}

export type ConsultStatus =
  | "connected"
  | "patient_disconnected"
  | "reconnected";

export interface ConsultStatusMessage {
  state: ConsultStatus;
}

export type NetworkTier = "high" | "medium" | "low";

export interface NetworkStatusMessage {
  sender: "doctor" | "patient";
  tier: NetworkTier;
  rttMs: number;
  packetLossPercent: number;
  timestamp: string;
}

export interface WebRtcOfferMessage {
  sender: "doctor" | "patient";
  sdp: RTCSessionDescriptionInit;
  timestamp: string;
}

export interface WebRtcAnswerMessage {
  sender: "doctor" | "patient";
  sdp: RTCSessionDescriptionInit;
  timestamp: string;
}

export interface WebRtcIceMessage {
  sender: "doctor" | "patient";
  candidate: RTCIceCandidateInit;
  timestamp: string;
}

export const QOS_AT_LEAST_ONCE = 1 as const;

/**
 * De-dup helper. QoS 1 is at-least-once, so both sides will occasionally see
 * the same message_id twice. Cap the set so a long demo can't grow it forever.
 */
export function createDedupe(limit = 200) {
  const seen = new Set<string>();
  const order: string[] = [];
  return function isDuplicate(messageId: string): boolean {
    if (seen.has(messageId)) return true;
    seen.add(messageId);
    order.push(messageId);
    if (order.length > limit) {
      const evicted = order.shift();
      if (evicted) seen.delete(evicted);
    }
    return false;
  };
}
