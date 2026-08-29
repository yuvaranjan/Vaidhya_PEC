import { getSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getVisit } from "@/lib/queue";
import { PrescriptionClient } from "./PrescriptionClient";

export default async function PrescribePage({
  params,
}: {
  params: Promise<{ visitId: string }>;
}) {
  const { visitId } = await params;
  const session = await getSession();

  if (session.role !== "doctor" || !session.doctorId) {
    redirect("/doctor/login");
  }

  const visit = await getVisit(visitId);
  if (!visit || visit.status !== "in_consult") {
    // If it's not active or already completed, bounce them back to queue
    redirect("/doctor/queue");
  }

  return (
    <div className="min-h-screen bg-bg">
      <PrescriptionClient visitId={visitId} patientName={visit.patientName} />
    </div>
  );
}

