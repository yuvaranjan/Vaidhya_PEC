import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { PrescriptionFulfillmentClient, Medication } from "./PrescriptionFulfillmentClient";

export const dynamic = "force-dynamic";

type RxRow = {
  prescription_id: string;
  medications: Array<{
    name: string;
    dosage?: string;
    duration?: string;
    instructions?: string;
  }>;
};

/**
 * The patient's prescription. `?id=` targets a specific one (that is the link
 * T3's pharmacy routing hands out); with no id we show the most recent, which
 * is what the demo does — the doctor prescribes on the other laptop and the
 * patient refreshes this page.
 */
import { getMockQueue } from "@/lib/mockQueue";

async function loadPrescription(
  patientId: string | undefined,
  id: string | undefined,
): Promise<RxRow | null> {
  if (!db || !patientId) {
    // Mock fallback: get the first completed visit that has a prescription
    const queue = getMockQueue();
    const completedVisit = queue.find(v => v.status === "completed" && v.prescription && v.prescription.length > 0);
    if (completedVisit && completedVisit.prescription) {
      return {
        prescription_id: mock_rx_,
        medications: completedVisit.prescription,
      };
    }
    return null;
  }

  if (id) {
    const { data } = await db
      .from("prescriptions")
      .select("prescription_id, medications")
      .eq("prescription_id", id)
      .maybeSingle();
    return (data as RxRow) ?? null;
  }

  const { data } = await db
    .from("prescriptions")
    .select("prescription_id, medications, issued_at, visits!inner(patient_id)")
    .eq("visits.patient_id", patientId)
    .order("issued_at", { ascending: false })
    .limit(1);

  const rows = data as unknown as RxRow[] | null;
  return rows && rows.length > 0 ? rows[0] : null;
}

export default async function PatientPrescriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const session = await getSession();
  const userName = session.name || "Demo Patient";

  const rx = await loadPrescription(session.patientId, id);

  const medications: Medication[] = (rx?.medications ?? []).map((m, i) => ({
    id: `m_${i}`,
    name: m.name,
    dosage: m.dosage ?? "",
    duration: m.duration ?? "",
    instructions: m.instructions ?? "",
  }));

  return (
    <PrescriptionFulfillmentClient
      patientName={userName}
      medications={medications}
      prescriptionId={rx?.prescription_id ?? null}
    />
  );
}
