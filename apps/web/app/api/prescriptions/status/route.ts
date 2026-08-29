import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const visitId = searchParams.get("visit_id");

  if (!visitId) {
    return NextResponse.json({ error: "Missing visit_id" }, { status: 400 });
  }

  if (!db) {
    // If there's no DB, we can't reliably check the prescription status,
    // so we return null to avoid breaking the UI.
    return NextResponse.json({ prescription_id: null });
  }

  try {
    const { data, error } = await db
      .from("prescriptions")
      .select("prescription_id")
      .eq("visit_id", visitId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ prescription_id: null });
    }

    return NextResponse.json({ prescription_id: data.prescription_id });
  } catch (err) {
    return NextResponse.json({ prescription_id: null });
  }
}
