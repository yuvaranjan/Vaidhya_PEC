// ============================================================
// ArogyaMap — Phase 5: Real CSV Vitals & Doctor Root-Cause Adapter
// Consumes patients.csv (5,000 rows) & case_history.csv (10,000 visits)
// ============================================================

import fs from 'fs';
import path from 'path';
import type { RiskLevel } from '@/data/types';

export interface PatientRecord {
  patient_id: string;
  name: string;
  age: number;
  gender: string;
  height_cm: number;
  weight_kg: number;
  blood_group: string;
  phone_no: string;
  abha_id: string;
  district: string;
  region_village: string;
  registered_date: string;
}

export interface CaseHistoryRecord {
  visit_id: string;
  patient_id: string;
  district: string;
  region_village: string;
  visit_number: number;
  visit_date: string;
  chief_complaint: string;
  bp_systolic: number;
  bp_diastolic: number;
  heart_rate: number;
  spo2: number;
  temperature_c: number;
  vital_flag_status: 'normal' | 'abnormal';
  vital_flag_types: string;
  ai_summary: string;
  doctor_root_cause: string;
}

export interface WeeklyTrendPoint {
  week: string; // e.g. "Jul 15" or "W32"
  totalVisits: number;
  abnormalCount: number;
  abnormalRate: number; // percentage (0-100)
}

export interface VitalFlagStat {
  flag: string; // e.g. "fever", "tachycardia", "low_spo2", "hypertensive"
  label: string;
  count: number;
  percentage: number;
}

export interface RootCauseStat {
  cause: string;
  count: number;
}

// ── In-Memory Cached Parsed Datasets ─────────────────────────

let _cachedPatients: PatientRecord[] | null = null;
let _cachedCaseHistory: CaseHistoryRecord[] | null = null;

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function resolveDataPath(filename: string): string {
  const paths = [
    path.join(process.cwd(), 'data', filename),
    path.join(process.cwd(), 'apps', 'web', 'data', filename),
    path.join(__dirname, '..', 'data', filename),
    path.join(__dirname, '..', '..', 'data', filename),
    path.join(__dirname, '..', '..', 'apps', 'web', 'data', filename),
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return path.join(process.cwd(), 'data', filename);
}

function loadPatients(): PatientRecord[] {
  if (_cachedPatients) return _cachedPatients;

  const filePath = resolveDataPath('patients.csv');
  if (!fs.existsSync(filePath)) {
    console.warn(`[CSVAdapter] File not found: ${filePath}`);
    return [];
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return [];

  const headers = parseCSVLine(lines[0]);
  const records: PatientRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length < headers.length) continue;

    records.push({
      patient_id: row[0],
      name: row[1],
      age: parseInt(row[2], 10) || 0,
      gender: row[3],
      height_cm: parseFloat(row[4]) || 0,
      weight_kg: parseFloat(row[5]) || 0,
      blood_group: row[6],
      phone_no: row[7],
      abha_id: row[8],
      district: row[9],
      region_village: row[10],
      registered_date: row[11],
    });
  }

  _cachedPatients = records;
  return records;
}

function loadCaseHistory(): CaseHistoryRecord[] {
  if (_cachedCaseHistory) return _cachedCaseHistory;

  const filePath = resolveDataPath('case_history.csv');
  if (!fs.existsSync(filePath)) {
    console.warn(`[CSVAdapter] File not found: ${filePath}`);
    return [];
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return [];

  const records: CaseHistoryRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length < 15) continue;

    records.push({
      visit_id: row[0],
      patient_id: row[1],
      district: row[2],
      region_village: row[3],
      visit_number: parseInt(row[4], 10) || 1,
      visit_date: row[5],
      chief_complaint: row[6],
      bp_systolic: parseInt(row[7], 10) || 120,
      bp_diastolic: parseInt(row[8], 10) || 80,
      heart_rate: parseInt(row[9], 10) || 72,
      spo2: parseFloat(row[10]) || 98.0,
      temperature_c: parseFloat(row[11]) || 37.0,
      vital_flag_status: row[12] === 'abnormal' ? 'abnormal' : 'normal',
      vital_flag_types: row[13] || 'none',
      ai_summary: row[14] || '',
      doctor_root_cause: row[15] || '',
    });
  }

  _cachedCaseHistory = records;
  return records;
}

// ── Public Analytics Functions ──────────────────────────────

/**
 * Returns overall baseline rate: abnormal_count / total_count across ALL villages combined
 * (using only visit_number == 1 per patient)
 */
export function computeBaselineRate(): number {
  const cases = loadCaseHistory();
  const recentCases = cases.filter((c) => c.visit_number === 1);
  if (recentCases.length === 0) return 0.12; // fallback 12%

  const abnormalCount = recentCases.filter((c) => c.vital_flag_status === 'abnormal').length;
  return abnormalCount / recentCases.length;
}

/**
 * Returns village abnormal rate: using ONLY visit_number == 1 per patient
 */
export function computeVillageAbnormalRate(villageName: string): {
  totalPatients: number;
  abnormalCount: number;
  rate: number;
} {
  const cases = loadCaseHistory();
  const villageRecent = cases.filter(
    (c) => c.visit_number === 1 && c.region_village.toLowerCase() === villageName.toLowerCase()
  );

  const totalPatients = villageRecent.length;
  if (totalPatients === 0) return { totalPatients: 0, abnormalCount: 0, rate: 0 };

  const abnormalCount = villageRecent.filter((c) => c.vital_flag_status === 'abnormal').length;
  const rate = abnormalCount / totalPatients;

  return { totalPatients, abnormalCount, rate };
}

/**
 * Computes risk level for a village:
 * - Critical: villageRate >= 2.0 * baselineRate
 * - Elevated: villageRate >= 1.4 * baselineRate
 * - Normal: otherwise
 */
export function computeVillageRiskLevel(villageName: string): RiskLevel {
  const baselineRate = computeBaselineRate();
  const { rate } = computeVillageAbnormalRate(villageName);

  if (baselineRate === 0) return 'normal';
  const ratio = rate / baselineRate;

  if (ratio >= 2.0) return 'critical';
  if (ratio >= 1.4) return 'elevated';
  return 'normal';
}

/**
 * Returns unique monitored villages from the CSV dataset.
 */
export function getAllVillagesFromCSV(): Array<{ name: string; district: string }> {
  const cases = loadCaseHistory();
  const map = new Map<string, string>();
  for (const c of cases) {
    if (!map.has(c.region_village)) {
      map.set(c.region_village, c.district);
    }
  }
  return Array.from(map.entries()).map(([name, district]) => ({ name, district }));
}

/**
 * Computes weekly trend for a village by bucketing all case_history visits by ISO week.
 */
export function computeWeeklyTrend(villageName: string): WeeklyTrendPoint[] {
  const cases = loadCaseHistory();
  const villageCases = cases.filter(
    (c) => c.region_village.toLowerCase() === villageName.toLowerCase()
  );

  // Group by weekly date buckets
  const weekMap = new Map<string, { total: number; abnormal: number }>();

  for (const c of villageCases) {
    // Generate ISO week or formatted weekly label (e.g. "Jun 15", "Jul 01")
    const d = new Date(c.visit_date);
    // Find week start (Sunday or Monday)
    const dayOfWeek = d.getUTCDay();
    const weekStart = new Date(d);
    weekStart.setUTCDate(d.getUTCDate() - dayOfWeek);
    const weekKey = weekStart.toISOString().split('T')[0];

    const current = weekMap.get(weekKey) || { total: 0, abnormal: 0 };
    current.total += 1;
    if (c.vital_flag_status === 'abnormal') {
      current.abnormal += 1;
    }
    weekMap.set(weekKey, current);
  }

  // Sort chronologically
  const sortedKeys = Array.from(weekMap.keys()).sort();

  return sortedKeys.map((key) => {
    const data = weekMap.get(key)!;
    const d = new Date(key);
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const abnormalRate = data.total > 0 ? Math.round((data.abnormal / data.total) * 100) : 0;

    return {
      week: label,
      totalVisits: data.total,
      abnormalCount: data.abnormal,
      abnormalRate,
    };
  });
}

/**
 * Computes dominant vital flag types among abnormal visits (visit_number == 1) in that village.
 */
export function computeDominantVitalFlags(villageName: string): VitalFlagStat[] {
  const cases = loadCaseHistory();
  const abnormalRecent = cases.filter(
    (c) =>
      c.visit_number === 1 &&
      c.region_village.toLowerCase() === villageName.toLowerCase() &&
      c.vital_flag_status === 'abnormal'
  );

  const totalAbnormal = abnormalRecent.length;
  if (totalAbnormal === 0) return [];

  const counts: Record<string, number> = {};
  for (const c of abnormalRecent) {
    const flags = c.vital_flag_types.split('+');
    for (const f of flags) {
      if (f && f !== 'none') {
        counts[f] = (counts[f] || 0) + 1;
      }
    }
  }

  const labelMap: Record<string, string> = {
    fever: 'Fever (Temp ≥ 38.0°C)',
    tachycardia: 'Tachycardia (HR ≥ 100 bpm)',
    low_spo2: 'Low SpO2 (O₂ < 94%)',
    hypertensive: 'Hypertensive (BP ≥ 140/90)',
  };

  return Object.entries(counts)
    .map(([flag, count]) => ({
      flag,
      label: labelMap[flag] || flag.replace('_', ' '),
      count,
      percentage: Math.round((count / totalAbnormal) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Computes top doctor-noted root causes among abnormal visits in that village.
 */
export function computeTopRootCauses(villageName: string): RootCauseStat[] {
  const cases = loadCaseHistory();
  const abnormalRecent = cases.filter(
    (c) =>
      c.visit_number === 1 &&
      c.region_village.toLowerCase() === villageName.toLowerCase() &&
      c.vital_flag_status === 'abnormal' &&
      c.doctor_root_cause &&
      c.doctor_root_cause.trim().length > 0
  );

  const counts: Record<string, number> = {};
  for (const c of abnormalRecent) {
    counts[c.doctor_root_cause] = (counts[c.doctor_root_cause] || 0) + 1;
  }

  return Object.entries(counts)
    .map(([cause, count]) => ({ cause, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

/**
 * Returns 3-5 sample flagged cases from the most recent abnormal visits in that village.
 */
export function getSampleFlaggedCases(villageName: string, limit = 4): CaseHistoryRecord[] {
  const cases = loadCaseHistory();
  return cases
    .filter(
      (c) =>
        c.visit_number === 1 &&
        c.region_village.toLowerCase() === villageName.toLowerCase() &&
        c.vital_flag_status === 'abnormal'
    )
    .slice(0, limit);
}
