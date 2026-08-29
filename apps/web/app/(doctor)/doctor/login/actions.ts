"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function loginDoctor(prevState: any, formData: FormData) {
  const phone = formData.get("phone")?.toString()?.trim();
  const password = formData.get("password")?.toString()?.trim();

  if (!phone || !password) return { error: "Required fields missing" };

  // No Supabase (a laptop with no .env.local) — keep the old mock path so the
  // UI is still developable offline.
  if (!db) {
    if (password !== "vaidhya123") {
      return { error: "Invalid password (demo password is vaidhya123)" };
    }
    const session = await getSession();
    session.role = "doctor";
    session.doctorId = "doc_001";
    session.name = "Dr. Priya Varghese";
    await session.save();
    redirect("/doctor/queue");
  }

  const { data: doctor, error } = await db
    .from("doctors")
    .select("doctor_id, name, password_hash")
    .eq("phone_number", phone)
    .maybeSingle();

  if (error) return { error: "Could not reach the directory. Try again." };
  if (!doctor) return { error: "No doctor registered on that number." };

  const ok = await bcrypt.compare(password, doctor.password_hash);
  if (!ok) return { error: "Invalid password." };

  const session = await getSession();
  session.role = "doctor";
  // The real doctor_id, because visits.claimed_by_doctor_id is a foreign key
  // and prescriptions.doctor_id has to resolve to a person.
  session.doctorId = doctor.doctor_id;
  session.name = doctor.name;
  await session.save();

  redirect("/doctor/queue");
}

export async function logoutDoctor() {
  const session = await getSession();
  session.destroy();
  redirect("/doctor/login");
}
