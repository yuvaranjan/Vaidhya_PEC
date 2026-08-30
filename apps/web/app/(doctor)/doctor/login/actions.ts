"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function loginDoctor(prevState: any, formData: FormData) {
  const phone = formData.get("phone")?.toString()?.trim();
  const password = formData.get("password")?.toString()?.trim();

  if (!phone || !password) return { error: "Required fields missing" };

  const identifier = phone; // Could be phone number or doctor ID

  // Normalize potential doctor ID formats (e.g., doctor_001 -> doc_001)
  const normalizedId = identifier.replace(/^doctor_/, "doc_");

  let doctor = null;

  if (db) {
    // 1. Try finding by phone number
    const { data: byPhone } = await db
      .from("doctors")
      .select("doctor_id, name, password_hash, phone_number")
      .eq("phone_number", identifier)
      .maybeSingle();

    if (byPhone) {
      doctor = byPhone;
    } else {
      // 2. Try finding by doctor_id (e.g. doc_001 or doctor_001)
      const { data: byId } = await db
        .from("doctors")
        .select("doctor_id, name, password_hash, phone_number")
        .eq("doctor_id", normalizedId)
        .maybeSingle();

      if (byId) doctor = byId;
    }
  }

  // Fallback to local default doctor if DB is unreachable or in mock mode
  if (!doctor && (identifier === "doc_001" || identifier === "doctor_001" || identifier === "9100000001" || identifier === "9000000001")) {
    doctor = {
      doctor_id: "doc_001",
      name: "Dr. Priya Varghese",
      password_hash: "",
      phone_number: "9100000001",
    };
  } else if (!doctor && (identifier === "doc_002" || identifier === "doctor_002" || identifier === "9100000002" || identifier === "9000000002")) {
    doctor = {
      doctor_id: "doc_002",
      name: "Dr. Arun Krishnan",
      password_hash: "",
      phone_number: "9100000002",
    };
  }

  if (!doctor) {
    return { error: "No doctor registered with that ID or Phone (e.g., 9100000001 or doc_001)." };
  }

  // Validate password
  const isDemoPass = password === "vaidhya123" || password === "doctor123";
  let passOk = isDemoPass;
  if (!passOk && doctor.password_hash) {
    try {
      passOk = await bcrypt.compare(password, doctor.password_hash);
    } catch {
      passOk = false;
    }
  }

  if (!passOk) return { error: "Invalid password (demo password is vaidhya123)." };

  const session = await getSession();
  session.role = "doctor";
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
