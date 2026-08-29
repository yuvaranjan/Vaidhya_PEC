import re

path = r"D:\Personal_Projects\Vaidhya_PEC\apps\web\lib\mockQueue.ts"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Change claimVisitCAS to handle missing visits:
old_code = '''export const claimVisitCAS = (visitId: string, doctorId: string): MockVisit | null => {
  const queue: MockVisit[] = globalAny.__mockQueue;
  const visitIndex = queue.findIndex(v => v.visitId === visitId);
  
  if (visitIndex === -1) return null; // Not found'''

new_code = '''export const claimVisitCAS = (visitId: string, doctorId: string): MockVisit | null => {
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
  }'''

content = content.replace(old_code, new_code)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
