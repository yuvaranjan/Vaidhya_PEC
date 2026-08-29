// ============================================================
// ArogyaMap — Type definitions for the public-health data layer
// Phase 5: Patient Vitals & Doctor Root Causes Data Model
// ============================================================

import type { CaseHistoryRecord, RootCauseStat, VitalFlagStat, WeeklyTrendPoint } from '@/lib/csvAdapter';

/** Risk classification for a district/area */
export type RiskLevel = 'normal' | 'elevated' | 'critical';

/** Data provenance origin */
export type DataProvenanceSource = 'live' | 'seeded' | 'hybrid';

/** Data provenance metadata */
export interface ProvenanceMetadata {
  liveRecordCount: number;
  seededRecordCount: number;
  primarySource: DataProvenanceSource;
  lastLiveIntakeDate?: string;
}

/** Summary data shown on the map overview (Screen 1) */
export interface DistrictSummary {
  /** Unique ID — matches Dist_Code from TopoJSON properties */
  id: string;
  /** Human-readable district name, e.g. "Chennai" */
  name: string;
  /** Total patient cases or abnormal cases */
  caseCount: number;
  /** Computed risk classification */
  riskLevel: RiskLevel;
  /** Centroid latitude for badge/label positioning */
  latitude: number;
  /** Centroid longitude for badge/label positioning */
  longitude: number;
}

/** A single point in the weekly time-series */
export interface TimeSeriesPoint {
  week: string;
  actual?: number;
  baseline?: number;
  forecast?: number;
  upperBound?: number;
  lowerBound?: number;
}

/** Root cause item */
export interface RootCauseItem {
  cause: string;
  count: number;
}

/** Contributing factor alias for backward compatibility */
export interface ContributingFactor {
  name: string;
  importance?: number;
  count?: number;
  direction?: 'increasing' | 'decreasing';
}

/** AI-generated insight for a district or village */
export interface AIInsight {
  summary: string;
  recommendation: string;
  dataSourceNote?: string;
}

/** Summary data for a village/taluk within a district */
export interface VillageSummary {
  villageId: string;
  name: string;
  districtId: string;
  caseCount: number; // total patient population in CSV
  weeklyCaseCount: number; // abnormal cases in most recent visit
  riskLevel: RiskLevel;
  abnormalRate?: number; // abnormal percentage (0-100)
  provenance?: ProvenanceMetadata;
}

/** Full detail payload for a single village */
export interface VillageDetail {
  summary: VillageSummary;
  districtName: string;
  timeSeries?: TimeSeriesPoint[];
  weeklyTrend?: WeeklyTrendPoint[];
  causes?: RootCauseStat[];
  vitalFlags?: VitalFlagStat[];
  sampleCases?: CaseHistoryRecord[];
  factors?: ContributingFactor[];
  insight: AIInsight;
  provenance?: ProvenanceMetadata;
}

/** Full detail payload for a single district (Screen 2: Rollup Dashboard) */
export interface DistrictDetail {
  summary: DistrictSummary;
  villages: VillageSummary[];
  flaggedVillageCount: number;
  totalVillageCount: number;
  totalDistrictPatients?: number;
  totalDistrictAbnormal?: number;
  liveIntakeReportCount?: number;
  timeSeries?: TimeSeriesPoint[];
  factors?: ContributingFactor[];
  insight?: AIInsight;
}
