// ============================================================
// ArogyaMap — Stage 3: Statistical Anomaly Detection
// Weekly aggregation, rolling 4-week baseline, spike detection rule
// ============================================================

import type { RiskLevel, TimeSeriesPoint } from '@/data/types';
import { dailyRecords, villageProfiles, getDailyRecordsForVillage } from '@/data/rawRecords';

export interface VillageWeeklySummary {
  villageId: string;
  weekIndex: number; // 0 to 11
  weekLabel: string;
  startDate: string;
  caseCount: number;
  rainfallMm: number;
  gatheringDays: number;
  baseline: number;
  isSpike: boolean;
  ratioToBaseline: number;
}

const WEEK_LABELS = [
  'Jun 3', 'Jun 10', 'Jun 17', 'Jun 24',
  'Jul 1', 'Jul 8', 'Jul 15', 'Jul 22',
  'Jul 29', 'Aug 5', 'Aug 12', 'Aug 19',
];

/**
 * Aggregate daily records into 12 weekly buckets for a specific village.
 */
export function getVillageWeeklyHistory(villageId: string): VillageWeeklySummary[] {
  const records = getDailyRecordsForVillage(villageId);
  if (!records.length) return [];

  const weeks: VillageWeeklySummary[] = [];

  for (let w = 0; w < 12; w++) {
    const weekRecords = records.slice(w * 7, (w + 1) * 7);
    const caseCount = weekRecords.reduce((sum, r) => sum + r.caseCount, 0);
    const rainfallMm = weekRecords.reduce((sum, r) => sum + r.rainfallMm, 0);
    const gatheringDays = weekRecords.filter((r) => r.gatheringFlag === 1).length;
    const startDate = weekRecords[0]?.date || '';

    // Rolling 4-week baseline from prior 4 weeks (or prior available weeks)
    let baseline = 1;
    if (w === 0) {
      baseline = Math.max(1, caseCount);
    } else if (w < 4) {
      const priorSum = weeks.slice(0, w).reduce((s, prev) => s + prev.caseCount, 0);
      baseline = Math.max(1, Math.round(priorSum / w));
    } else {
      const prior4 = weeks.slice(w - 4, w);
      const priorSum = prior4.reduce((s, prev) => s + prev.caseCount, 0);
      baseline = Math.max(1, Math.round(priorSum / 4));
    }

    // Spike detection rule: count > 2x baseline AND count >= 3
    const isSpike = caseCount > 2 * baseline && caseCount >= 3;
    const ratioToBaseline = Number((caseCount / baseline).toFixed(2));

    weeks.push({
      villageId,
      weekIndex: w,
      weekLabel: WEEK_LABELS[w] || `W${w + 1}`,
      startDate,
      caseCount,
      rainfallMm,
      gatheringDays,
      baseline,
      isSpike,
      ratioToBaseline,
    });
  }

  return weeks;
}

/**
 * Compute the current risk level for a village based on the latest week's signal.
 */
export function computeVillageRiskLevel(villageId: string): RiskLevel {
  const history = getVillageWeeklyHistory(villageId);
  if (!history.length) return 'normal';

  const currentWeek = history[history.length - 1];
  const { caseCount, baseline, isSpike, ratioToBaseline } = currentWeek;

  // Critical: Spike flagged + substantial case volume (>= 8 or >= 2.5x baseline)
  if (isSpike && (caseCount >= 8 || ratioToBaseline >= 2.5)) {
    return 'critical';
  }

  // Elevated: Ratio > 1.4x baseline (min 3 cases) OR mild spike
  if ((caseCount >= 3 && ratioToBaseline >= 1.4) || isSpike) {
    return 'elevated';
  }

  return 'normal';
}

/**
 * Get current reported case count (latest week) for a village.
 */
export function getVillageCurrentWeeklyCases(villageId: string): number {
  const history = getVillageWeeklyHistory(villageId);
  if (!history.length) return 0;
  return history[history.length - 1].caseCount;
}

/**
 * Get cumulative historical case count for a village across all 12 weeks.
 */
export function getVillageTotalCases(villageId: string): number {
  const history = getVillageWeeklyHistory(villageId);
  return history.reduce((sum, w) => sum + w.caseCount, 0);
}

/**
 * Compute aggregated district summary from all its constituent villages.
 */
export function computeDistrictRollupFromVillages(districtId: string) {
  const villagesInDistrict = villageProfiles.filter((v) => v.districtId === districtId);

  let totalDistrictCases = 0;
  let flaggedCount = 0;
  let criticalCount = 0;
  let elevatedCount = 0;

  for (const v of villagesInDistrict) {
    const totalCases = getVillageTotalCases(v.villageId);
    const risk = computeVillageRiskLevel(v.villageId);

    totalDistrictCases += totalCases;
    if (risk === 'critical') {
      flaggedCount++;
      criticalCount++;
    } else if (risk === 'elevated') {
      flaggedCount++;
      elevatedCount++;
    }
  }

  // District risk classification derived from village rollups
  let districtRiskLevel: RiskLevel = 'normal';
  if (criticalCount > 0) {
    districtRiskLevel = 'critical';
  } else if (elevatedCount > 0) {
    districtRiskLevel = 'elevated';
  }

  return {
    totalDistrictCases,
    flaggedCount,
    criticalCount,
    elevatedCount,
    totalVillages: villagesInDistrict.length,
    districtRiskLevel,
  };
}
