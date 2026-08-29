import re

path = r"D:\Personal_Projects\Vaidhya_PEC\apps\web\app\(patient)\(dashboard)\prescription\page.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old_code = '''async function loadPrescription(
  patientId: string | undefined,
  id: string | undefined,
): Promise<RxRow | null> {
  if (!db || !patientId) return null;'''

new_code = '''import { getMockQueue } from "@/lib/mockQueue";

async function loadPrescription(
  patientId: string | undefined,
  id: string | undefined,
): Promise<RxRow | null> {
  if (!db || !patientId) {
    // Mock fallback: get the first completed visit that has a prescription
    const queue = getMockQueue();
    const completedVisit = queue.find(v => v.status === "completed" && v.prescription && v.prescription.length > 0);
    if (completedVisit && completedVisit.prescription) {
      return {
        prescription_id: mock_rx_,
        medications: completedVisit.prescription,
      };
    }
    return null;
  }'''

content = content.replace(old_code, new_code)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
