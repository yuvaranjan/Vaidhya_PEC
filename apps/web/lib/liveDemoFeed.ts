// ============================================================
// ArogyaMap — Live Demo Feed Generator (Phase 6)
// Simulates real-time rural telemedicine patient intake encounters
// NOTE: For live demonstration purposes during evaluations/judging
// ============================================================

import type { CaseHistoryRecord } from './csvAdapter';

let liveVisitCounter = 20000;

// Village selection weights for the demo narrative
const DEMO_VILLAGE_TARGETS = [
  { name: 'Royapuram', district: 'Chennai', cluster: 'fever_cluster', weight: 0.35 },
  { name: 'Melur', district: 'Madurai', cluster: 'respiratory_cluster', weight: 0.30 },
  { name: 'Vadipatti', district: 'Madurai', cluster: 'respiratory_cluster', weight: 0.15 },
  { name: 'Kodambakkam', district: 'Chennai', cluster: 'fever_cluster', weight: 0.10 },
  { name: 'Anna Nagar', district: 'Chennai', cluster: 'normal', weight: 0.05 },
  { name: 'T Nagar', district: 'Chennai', cluster: 'normal', weight: 0.05 },
];

const SYMPTOMS_NORMAL = [
  { text: 'Routine followup, general weakness', cause: 'Routine follow-up, no acute complaint' },
  { text: 'Seasonal common cold with runny nose', cause: 'Seasonal upper respiratory infection' },
  { text: 'Acid reflux and indigestion', cause: 'Acid reflux linked to dietary habits' },
  { text: 'Tension headache after farm work', cause: 'Recurrent tension-type headache' },
  { text: 'Routine blood pressure review', cause: 'Chronic hypertension management' },
  { text: 'Mild knee ache during walking', cause: 'Degenerative joint pain, chronic' },
];

const FEVER_CLUSTER_SYMPTOMS = [
  { text: 'High fever, severe headache, retro-orbital eye ache', cause: 'Suspected dengue - vector breeding suspected' },
  { text: 'Fever with chills and rash across forearms for 3 days', cause: 'Suspected dengue - contaminated water source' },
  { text: 'Acute high fever with severe joint pain and shivering', cause: 'Viral fever - seasonal cluster' },
  { text: 'Continuous fever, bodily rash, water stagnation near house', cause: 'Suspected dengue - stagnant water reported nearby' },
];

const RESPIRATORY_CLUSTER_SYMPTOMS = [
  { text: 'Cough, severe breathlessness, low oxygen saturation', cause: 'Suspected pneumonia - early stage' },
  { text: 'Persistent dry cough, fatigue, chest tightness', cause: 'Respiratory distress - cluster under investigation' },
  { text: 'Productive cough, fever, shortness of breath on exertion', cause: 'Suspected respiratory infection - cluster pattern' },
  { text: 'Wheezing and low SpO2 reported by multiple family members', cause: 'Suspected viral respiratory outbreak' },
];

function randomGauss(mean: number, stdev: number): number {
  let u1 = Math.random();
  let u2 = Math.random();
  while (u1 === 0) u1 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdev + mean;
}

function pickWeightedVillage() {
  const rand = Math.random();
  let cumulative = 0;
  for (const v of DEMO_VILLAGE_TARGETS) {
    cumulative += v.weight;
    if (rand <= cumulative) return v;
  }
  return DEMO_VILLAGE_TARGETS[0];
}

/**
 * Generates one new plausible patient visit row to simulate live intake.
 */
export function generateNextVisit(): CaseHistoryRecord {
  liveVisitCounter += 1;
  const village = pickWeightedVillage();
  const patientNum = Math.floor(Math.random() * 4999) + 1;
  const patientId = `P${String(patientNum).padStart(5, '0')}`;

  let bpSys: number;
  let bpDia: number;
  let hr: number;
  let spo2: number;
  let temp: number;
  let symptomItem: { text: string; cause: string };

  const isCluster = Math.random() < 0.65; // High chance to reinforce demo cluster

  if (village.cluster === 'fever_cluster' && isCluster) {
    bpSys = Math.round(randomGauss(124, 8));
    bpDia = Math.round(randomGauss(79, 6));
    hr = Math.round(randomGauss(110, 8)); // tachycardia
    spo2 = Number(Math.min(100, Math.max(93, randomGauss(96.2, 1.2))).toFixed(1));
    temp = Number(randomGauss(38.9, 0.4).toFixed(1)); // fever
    symptomItem = FEVER_CLUSTER_SYMPTOMS[Math.floor(Math.random() * FEVER_CLUSTER_SYMPTOMS.length)];
  } else if (village.cluster === 'respiratory_cluster' && isCluster) {
    bpSys = Math.round(randomGauss(122, 9));
    bpDia = Math.round(randomGauss(78, 6));
    hr = Math.round(randomGauss(99, 8));
    spo2 = Number(Math.min(94, Math.max(82, randomGauss(89.5, 2.2))).toFixed(1)); // low SpO2
    temp = Number(randomGauss(37.8, 0.4).toFixed(1));
    symptomItem = RESPIRATORY_CLUSTER_SYMPTOMS[Math.floor(Math.random() * RESPIRATORY_CLUSTER_SYMPTOMS.length)];
  } else {
    // Normal baseline
    bpSys = Math.round(randomGauss(118, 8));
    bpDia = Math.round(randomGauss(76, 6));
    hr = Math.round(randomGauss(75, 7));
    spo2 = Number(Math.min(100, Math.max(96, randomGauss(98.1, 0.8))).toFixed(1));
    temp = Number(randomGauss(36.8, 0.2).toFixed(1));
    symptomItem = SYMPTOMS_NORMAL[Math.floor(Math.random() * SYMPTOMS_NORMAL.length)];
  }

  // Classify flags
  const flags: string[] = [];
  if (temp >= 38.0) flags.push('fever');
  if (hr >= 100) flags.push('tachycardia');
  if (spo2 < 94) flags.push('low_spo2');
  if (bpSys >= 140 || bpDia >= 90) flags.push('hypertensive');

  const flagStatus = flags.length > 0 ? 'abnormal' : 'normal';
  const flagTypes = flags.length > 0 ? flags.join('+') : 'none';

  const todayStr = new Date().toISOString().split('T')[0];

  const aiSummaryText = `Live Patient Intake: ${symptomItem.text}. Recorded vitals — BP ${bpSys}/${bpDia} mmHg, HR ${hr} bpm, SpO2 ${spo2}%, Temp ${temp}°C. ${
    flagStatus === 'abnormal' ? `Flagged: ${flags.join(', ')}.` : 'Within normal clinical limits.'
  }`;

  return {
    visit_id: `V${String(liveVisitCounter).padStart(6, '0')}`,
    patient_id: patientId,
    district: village.district,
    region_village: village.name,
    visit_number: 1, // New current encounter
    visit_date: todayStr,
    chief_complaint: symptomItem.text,
    bp_systolic: bpSys,
    bp_diastolic: bpDia,
    heart_rate: hr,
    spo2,
    temperature_c: temp,
    vital_flag_status: flagStatus,
    vital_flag_types: flagTypes,
    ai_summary: aiSummaryText,
    doctor_root_cause: flagStatus === 'abnormal' ? symptomItem.cause : '',
  };
}
