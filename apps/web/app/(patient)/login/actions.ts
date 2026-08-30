"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";

import { DEMO_OTP, getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function loginPatient(prevState: any, formData: FormData) {
  const phone = formData.get("phone")?.toString()?.trim();
  const otp = formData.get("otp")?.toString()?.trim();

  if (!phone || !otp) {
    return { error: "Phone and OTP are required" };
  }

  if (otp !== "123456" && otp !== "1234" && otp !== DEMO_OTP) {
    return { error: "Invalid OTP. Please use the Demo OTP: 123456 (or 1234)" };
  }

  const identifier = phone;
  const normalizedId = identifier.replace(/^patient_/, "pat_");

  const session = await getSession();
  session.role = "patient";
  session.visitId = `visit_${randomUUID().slice(0, 8)}`;

  let patient = null;

  if (db) {
    // 1. Try finding by phone number
    const { data: byPhone } = await db
      .from("patients")
      .select("patient_id, name, phone_number")
      .eq("phone_number", identifier)
      .maybeSingle();

    if (byPhone) {
      patient = byPhone;
    } else {
      // 2. Try finding by patient_id (e.g. pat_001 or patient_001)
      const { data: byId } = await db
        .from("patients")
        .select("patient_id, name, phone_number")
        .eq("patient_id", normalizedId)
        .maybeSingle();

      if (byId) patient = byId;
    }
  }

  // Fallback default patients if DB is in mock mode or for quick testing
  if (!patient) {
    if (identifier === "pat_001" || identifier === "patient_001" || identifier === "9000000001" || identifier === "9840123456") {
      patient = { patient_id: "pat_001", name: "Anjali Menon" };
    } else if (identifier === "pat_002" || identifier === "patient_002" || identifier === "9000000002") {
      patient = { patient_id: "pat_002", name: "Rajesh Kumar" };
    } else if (identifier === "pat_003" || identifier === "patient_003" || identifier === "9000000003") {
      patient = { patient_id: "pat_003", name: "Fathima Beevi" };
    } else if (identifier === "pat_004" || identifier === "patient_004" || identifier === "9000000004") {
      patient = { patient_id: "pat_004", name: "Suresh Nair" };
    }
  }

  if (!patient) {
    return { error: "No patient registered with that Phone or ID (e.g. 9000000001 or pat_001)." };
  }

  session.patientId = patient.patient_id;
  session.name = patient.name;
  await session.save();

  redirect("/dashboard");
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect("/");
}
