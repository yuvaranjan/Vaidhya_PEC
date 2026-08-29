// ============================================================
// ArogyaMap — Stage 1 Bridge: Real Case Aggregation & Provenance
// Ingests real patient intake reports, classifies via keyword rules,
// and preserves explicit 'live' vs 'seeded' provenance tags.
// ============================================================

import { liveDiagnosticReports, type DiagnosticReport } from '@/data/patientRecords';
import { dailyRecords as seededDailyRecords, type DailyRecord } from '@/data/rawRecords';
import { classifySymptom, type TrackedSymptomCategory } from './symptomClassifier';

export type RecordSource = 'live' | 'seeded';

export interface ProvenanceDailyRecord extends DailyRecord {
  source: RecordSource;
  rawReportIds?: string[];
}

export interface VillageProvenanceInfo {
  villageId: string;
  liveRecordCount: number;
  seededRecordCount: number;
  totalCases: number;
  primarySource: 'live' | 'seeded' | 'hybrid';
  lastLiveIntakeDate?: string;
}

/**
 * Aggregates raw patient intake reports into daily records tagged with source: 'live'.
 */
export function aggregateLiveDiagnosticReports(
  reports: DiagnosticReport[] = liveDiagnosticReports
): ProvenanceDailyRecord[] {
  const map = new Map<string, ProvenanceDailyRecord>();

  for (const report of reports) {
    const category = classifySymptom(report.chiefComplaint);
    // Ignore unclassified non-monitored complaints
    if (!category) continue;

    const dateStr = report.createdAt.split('T')[0];
    const key = `${report.villageId}_${dateStr}_${category}`;

    const existing = map.get(key);
    if (existing) {
      existing.caseCount += 1;
      existing.rawReportIds?.push(report.id);
    } else {
      map.set(key, {
        villageId: report.villageId,
        date: dateStr,
        symptom: category,
        caseCount: 1,
        rainfallMm: 0, // Weather is joined in Stage 3 from environmental data
        gatheringFlag: 0,
        source: 'live',
        rawReportIds: [report.id],
      });
    }
  }

  return Array.from(map.values());
}

/** Live aggregated records cached */
export const liveAggregatedRecords: ProvenanceDailyRecord[] = aggregateLiveDiagnosticReports();

/**
 * Combines seeded historical records with live intake reports,
 * explicitly tagging every record with source: 'live' | 'seeded'.
 */
export function getCombinedDailyRecords(villageId?: string): ProvenanceDailyRecord[] {
  const taggedSeeded: ProvenanceDailyRecord[] = seededDailyRecords.map((r) => ({
    ...r,
    source: 'seeded' as const,
  }));

  const combined = [...taggedSeeded, ...liveAggregatedRecords];

  if (villageId) {
    return combined.filter((r) => r.villageId === villageId);
  }
  return combined;
}

/**
 * Returns provenance metadata for a specific village.
 */
export function getVillageProvenanceInfo(villageId: string): VillageProvenanceInfo {
  const liveForVillage = liveAggregatedRecords.filter((r) => r.villageId === villageId);
  const liveCount = liveForVillage.reduce((sum, r) => sum + r.caseCount, 0);

  const seededForVillage = seededDailyRecords.filter((r) => r.villageId === villageId);
  const seededCount = seededForVillage.reduce((sum, r) => sum + r.caseCount, 0);

  const totalCases = liveCount + seededCount;

  let primarySource: 'live' | 'seeded' | 'hybrid' = 'seeded';
  if (liveCount > 0 && seededCount > 0) {
    primarySource = 'hybrid';
  } else if (liveCount > 0) {
    primarySource = 'live';
  }

  const latestLive = liveForVillage.sort((a, b) => b.date.localeCompare(a.date))[0];

  return {
    villageId,
    liveRecordCount: liveCount,
    seededRecordCount: seededCount,
    totalCases,
    primarySource,
    lastLiveIntakeDate: latestLive?.date,
  };
}

/**
 * Returns aggregate live intake counts for an entire district.
 */
export function getDistrictLiveReportCount(districtId: string): number {
  return liveDiagnosticReports.filter((r) => r.villageId.startsWith(districtId)).length;
}
