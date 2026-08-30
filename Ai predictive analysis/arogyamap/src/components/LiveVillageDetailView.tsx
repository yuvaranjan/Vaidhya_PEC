'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import type { VillageDetail } from '@/data/types';
import { RiskBadge } from './RiskBadge';
import { CaseTrendChart } from './CaseTrendChart';
import { ContributingFactors } from './ContributingFactors';
import { AIInsightCard } from './AIInsightCard';
import { SampleCaseCards } from './SampleCaseCards';
import { useLiveDemo } from '@/context/LiveDemoContext';
import { LiveDemoToolbar } from './LiveDemoToolbar';

interface LiveVillageDetailViewProps {
  initialDetail: VillageDetail;
  areaId: string;
}

export function LiveVillageDetailView({ initialDetail, areaId }: LiveVillageDetailViewProps) {
  const {
    getVillageLiveStats,
    getVillageRecentLiveVisits,
    lastUpdatedVillage,
    isLiveRunning,
  } = useLiveDemo();

  const villageName = initialDetail.summary.name;
  const districtName = initialDetail.districtName;

  // Check if live stats exist for this village
  const liveStats = getVillageLiveStats(villageName);
  const recentLiveVisits = getVillageRecentLiveVisits(villageName);

  // Compute live-updated summary
  const currentSummary = useMemo(() => {
    if (!liveStats) return initialDetail.summary;
    return {
      ...initialDetail.summary,
      caseCount: liveStats.totalPatients,
      weeklyCaseCount: liveStats.abnormalCount,
      riskLevel: liveStats.riskLevel,
      abnormalRate: liveStats.abnormalRate,
    };
  }, [initialDetail.summary, liveStats]);

  const abnormalRate =
    currentSummary.abnormalRate ??
    Math.round((currentSummary.weeklyCaseCount / Math.max(1, currentSummary.caseCount)) * 100);

  // Compute merged sample cases (prepending new live visits)
  const currentSampleCases = useMemo(() => {
    const baseCases = initialDetail.sampleCases || [];
    const abnormalLive = recentLiveVisits.filter((v) => v.vital_flag_status === 'abnormal');
    return [...abnormalLive, ...baseCases].slice(0, 4);
  }, [initialDetail.sampleCases, recentLiveVisits]);

  // Compute merged weekly trend
  const currentWeeklyTrend = useMemo(() => {
    const baseTrend = initialDetail.weeklyTrend || [];
    if (recentLiveVisits.length === 0) return baseTrend;

    const copy = [...baseTrend];
    if (copy.length > 0) {
      const lastIdx = copy.length - 1;
      const last = { ...copy[lastIdx] };
      const newTotal = last.totalVisits + recentLiveVisits.length;
      const newAbnormal =
        last.abnormalCount + recentLiveVisits.filter((v) => v.vital_flag_status === 'abnormal').length;
      last.totalVisits = newTotal;
      last.abnormalCount = newAbnormal;
      last.abnormalRate = newTotal > 0 ? Math.round((newAbnormal / newTotal) * 100) : last.abnormalRate;
      copy[lastIdx] = last;
    }
    return copy;
  }, [initialDetail.weeklyTrend, recentLiveVisits]);

  const isRecentlyUpdated =
    lastUpdatedVillage && lastUpdatedVillage.toLowerCase() === villageName.toLowerCase();

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-8">
      {/* Top Header: Breadcrumb & Live Simulation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2 text-sm">
          <Link href="/" className="text-slate-400 hover:text-brand-600 transition-colors font-medium">
            State Overview
          </Link>
          <span className="text-slate-300">/</span>
          <Link
            href={`/region/${areaId}`}
            className="inline-flex items-center gap-1.5 text-slate-600 hover:text-brand-600 transition-colors font-medium group"
          >
            <svg
              className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back to {districtName} District
          </Link>
        </div>

        {/* Live Demo Controls Toolbar */}
        <div className="shrink-0">
          <LiveDemoToolbar />
        </div>
      </div>

      {/* Village Header */}
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b transition-colors duration-300 ${
          isRecentlyUpdated ? 'bg-emerald-50/60 p-4 rounded-2xl border-emerald-200' : 'border-slate-200'
        }`}
      >
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-3xl font-bold text-slate-900">{currentSummary.name}</h2>
            <RiskBadge level={currentSummary.riskLevel} size="md" />

            {/* Data Provenance Badge */}
            {isLiveRunning ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Intake Stream Active ({currentSummary.caseCount} visits)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                Telemedicine Patient Intake ({currentSummary.caseCount} records)
              </span>
            )}

            {isRecentlyUpdated && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 animate-pulse">
                ⚡ Just Updated
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Primary telemedicine vitals &amp; physician diagnostic surveillance in {districtName} District
          </p>
        </div>

        <div className="flex items-center gap-6 bg-white px-5 py-3 rounded-xl border border-slate-200 shadow-xs">
          <div>
            <p className="text-2xl font-bold text-slate-900">
              {currentSummary.weeklyCaseCount}{' '}
              <span className="text-sm font-semibold text-slate-500">({abnormalRate}%)</span>
            </p>
            <p className="text-xs text-slate-400 font-medium">Abnormal Vitals</p>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <p className="text-2xl font-bold text-slate-900">{currentSummary.caseCount}</p>
            <p className="text-xs text-slate-400 font-medium">Patients Monitored</p>
          </div>
        </div>
      </div>

      {/* Top 3 Dashboard Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Row 1: Weekly Patient Vitals & Surveillance Trend */}
        <div className="xl:col-span-2">
          <CaseTrendChart weeklyTrend={currentWeeklyTrend} />
        </div>

        {/* Row 2: Doctor-Noted Root Causes & Dominant Vital Flags */}
        <div>
          <ContributingFactors causes={initialDetail.causes} vitalFlags={initialDetail.vitalFlags} />
        </div>

        {/* Row 2: AI Insight & Field Intervention Guidance */}
        <div>
          <AIInsightCard insight={initialDetail.insight} />
        </div>
      </div>

      {/* Row 3: Recent Flagged Patient Case Cards (Privacy-Conscious) */}
      {currentSampleCases && currentSampleCases.length > 0 && (
        <SampleCaseCards cases={currentSampleCases} villageName={currentSummary.name} />
      )}
    </div>
  );
}
