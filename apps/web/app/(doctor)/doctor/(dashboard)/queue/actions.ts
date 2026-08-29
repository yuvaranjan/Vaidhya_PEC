"use server";

import { getSession } from "@/lib/auth";
import { getQueue, claimVisit as claimVisitCAS } from "@/lib/queue";
import { redirect } from "next/navigation";

export async function fetchQueue() {
  const session = await getSession();
  if (session.role !== "doctor" || !session.doctorId) {
    throw new Error("Unauthorized");
  }

  // Return visits awaiting doctor OR already claimed by this doctor
  const queue = await getQueue();
  return queue.filter(
    (v) => v.status === "awaiting_doctor" || v.claimedByDoctorId === session.doctorId
  );
}

export async function claimVisit(visitId: string) {
  const session = await getSession();
  if (session.role !== "doctor" || !session.doctorId) {
    return { error: "Unauthorized" };
  }

  const visit = await claimVisitCAS(visitId, session.doctorId);

  if (!visit) {
    // Compare-and-Swap failure: Visit was claimed by another doctor
    return { error: "409: Already claimed by another doctor." };
  }

  // Update doctor's session with the active visit
  session.visitId = visitId;
  await session.save();

  return { success: true, redirectUrl: `/doctor/consult/${visitId}` };
}
