import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getDetailedMockPharmacyQueue,
  updateMockQueueStatus,
} from "@/lib/mockDb";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pharmacyId = searchParams.get("pharmacy_id") || undefined;

    if (db) {
      try {
        // The patient hangs off the visit, not off the prescription — there is
        // no prescriptions→patients foreign key. Embedding one made PostgREST
        // reject the query, and the fallback below quietly served mock rows
        // stamped with the real prescription id.
        let query = db
          .from("pharmacy_queue")
          .select("*, prescriptions(*, doctors(*), visits(patient_id, patients(*)))");

        if (pharmacyId) {
          query = query.eq("pharmacy_id", pharmacyId);
        }

        const { data, error } = await query.order("created_at", { ascending: false });

        if (error) {
          console.error("[pharmacy queue] read failed:", error.message);
        }

        if (!error && data && data.length > 0) {
          const formatted = data.map((item) => {
            const patient = item.prescriptions?.visits?.patients;
            return {
            entry_id: item.entry_id,
            pharmacy_id: item.pharmacy_id,
            prescription_id: item.prescription_id,
            status: item.status,
            created_at: item.created_at,
            prescription: item.prescriptions
              ? {
                  prescription_id: item.prescriptions.prescription_id,
                  visit_id: item.prescriptions.visit_id,
                  doctor_id: item.prescriptions.doctor_id,
                  doctor_name: item.prescriptions.doctors?.name ?? "Unknown doctor",
                  doctor_specialty: item.prescriptions.doctors?.specialty_general ?? "MBBS",
                  patient_id: item.prescriptions.visits?.patient_id,
                  patient_name: patient?.name ?? "Unknown patient",
                  patient_age: patient?.age ?? null,
                  patient_sex: patient?.sex ?? null,
                  patient_phone: patient?.phone_number ?? null,
                  issued_at: item.prescriptions.issued_at,
                  follow_up_requested: item.prescriptions.follow_up_requested ?? false,
                  pharmacy_id: item.prescriptions.pharmacy_id,
                  medications: item.prescriptions.medications || [],
                }
              : undefined,
            };
          });
          return NextResponse.json(formatted);
        }
      } catch (err) {
        console.warn("Supabase queue query failed, falling back to mock:", err);
      }
    }

    const queue = getDetailedMockPharmacyQueue(pharmacyId);
    return NextResponse.json(queue);
  } catch (error) {
    console.error("GET /api/pharmacies/queue error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pharmacy queue", details: (error as Error).message },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { entry_id, status } = body;

    if (!entry_id || !status) {
      return NextResponse.json(
        { error: "entry_id and status are required" },
        { status: 400 },
      );
    }

    if (db) {
      try {
        const { data, error } = await db
          .from("pharmacy_queue")
          .update({ status })
          .eq("entry_id", entry_id)
          .select()
          .single();

        if (!error && data) {
          try {
            updateMockQueueStatus(entry_id, status);
          } catch {
            // ignore
          }
          return NextResponse.json({ success: true, entry: data });
        }
      } catch (err) {
        console.warn("Supabase queue update failed, falling back to mock:", err);
      }
    }

    const updated = updateMockQueueStatus(entry_id, status);
    return NextResponse.json({ success: true, entry: updated });
  } catch (error) {
    console.error("PATCH /api/pharmacies/queue error:", error);
    return NextResponse.json(
      { error: "Failed to update queue entry", details: (error as Error).message },
      { status: 500 },
    );
  }
}
