'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { CaseHistoryRecord } from '@/lib/csvAdapter';
import type { RiskLevel } from '@/data/types';
import { generateNextVisit } from '@/lib/liveDemoFeed';
import { getVillageBaseline, OVERALL_BASELINE_RATE } from '@/data/villageBaselines';

export interface EscalationAlert {
  id: number;
  villageName: string;
  districtName: string;
  abnormalRate: number;
  ratioVsBaseline: number;
  dominantFlag: string;
  timestamp: string;
}

export interface LiveVillageStats {
  totalPatients: number;
  abnormalCount: number;
  abnormalRate: number; // percentage (0-100)
  riskLevel: RiskLevel;
}

interface LiveDemoContextType {
  isLiveRunning: boolean;
  sessionVisitCount: number;
  lastUpdatedVillage: string | null;
  lastUpdatedDistrict: string | null;
  escalationAlert: EscalationAlert | null;
  liveVisits: CaseHistoryRecord[];
  dismissAlert: () => void;
  startLiveDemo: () => void;
  stopLiveDemo: () => void;
  toggleLiveDemo: () => void;
  resetDemoData: () => void;
  triggerManualTick: () => void;
  getVillageLiveStats: (villageName: string) => LiveVillageStats | null;
  getVillageRecentLiveVisits: (villageName: string) => CaseHistoryRecord[];
  getDistrictLiveCaseCount: (districtId: string, initialCases: number) => number;
}

const LiveDemoContext = createContext<LiveDemoContextType | undefined>(undefined);

// Simulation tick speed: 4.5 seconds (Simulates ~1 new patient intake every 30 mins in real rural clinics)
const TICK_INTERVAL_MS = 4500;

export function LiveDemoProvider({ children }: { children: React.ReactNode }) {
  const [isLiveRunning, setIsLiveRunning] = useState(false);
  const [sessionVisitCount, setSessionVisitCount] = useState(0);
  const [liveVisits, setLiveVisits] = useState<CaseHistoryRecord[]>([]);
  const [lastUpdatedVillage, setLastUpdatedVillage] = useState<string | null>(null);
  const [lastUpdatedDistrict, setLastUpdatedDistrict] = useState<string | null>(null);
  const [escalationAlert, setEscalationAlert] = useState<EscalationAlert | null>(null);

  // In-memory tracked village states
  const villageStatsRef = useRef<Map<string, LiveVillageStats>>(new Map());
  const pulseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Process a single new visit
  const processNewVisit = useCallback((newVisit: CaseHistoryRecord) => {
    const villageName = newVisit.region_village;
    const districtName = newVisit.district;

    setLiveVisits((prev) => [newVisit, ...prev]);
    setSessionVisitCount((c) => c + 1);

    // Visual pulse
    setLastUpdatedVillage(villageName);
    setLastUpdatedDistrict(districtName);
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => {
      setLastUpdatedVillage(null);
      setLastUpdatedDistrict(null);
    }, 2800);

    // Incremental recalculation for the affected village
    const baseStats = getVillageBaseline(villageName);
    const existingLiveForVillage = liveVisits.filter(
      (v) => v.region_village.toLowerCase() === villageName.toLowerCase()
    );

    const extraTotal = existingLiveForVillage.length + 1;
    const extraAbnormal =
      existingLiveForVillage.filter((v) => v.vital_flag_status === 'abnormal').length +
      (newVisit.vital_flag_status === 'abnormal' ? 1 : 0);

    const totalPatients = baseStats.totalPatients + extraTotal;
    const abnormalCount = baseStats.abnormalCount + extraAbnormal;
    const rate = totalPatients > 0 ? abnormalCount / totalPatients : 0;
    const abnormalRate = Math.round(rate * 100);

    const baseline = OVERALL_BASELINE_RATE;
    const ratio = baseline > 0 ? rate / baseline : 0;

    let newRisk: RiskLevel = 'normal';
    if (ratio >= 2.0) newRisk = 'critical';
    else if (ratio >= 1.4) newRisk = 'elevated';

    const prevStats = villageStatsRef.current.get(villageName.toLowerCase());
    const prevRisk = prevStats?.riskLevel ?? baseStats.riskLevel;

    // Check for escalation into Critical
    if (prevRisk !== 'critical' && newRisk === 'critical') {
      const dominantFlag = newVisit.vital_flag_types.split('+')[0] || 'fever';
      setEscalationAlert({
        id: Date.now(),
        villageName,
        districtName,
        abnormalRate,
        ratioVsBaseline: parseFloat(ratio.toFixed(1)),
        dominantFlag: dominantFlag.replace('_', ' '),
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
    }

    villageStatsRef.current.set(villageName.toLowerCase(), {
      totalPatients,
      abnormalCount,
      abnormalRate,
      riskLevel: newRisk,
    });
  }, [liveVisits]);

  // Interval ticker
  useEffect(() => {
    if (!isLiveRunning) return;

    const interval = setInterval(() => {
      const newVisit = generateNextVisit();
      processNewVisit(newVisit);
    }, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isLiveRunning, processNewVisit]);

  const startLiveDemo = useCallback(() => {
    setIsLiveRunning(true);
  }, []);

  const stopLiveDemo = useCallback(() => {
    setIsLiveRunning(false);
  }, []);

  const toggleLiveDemo = useCallback(() => {
    setIsLiveRunning((prev) => !prev);
  }, []);

  const resetDemoData = useCallback(() => {
    setIsLiveRunning(false);
    setLiveVisits([]);
    setSessionVisitCount(0);
    setLastUpdatedVillage(null);
    setLastUpdatedDistrict(null);
    setEscalationAlert(null);
    villageStatsRef.current.clear();
  }, []);

  const triggerManualTick = useCallback(() => {
    const newVisit = generateNextVisit();
    processNewVisit(newVisit);
  }, [processNewVisit]);

  const dismissAlert = useCallback(() => {
    setEscalationAlert(null);
  }, []);

  const getVillageLiveStats = useCallback((villageName: string): LiveVillageStats | null => {
    return villageStatsRef.current.get(villageName.toLowerCase()) || null;
  }, []);

  const getVillageRecentLiveVisits = useCallback((villageName: string): CaseHistoryRecord[] => {
    return liveVisits.filter(
      (v) => v.region_village.toLowerCase() === villageName.toLowerCase()
    );
  }, [liveVisits]);

  const getDistrictLiveCaseCount = useCallback((districtId: string, initialCases: number): number => {
    const districtNameMap: Record<string, string> = {
      '603': 'Chennai',
      '623': 'Madurai',
    };
    const targetName = districtNameMap[districtId];
    if (!targetName) return initialCases;

    const addedAbnormal = liveVisits.filter(
      (v) => v.district.toLowerCase() === targetName.toLowerCase() && v.vital_flag_status === 'abnormal'
    ).length;

    return initialCases + addedAbnormal;
  }, [liveVisits]);

  return (
    <LiveDemoContext.Provider
      value={{
        isLiveRunning,
        sessionVisitCount,
        lastUpdatedVillage,
        lastUpdatedDistrict,
        escalationAlert,
        liveVisits,
        dismissAlert,
        startLiveDemo,
        stopLiveDemo,
        toggleLiveDemo,
        resetDemoData,
        triggerManualTick,
        getVillageLiveStats,
        getVillageRecentLiveVisits,
        getDistrictLiveCaseCount,
      }}
    >
      {children}
    </LiveDemoContext.Provider>
  );
}

export function useLiveDemo() {
  const context = useContext(LiveDemoContext);
  if (!context) {
    throw new Error('useLiveDemo must be used within a LiveDemoProvider');
  }
  return context;
}
