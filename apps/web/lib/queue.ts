import "server-only";

import { db } from "@/lib/db";
import {
  claimVisitCAS as claimMockCAS,
  completeVisit as completeMockVisit,
  getMockQueue,
  getMockVisit,
  type MedicationItem,
  type MockVisit,
} from "@/lib/mockQueue";

export type { MedicationItem, MockVisit };
/** The shape the doctor screens render. Same fields the mock had. */
export type Visit = MockVisit;

/**
 * The doctor's queue, backed by Supabase.
 *
 * Replaces the in-memory `lib/mockQueue.ts` store, which could never show a
 * visit produced by the edge service on the other laptop — that is demo step 7.
 * Every function keeps the mock's exact signature and return shape, so the
 * queue/consult/prescribe screens did not change.
 *
 * With no Supabase configured this falls back to the mock, so `npm run dev`
 * still works on a laptop with no .env.local.
 */

type VisitRow = {
  visit_id: string;
  status: string;
  claimed_by_doctor_id: string | null;
  created_at: string;
  patients: { name: string } | null;
  diagnostic_reports: Array<{
    chief_complaint: string | null;
    summary_text: string | null;
    urgency_tier: { tier?: string } | null;
  }>;
};

const SELECT =
  "visit_id, status, claimed_by_doctor_id, created_at, " +
  "patients(name), " +
  "diagnostic_reports(chief_complaint, summary_text, urgency_tier)";

function toVisit(row: VisitRow): Visit {
  const report = row.diagnostic_reports?.[row.diagnostic_reports.length - 1];
  const tier = report?.urgency_tier?.tier;

  const rawName = row.patients?.name;
  const name = (rawName && rawName !== "Unknown patient") 
    ? rawName 
    : `Patient (${row.visit_id.replace(/^visit_/, "").slice(0, 10)})`;

  return {
    visitId: row.visit_id,
    patientName: name,
    chiefComplaint: report?.chief_complaint ?? "Intake in progress",
    summaryText: report?.summary_text ?? "",
    urgency:
      tier === "urgent" || tier === "elevated" || tier === "routine"
        ? tier
        : "routine",
    status: (row.status as Visit["status"]) ?? "awaiting_doctor",
    claimedByDoctorId: row.claimed_by_doctor_id,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function getQueue(): Promise<Visit[]> {
  if (!db) return getMockQueue();

  // Filter out visits older than 24 hours (expiry)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await db
    .from("visits")
    .select(SELECT)
    .in("status", ["awaiting_doctor", "in_consult"])
    .gte("created_at", yesterday)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[queue] read failed, falling back to mock:", error.message);
    return getMockQueue();
  }
  return (data as unknown as VisitRow[]).map(toVisit);
}

export async function getVisit(visitId: string): Promise<Visit | null> {
  if (!db) return getMockVisit(visitId);

  const { data, error } = await db
    .from("visits")
    .select(SELECT)
    .eq("visit_id", visitId)
    .maybeSingle();

  if (error || !data) return getMockVisit(visitId);
  return toVisit(data as unknown as VisitRow);
}

/**
 * Compare-and-swap claim. The `.eq("status", "awaiting_doctor")` in the UPDATE
 * is the whole guarantee: Postgres applies it atomically, so the second doctor
 * updates zero rows and gets the 409. Reading-then-writing would race.
 */
export async function claimVisit(
  visitId: string,
  doctorId: string,
): Promise<Visit | null> {
  if (!db) return claimMockCAS(visitId, doctorId);

  // Check if visit is already claimed by this exact doctor
  const { data: existingData } = await db
    .from("visits")
    .select(SELECT)
    .eq("visit_id", visitId)
    .maybeSingle();

  if (existingData) {
    const existingVisit = toVisit(existingData as unknown as VisitRow);
    if (
      existingVisit.claimedByDoctorId === doctorId ||
      (existingVisit.status === "in_consult" && existingVisit.claimedByDoctorId === doctorId)
    ) {
      return existingVisit;
    }
  }

  const { data, error } = await db
    .from("visits")
    .update({ status: "in_consult", claimed_by_doctor_id: doctorId })
    .eq("visit_id", visitId)
    .or(`status.eq.awaiting_doctor,claimed_by_doctor_id.is.null,claimed_by_doctor_id.eq.${doctorId}`)
    .select(SELECT);

  if (error) {
    console.error("[queue] claim failed:", error.message);
    return null;
  }
  const rows = data as unknown as VisitRow[];
  if (!rows || rows.length === 0) return null; // lost the race

  return toVisit(rows[0]);
}

export async function completeVisit(
  visitId: string,
  _prescription: MedicationItem[],
): Promise<boolean> {
  if (!db) return completeMockVisit(visitId, _prescription);

  const { data, error } = await db
    .from("visits")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("visit_id", visitId)
    .eq("status", "in_consult")
    .select("visit_id");

  if (error) {
    console.error("[queue] complete failed:", error.message);
    return false;
  }
  return Boolean(data && data.length > 0);
}
