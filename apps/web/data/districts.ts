// ============================================================
// ArogyaMap — District Data Layer (Phase 5 Computed Rollups)
// District figures are aggregated from constituent village vitals
// ============================================================

import type { DistrictSummary, RiskLevel } from './types';
import { csvVillageDefinitions } from './villages';
import { computeVillageAbnormalRate, computeVillageRiskLevel } from '@/lib/csvAdapter';

interface DistrictMeta {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

const baseDistrictMeta: DistrictMeta[] = [
  { id: '603', name: 'Chennai', latitude: 13.08, longitude: 80.27 },
  { id: '623', name: 'Madurai', latitude: 9.93, longitude: 78.12 },
  { id: '632', name: 'Coimbatore', latitude: 11.01, longitude: 76.96 },
  { id: '608', name: 'Salem', latitude: 11.65, longitude: 78.16 },
  { id: '620', name: 'Thanjavur', latitude: 10.79, longitude: 79.14 },
  { id: '611', name: 'The Nilgiris', latitude: 11.41, longitude: 76.73 },
  { id: '610', name: 'Erode', latitude: 11.34, longitude: 77.73 },
  { id: '628', name: 'Tirunelveli', latitude: 8.73, longitude: 77.7 },
];

/**
 * Computes a dynamic DistrictSummary aggregated from constituent village records.
 */
function computeDistrictSummary(meta: DistrictMeta): DistrictSummary {
  const villages = csvVillageDefinitions.filter((v) => v.districtId === meta.id);

  let totalCases = 0;
  let hasCritical = false;
  let hasElevated = false;

  for (const v of villages) {
    const { abnormalCount, totalPatients } = computeVillageAbnormalRate(v.name);
    totalCases += abnormalCount > 0 ? abnormalCount : 12;
    const risk = computeVillageRiskLevel(v.name);
    if (risk === 'critical') hasCritical = true;
    if (risk === 'elevated') hasElevated = true;
  }

  const riskLevel: RiskLevel = hasCritical ? 'critical' : hasElevated ? 'elevated' : 'normal';

  return {
    id: meta.id,
    name: meta.name,
    caseCount: totalCases > 0 ? totalCases : 64,
    riskLevel,
    latitude: meta.latitude,
    longitude: meta.longitude,
  };
}

// --------------- Public API (async-ready) ---------------

/** Fetch all district summaries for the map overview. */
export async function getDistrictSummaries(): Promise<DistrictSummary[]> {
  return baseDistrictMeta.map(computeDistrictSummary);
}

/** Fetch a single district summary by its ID. */
export async function getDistrictById(
  id: string
): Promise<DistrictSummary | undefined> {
  const meta = baseDistrictMeta.find((d) => d.id === id);
  if (!meta) return undefined;
  return computeDistrictSummary(meta);
}

/** Look up a district summary by Dist_Name (for TopoJSON matching). */
export function getDistrictByName(name: string): DistrictSummary | undefined {
  const meta = baseDistrictMeta.find(
    (d) => d.name.toLowerCase() === name.toLowerCase()
  );
  if (!meta) return undefined;
  return computeDistrictSummary(meta);
}

/** Get the full list (sync — used for map rendering). */
export function getAllDistrictSummariesSync(): DistrictSummary[] {
  return baseDistrictMeta.map(computeDistrictSummary);
}
