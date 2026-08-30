"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { completeVisit, type MedicationItem } from "@/lib/queue";

export async function submitInlinePrescription(visitId: string, medications: MedicationItem[], followUp: boolean) {
  const session = await getSession();
  if (session.role !== "doctor" || !session.doctorId) {
    throw new Error("Unauthorized");
  }

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
      follow_up_requested: followUp,
    });

    if (error) {
      throw new Error(`Could not save prescription: ${error.message}`);
    }
  }

  const n8nWebhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
  if (n8nWebhookUrl) {
    try {
      fetch(n8nWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "prescription_finalized",
          visitId,
          doctorId: session.doctorId,
          medications,
          followUpRequested: followUp,
          patientPhone: "9000000001"
        })
      }).catch(err => console.error("[n8n] webhook dispatch failed:", err));
    } catch (err) {
      console.error("[n8n] webhook setup failed:", err);
    }
  }

  return { success: true, prescriptionId };
}

export async function closeConsultSession(visitId: string, medications: MedicationItem[]) {
  const session = await getSession();
  if (session.role !== "doctor" || !session.doctorId) {
    throw new Error("Unauthorized");
  }

  const closed = await completeVisit(visitId, medications);
  if (!closed) {
    throw new Error("Failed to complete visit. It may have already been closed.");
  }

  session.visitId = undefined;
  await session.save();

  redirect("/doctor/queue");
}
