// ============================================================
// ArogyaMap — Raw Patient Intake & Diagnostic Reports Layer
// Natural language patient intake records with mandatory village_id
// ============================================================

export interface Patient {
  id: string;
  patientIdentifier: string; // e.g. ABHA ID
  fullName: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  districtId: string;
  villageId: string;
  createdAt: string;
}

export interface DiagnosticReport {
  id: string;
  patientId: string;
  villageId: string;
  chiefComplaint: string;
  presumptiveDiagnosis?: string;
  createdAt: string; // ISO string
}

// ── Sample Patients ─────────────────────────────────────────

export const livePatients: Patient[] = [
  { id: 'p-001', patientIdentifier: 'ABHA-TN-603-1041', fullName: 'K. Muthulakshmi', age: 34, gender: 'female', districtId: '603', villageId: '603-01', createdAt: '2026-08-20T09:15:00Z' },
  { id: 'p-002', patientIdentifier: 'ABHA-TN-603-1042', fullName: 'S. Ramachandran', age: 42, gender: 'male', districtId: '603', villageId: '603-01', createdAt: '2026-08-20T10:30:00Z' },
  { id: 'p-003', patientIdentifier: 'ABHA-TN-603-1043', fullName: 'V. Anitha', age: 19, gender: 'female', districtId: '603', villageId: '603-01', createdAt: '2026-08-21T08:45:00Z' },
  { id: 'p-004', patientIdentifier: 'ABHA-TN-603-1044', fullName: 'M. Selvam', age: 55, gender: 'male', districtId: '603', villageId: '603-01', createdAt: '2026-08-21T11:20:00Z' },
  { id: 'p-005', patientIdentifier: 'ABHA-TN-603-1045', fullName: 'P. Kavitha', age: 28, gender: 'female', districtId: '603', villageId: '603-01', createdAt: '2026-08-22T09:00:00Z' },
  { id: 'p-006', patientIdentifier: 'ABHA-TN-603-1046', fullName: 'R. Gopinath', age: 37, gender: 'male', districtId: '603', villageId: '603-01', createdAt: '2026-08-22T14:15:00Z' },
  { id: 'p-007', patientIdentifier: 'ABHA-TN-603-1047', fullName: 'T. Deepa', age: 24, gender: 'female', districtId: '603', villageId: '603-01', createdAt: '2026-08-23T09:40:00Z' },
  { id: 'p-008', patientIdentifier: 'ABHA-TN-603-1048', fullName: 'J. Karthik', age: 31, gender: 'male', districtId: '603', villageId: '603-01', createdAt: '2026-08-23T11:10:00Z' },

  // T. Nagar (603-02)
  { id: 'p-010', patientIdentifier: 'ABHA-TN-603-2001', fullName: 'N. Rajesh', age: 29, gender: 'male', districtId: '603', villageId: '603-02', createdAt: '2026-08-21T10:00:00Z' },
  { id: 'p-011', patientIdentifier: 'ABHA-TN-603-2002', fullName: 'A. Meena', age: 35, gender: 'female', districtId: '603', villageId: '603-02', createdAt: '2026-08-22T11:30:00Z' },

  // Melur North (623-01)
  { id: 'p-020', patientIdentifier: 'ABHA-TN-623-1001', fullName: 'G. Pandian', age: 48, gender: 'male', districtId: '623', villageId: '623-01', createdAt: '2026-08-20T08:30:00Z' },
  { id: 'p-021', patientIdentifier: 'ABHA-TN-623-1002', fullName: 'S. Meenakshi', age: 41, gender: 'female', districtId: '623', villageId: '623-01', createdAt: '2026-08-21T09:15:00Z' },
  { id: 'p-022', patientIdentifier: 'ABHA-TN-623-1003', fullName: 'K. Balaji', age: 26, gender: 'male', districtId: '623', villageId: '623-01', createdAt: '2026-08-22T10:45:00Z' },
  { id: 'p-023', patientIdentifier: 'ABHA-TN-623-1004', fullName: 'R. Vasantha', age: 52, gender: 'female', districtId: '623', villageId: '623-01', createdAt: '2026-08-23T08:50:00Z' },

  // Ambasamudram (628-01)
  { id: 'p-030', patientIdentifier: 'ABHA-TN-628-1001', fullName: 'M. Sankar', age: 39, gender: 'male', districtId: '628', villageId: '628-01', createdAt: '2026-08-21T09:00:00Z' },
  { id: 'p-031', patientIdentifier: 'ABHA-TN-628-1002', fullName: 'T. Gomathi', age: 33, gender: 'female', districtId: '628', villageId: '628-01', createdAt: '2026-08-22T10:15:00Z' },
  { id: 'p-032', patientIdentifier: 'ABHA-TN-628-1003', fullName: 'C. Arumugam', age: 60, gender: 'male', districtId: '628', villageId: '628-01', createdAt: '2026-08-23T11:00:00Z' },

  // Routine Non-Dengue Patient (Excluded by classifier)
  { id: 'p-099', patientIdentifier: 'ABHA-TN-603-9001', fullName: 'D. Kumar', age: 65, gender: 'male', districtId: '603', villageId: '603-01', createdAt: '2026-08-23T12:00:00Z' },
];

// ── Sample Diagnostic Intake Reports ─────────────────────────

export const liveDiagnosticReports: DiagnosticReport[] = [
  // Royapuram (Ward 48) - Outbreak cluster
  { id: 'rep-101', patientId: 'p-001', villageId: '603-01', chiefComplaint: 'Patient has high continuous fever for 4 days, erythematous rash on arms and chest, headache', presumptiveDiagnosis: 'Suspected Dengue with Rash', createdAt: '2026-08-20T09:15:00Z' },
  { id: 'rep-102', patientId: 'p-002', villageId: '603-01', chiefComplaint: 'Sudden onset fever, petechiae spots on forearms, severe body pain', presumptiveDiagnosis: 'Suspected Dengue Fever', createdAt: '2026-08-20T10:30:00Z' },
  { id: 'rep-103', patientId: 'p-003', villageId: '603-01', chiefComplaint: 'High grade fever with red rash across trunk, joint pain, loss of appetite', presumptiveDiagnosis: 'Acute Febrile Rash', createdAt: '2026-08-21T08:45:00Z' },
  { id: 'rep-104', patientId: 'p-004', villageId: '603-01', chiefComplaint: 'Severe joint pain, intense body ache, persistent fever and shivering for 3 days', presumptiveDiagnosis: 'Dengue-like Illness', createdAt: '2026-08-21T11:20:00Z' },
  { id: 'rep-105', patientId: 'p-005', villageId: '603-01', chiefComplaint: 'Fever with skin rash on face and neck, retro-orbital eye pain', presumptiveDiagnosis: 'Acute Febrile Rash', createdAt: '2026-08-22T09:00:00Z' },
  { id: 'rep-106', patientId: 'p-006', villageId: '603-01', chiefComplaint: 'Fever, generalized body ache and severe joint pain in knees', presumptiveDiagnosis: 'Dengue-like Illness', createdAt: '2026-08-22T14:15:00Z' },
  { id: 'rep-107', patientId: 'p-007', villageId: '603-01', chiefComplaint: 'High fever and red spots on legs, weakness, nausea', presumptiveDiagnosis: 'Acute Febrile Rash', createdAt: '2026-08-23T09:40:00Z' },
  { id: 'rep-108', patientId: 'p-008', villageId: '603-01', chiefComplaint: 'Fever 102F, rash eruption on torso, chills', presumptiveDiagnosis: 'Acute Febrile Rash', createdAt: '2026-08-23T11:10:00Z' },

  // T. Nagar (Ward 113)
  { id: 'rep-201', patientId: 'p-010', villageId: '603-02', chiefComplaint: 'Fever with severe joint pain and body ache, no rash observed', presumptiveDiagnosis: 'Dengue-like Illness', createdAt: '2026-08-21T10:00:00Z' },
  { id: 'rep-202', patientId: 'p-011', villageId: '603-02', chiefComplaint: 'Mild fever, muscle pain and knee joint pain for 2 days', presumptiveDiagnosis: 'Viral Arthralgia', createdAt: '2026-08-22T11:30:00Z' },

  // Melur North (Madurai)
  { id: 'rep-301', patientId: 'p-020', villageId: '623-01', chiefComplaint: 'Acute high fever with macular rash on forearms, weakness', presumptiveDiagnosis: 'Acute Febrile Rash', createdAt: '2026-08-20T08:30:00Z' },
  { id: 'rep-302', patientId: 'p-021', villageId: '623-01', chiefComplaint: 'Fever, severe body ache and intense joint pain', presumptiveDiagnosis: 'Dengue-like Illness', createdAt: '2026-08-21T09:15:00Z' },
  { id: 'rep-303', patientId: 'p-022', villageId: '623-01', chiefComplaint: 'Fever with petechial spots on chest, headache', presumptiveDiagnosis: 'Acute Febrile Rash', createdAt: '2026-08-22T10:45:00Z' },
  { id: 'rep-304', patientId: 'p-023', villageId: '623-01', chiefComplaint: 'Continuous fever, joint pain in ankles and wrists', presumptiveDiagnosis: 'Dengue-like Illness', createdAt: '2026-08-23T08:50:00Z' },

  // Ambasamudram (Tirunelveli)
  { id: 'rep-401', patientId: 'p-030', villageId: '628-01', chiefComplaint: 'Fever with widespread rash on back, joint stiffness', presumptiveDiagnosis: 'Acute Febrile Rash', createdAt: '2026-08-21T09:00:00Z' },
  { id: 'rep-402', patientId: 'p-031', villageId: '628-01', chiefComplaint: 'High fever, severe body ache, retro-orbital eye pain', presumptiveDiagnosis: 'Dengue-like Illness', createdAt: '2026-08-22T10:15:00Z' },
  { id: 'rep-403', patientId: 'p-032', villageId: '628-01', chiefComplaint: 'Fever and red spots appearing on arms, chills', presumptiveDiagnosis: 'Acute Febrile Rash', createdAt: '2026-08-23T11:00:00Z' },

  // Non-Tracked Complaint (e.g. chronic hypertension checkup — will be returned null by classifier)
  { id: 'rep-901', patientId: 'p-099', villageId: '603-01', chiefComplaint: 'Routine blood pressure checkup, mild chronic knee osteoarthritis, no fever', presumptiveDiagnosis: 'Hypertension Followup', createdAt: '2026-08-23T12:00:00Z' },
];
