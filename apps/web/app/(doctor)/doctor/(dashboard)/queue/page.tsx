import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { fetchQueue } from "./actions";
import { QueueClient } from "./QueueClient";

export default async function DoctorQueuePage() {
  const session = await getSession();

  if (session.role !== "doctor" || !session.doctorId) {
    redirect("/doctor/login");
  }

  const initialQueue = await fetchQueue();

  return (
    <div className="min-h-screen bg-bg">
      <QueueClient initialQueue={initialQueue} doctorId={session.doctorId} />
    </div>
  );
}

