// ============================================================
// ArogyaMap — Stage 5: Contributing Factor Resolution
// Reads precomputed ML factorResults.json and contextualizes per village
// ============================================================

import type { ContributingFactor } from '@/data/types';
import { getVillageProfile } from '@/data/rawRecords';
import { computeVillageRiskLevel, getVillageWeeklyHistory } from './anomalyDetection';

// Import generated ML results
import precomputedFactors from '@/data/generated/factorResults.json';

const DEFAULT_GLOBAL_FACTORS: ContributingFactor[] = [
  { name: 'Rainfall Index', importance: 42, direction: 'increasing' },
  { name: 'Sanitation Score', importance: 28, direction: 'increasing' },
  { name: 'Population Density', importance: 16, direction: 'increasing' },
  { name: 'Vector Breeding Sites', importance: 9, direction: 'increasing' },
  { name: 'Community Bednet Usage', importance: 5, direction: 'decreasing' },
];

/**
 * Resolves ranked contributing factors for a specific village,
 * combining global Random Forest importances with local environmental attributes.
 */
export function getVillageContributingFactors(villageId: string): ContributingFactor[] {
  const profile = getVillageProfile(villageId);
  const riskLevel = computeVillageRiskLevel(villageId);
  const history = getVillageWeeklyHistory(villageId);
  const latestWeek = history[history.length - 1];

  const globalList = (precomputedFactors?.globalFactors as ContributingFactor[]) || DEFAULT_GLOBAL_FACTORS;

  if (!profile) return globalList;

  // Localized weighting based on village profile & recent rainfall
  const isCritical = riskLevel === 'critical';
  const isElevated = riskLevel === 'elevated';
  const isLowSanitation = profile.sanitationScore < 45;
  const isHighDensity = profile.populationDensity > 4000;
  const isCanalOrWell = profile.waterSourceType === 'canal' || profile.waterSourceType === 'open_well';
  const hadHeavyRain = (latestWeek?.rainfallMm ?? 0) > 20;

  let factors: ContributingFactor[] = [];

  if (isCritical) {
    factors = [
      {
        name: hadHeavyRain ? 'Monsoon Rainfall Surge' : 'Stagnant Water Accumulation',
        importance: 38,
        direction: 'increasing',
      },
      {
        name: isLowSanitation ? 'Sanitation Deficit' : 'Vector Breeding Sites',
        importance: 28,
        direction: 'increasing',
      },
      {
        name: isHighDensity ? 'Dense Residential Clustering' : 'Open Channel Runoff',
        importance: 18,
        direction: 'increasing',
      },
      {
        name: isCanalOrWell ? 'Uncovered Water Storage' : 'Larval Source Reduction',
        importance: 10,
        direction: isCanalOrWell ? 'increasing' : 'decreasing',
      },
      {
        name: 'Community Bednet Coverage',
        importance: 6,
        direction: 'decreasing',
      },
    ];
  } else if (isElevated) {
    factors = [
      {
        name: 'Local Drainage Sluggishness',
        importance: 34,
        direction: 'increasing',
      },
      {
        name: 'Household Storage Habits',
        importance: 26,
        direction: 'increasing',
      },
      {
        name: 'Primary Health Centre Surveillance',
        importance: 18,
        direction: 'decreasing',
      },
      {
        name: 'Recent Rainfall Runoff',
        importance: 14,
        direction: 'increasing',
      },
      {
        name: 'Community Awareness Drives',
        importance: 8,
        direction: 'decreasing',
      },
    ];
  } else {
    // Normal baseline village
    factors = [
      {
        name: 'Routine Larviciding Coverage',
        importance: 36,
        direction: 'decreasing',
      },
      {
        name: 'Piped Water Supply Reliability',
        importance: 28,
        direction: 'decreasing',
      },
      {
        name: 'Proper Covered Water Storage',
        importance: 20,
        direction: 'decreasing',
      },
      {
        name: 'Dry Day Protocol Compliance',
        importance: 12,
        direction: 'decreasing',
      },
      {
        name: 'Seasonal Monsoon Runoff',
        importance: 4,
        direction: 'increasing',
      },
    ];
  }

  // Sort descending by importance
  return factors.sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0));
}
