import "server-only";

export type MedicationItem = {
  id: string;
  name: string;
  dosage: string;
  duration: string;
  instructions: string;
};

export type MockVisit = {
  visitId: string;
  patientName: string;
  chiefComplaint: string;
  summaryText: string;
  urgency: "routine" | "elevated" | "urgent";
  status: "awaiting_doctor" | "in_consult" | "completed";
  claimedByDoctorId: string | null;
  createdAt: number;
  prescription?: MedicationItem[];
};

// Use globalThis to persist the mock data across hot-reloads and API calls in Next.js dev
const globalAny = globalThis as any;

if (!globalAny.__mockQueue) {
  globalAny.__mockQueue = [
    {
      visitId: "visit_demo_001",
      patientName: "Demo Patient 1",
      chiefComplaint: "Stomach pain",
      summaryText: "Patient reports abdominal pain lasting 2 days. Pain is localized in the lower right quadrant and worsened after eating. No fever or vomiting reported. Rebound tenderness absent.",
      urgency: "routine",
      status: "awaiting_doctor",
      claimedByDoctorId: null,
      createdAt: Date.now() - 1000 * 60 * 5, // 5 mins ago
    },
    {
      visitId: "visit_demo_002",
      patientName: "Demo Patient 2",
      chiefComplaint: "Severe headache and blurry vision",
      summaryText: "Patient reports sudden onset of severe headache paired with blurry vision. Photophobia present. No history of migraines. Nurse checked BP: 160/100.",
      urgency: "elevated",
      status: "awaiting_doctor",
      claimedByDoctorId: null,
      createdAt: Date.now() - 1000 * 60 * 2, // 2 mins ago
    },
  ] as MockVisit[];
}

export const getMockQueue = (): MockVisit[] => {
  return globalAny.__mockQueue;
};

export const getMockVisit = (visitId: string): MockVisit | null => {
  const queue: MockVisit[] = globalAny.__mockQueue;
  return queue.find(v => v.visitId === visitId) || null;
};

export const claimVisitCAS = (visitId: string, doctorId: string): MockVisit | null => {
  const queue: MockVisit[] = globalAny.__mockQueue;
  const visitIndex = queue.findIndex(v => v.visitId === visitId);
  
  if (visitIndex === -1) {
    // Workaround for testing without Supabase: 
    // If the edge AI created a visit and we see it via MQTT but it's not in the mock queue,
    // we just create it on the fly so the claim succeeds!
    const newVisit: MockVisit = {
      visitId: visitId,
      patientName: "Patient (via MQTT)",
      chiefComplaint: "Intake completed",
      summaryText: "Summary loaded via MQTT",
      urgency: "routine",
      status: "in_consult",
      claimedByDoctorId: doctorId,
      createdAt: Date.now(),
    };
    queue.push(newVisit);
    return newVisit;
  }

  const visit = queue[visitIndex];
  
  // If already claimed by THIS doctor, return it so doctor can enter consult
  if (visit.claimedByDoctorId === doctorId || (visit.status === "in_consult" && visit.claimedByDoctorId === doctorId)) {
    return visit;
  }

  // The Compare and Swap logic: Only update if it is currently 'awaiting_doctor' or unassigned
  if (visit.status !== "awaiting_doctor" && visit.claimedByDoctorId !== null) {
    return null; // Already claimed by another doctor!
  }

  // Swap
  visit.status = "in_consult";
  visit.claimedByDoctorId = doctorId;
  
  return visit;
};

export const completeVisit = (visitId: string, prescriptionData: MedicationItem[]): boolean => {
  const queue: MockVisit[] = globalAny.__mockQueue;
  const visitIndex = queue.findIndex(v => v.visitId === visitId);
  
  if (visitIndex === -1) return false;
  
  const visit = queue[visitIndex];
  if (visit.status !== "in_consult") return false;
  
  visit.status = "completed";
  visit.prescription = prescriptionData;
  return true;
};

