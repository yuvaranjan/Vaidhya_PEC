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

  if (otp !== DEMO_OTP) {
    return { error: "Invalid OTP. Please use the Demo OTP: 123456" };
  }

  const session = await getSession();
  session.role = "patient";
  session.visitId = `visit_${randomUUID().slice(0, 8)}`;

  if (db) {
    // Look the patient up by phone. `patient_id` is a foreign key on visits,
    // prescriptions and everything downstream — the phone number is not it.
    const { data: patient, error } = await db
      .from("patients")
      .select("patient_id, name")
      .eq("phone_number", phone)
      .maybeSingle();

    if (error) {
      console.error("Supabase error during patient login:", error);
      return { error: `Database error: ${error.message}` };
    }

    if (!patient) {
      return { error: "No patient registered on that number." };
    }

    session.patientId = patient.patient_id;
    session.name = patient.name;
  } else {
    session.patientId = "pat_001";
    session.name = "Anjali Menon";
  }

  await session.save();

  redirect("/dashboard");
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect("/");
}
