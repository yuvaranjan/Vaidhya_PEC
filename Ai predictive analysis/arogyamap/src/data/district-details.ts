// ============================================================
// ArogyaMap — District Details & Rollup Data Layer (Phase 5)
// ============================================================

import type { DistrictDetail } from './types';
import { getDistrictById, getAllDistrictSummariesSync } from './districts';
import { getVillagesForDistrict } from './villages';

// ── Public API ──────────────────────────────────────────────

/** Fetch the full detail and rollup data for a single district. */
export async function getDistrictDetail(
  id: string
): Promise<DistrictDetail | undefined> {
  const summary = await getDistrictById(id);
  if (!summary) return undefined;

  const villages = await getVillagesForDistrict(id);
  const flaggedVillageCount = villages.filter(
    (v) => v.riskLevel === 'critical' || v.riskLevel === 'elevated'
  ).length;

  const totalDistrictPatients = villages.reduce((sum, v) => sum + v.caseCount, 0);
  const totalDistrictAbnormal = villages.reduce((sum, v) => sum + v.weeklyCaseCount, 0);

  return {
    summary,
    villages,
    flaggedVillageCount,
    totalVillageCount: villages.length,
    totalDistrictPatients,
    totalDistrictAbnormal,
    liveIntakeReportCount: totalDistrictAbnormal,
  };
}

/** Get all district IDs available for static paths */
export function getAvailableDetailIds(): string[] {
  const summaries = getAllDistrictSummariesSync();
  return summaries.map((d) => d.id);
}
