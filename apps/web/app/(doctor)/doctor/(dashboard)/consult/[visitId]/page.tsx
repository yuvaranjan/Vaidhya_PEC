import { getSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getVisit } from "@/lib/queue";
import { ConsultClient } from "./ConsultClient";
import { SpecialistPanel } from "@/components/SpecialistPanel";

export default async function DoctorConsultPage({
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
  if (!visit) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-bg pt-6">
      <ConsultClient visit={visit} doctorId={session.doctorId} />
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 pb-6">
        <SpecialistPanel visitId={visitId} />
      </div>
    </div>
  );
}

