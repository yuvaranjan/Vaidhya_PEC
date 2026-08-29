import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { routeMockPrescription } from "@/lib/mockDb";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const pharmacy_id = body.pharmacy_id;
    const prescription_id = id || body.prescription_id;

    if (!prescription_id || !pharmacy_id) {
      return NextResponse.json(
        { error: "prescription_id and pharmacy_id are required" },
        { status: 400 },
      );
    }

    if (db) {
      try {
        const { error: rxError } = await db
          .from("prescriptions")
          .update({ pharmacy_id })
          .eq("prescription_id", prescription_id);

        if (!rxError) {
          const entryId = `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const { data: queueEntry, error: queueError } = await db
            .from("pharmacy_queue")
            .upsert(
              {
                entry_id: entryId,
                pharmacy_id,
                prescription_id,
                status: "pending",
                created_at: new Date().toISOString(),
              },
              { onConflict: "prescription_id" },
            )
            .select()
            .single();

          if (!queueError) {
            try {
              routeMockPrescription(prescription_id, pharmacy_id);
            } catch {
              // ignore
            }

            return NextResponse.json({
              success: true,
              queueEntry,
              message: "Prescription successfully routed to pharmacy queue",
            });
          }
        }
      } catch (err) {
        console.warn("Supabase routing failed, falling back to mock:", err);
      }
    }

    const result = routeMockPrescription(prescription_id, pharmacy_id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/prescriptions/[id]/route error:", error);
    return NextResponse.json(
      { error: "Failed to route prescription", details: (error as Error).message },
      { status: 500 },
    );
  }
}
