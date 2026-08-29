import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMockPrescription } from "@/lib/mockDb";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const prescriptionId = searchParams.get("id") || "rx_seed_001";

    if (db) {
      try {
        // Patient is reached through the visit — there is no
        // prescriptions→patients foreign key to embed directly.
        const { data: rx, error: rxError } = await db
          .from("prescriptions")
          .select("*, doctors(*), visits(patient_id, patients(*))")
          .eq("prescription_id", prescriptionId)
          .maybeSingle();

        if (rxError) {
          console.error("[prescription] read failed:", rxError.message);
        }

        if (!rxError && rx) {
          const patient = rx.visits?.patients;
          const formatted = {
            prescription_id: rx.prescription_id,
            visit_id: rx.visit_id,
            doctor_id: rx.doctor_id,
            doctor_name: rx.doctors?.name ?? "Unknown doctor",
            doctor_specialty: rx.doctors?.specialty_general ?? "MBBS",
            patient_id: rx.visits?.patient_id,
            patient_name: patient?.name ?? "Unknown patient",
            patient_age: patient?.age ?? null,
            patient_sex: patient?.sex ?? null,
            patient_phone: patient?.phone_number ?? null,
            issued_at: rx.issued_at || new Date().toISOString(),
            follow_up_requested: rx.follow_up_requested ?? false,
            pharmacy_id: rx.pharmacy_id,
            medications: rx.medications || [],
          };
          return NextResponse.json(formatted);
        }
      } catch (err) {
        console.warn("Supabase query failed, falling back to mock prescription:", err);
      }
    }

    const mockRx = getMockPrescription(prescriptionId);
    if (!mockRx) {
      return NextResponse.json({ error: "Prescription not found" }, { status: 404 });
    }

    return NextResponse.json(mockRx);
  } catch (error) {
    console.error("GET /api/pharmacies/prescription error:", error);
    return NextResponse.json(
      { error: "Failed to fetch prescription", details: (error as Error).message },
      { status: 500 },
    );
  }
}
