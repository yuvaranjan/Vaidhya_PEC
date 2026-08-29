import { getSession } from "@/lib/auth";
import { VoicebotClient } from "./VoicebotClient";

export const metadata = {
  title: "Local Edge AI Voice Assistant | Vaidhya",
  description: "Offline-capable AI voicebot intake consultation",
};

export default async function VoicebotPage() {
  let visitId: string | undefined;
  let patientId: string | undefined;

  try {
    const session = await getSession();
    visitId = session.visitId;
    patientId = session.patientId || "pat_001";
  } catch {
    // If running unauthenticated or standalone testing mode
  }

  return (
    <div className="min-h-screen bg-background py-6">
      <VoicebotClient initialVisitId={visitId} initialPatientId={patientId} />
    </div>
  );
}
