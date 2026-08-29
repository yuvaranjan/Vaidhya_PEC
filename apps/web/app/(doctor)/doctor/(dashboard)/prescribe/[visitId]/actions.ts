"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { completeVisit, type MedicationItem } from "@/lib/queue";

export async function submitPrescription(visitId: string, formData: FormData) {
  const session = await getSession();
  if (session.role !== "doctor" || !session.doctorId) {
    throw new Error("Unauthorized");
  }

  const rawMeds = formData.get("medications")?.toString() || "[]";
  const medications = JSON.parse(rawMeds) as MedicationItem[];

  // Close the visit first. It is a compare-and-swap on `in_consult`, so a
  // double submit writes one prescription, not two.
  const closed = await completeVisit(visitId, medications);
  if (!closed) {
    throw new Error("Failed to complete visit. It may have already been closed.");
  }

  // The prescription is the row the patient portal and the pharmacy queue both
  // read. Without it, demo steps 10 and 11 have nothing to point at.
  const prescriptionId = `rx_${randomUUID().slice(0, 8)}`;

  if (db) {
    const { error } = await db.from("prescriptions").insert({
      prescription_id: prescriptionId,
      visit_id: visitId,
      doctor_id: session.doctorId,
      medications: medications.map((m) => ({
        name: m.name,
        dosage: m.dosage,
        duration: m.duration,
        instructions: m.instructions,
      })),
      follow_up_requested: formData.get("follow_up") === "on",
    });

    if (error) {
      // The visit is already closed; surfacing this is better than a silent
      // success that leaves the patient with no prescription to collect.
      throw new Error(`Could not save prescription: ${error.message}`);
    }
  }

  session.visitId = undefined;
  await session.save();

  redirect("/doctor/queue");
}
