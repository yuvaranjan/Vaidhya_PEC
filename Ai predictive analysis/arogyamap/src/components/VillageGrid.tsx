'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { VillageSummary, RiskLevel } from '@/data/types';
import { RiskBadge } from './RiskBadge';
import { useLiveDemo } from '@/context/LiveDemoContext';

interface VillageGridProps {
  areaId: string;
  villages: VillageSummary[];
}

export function VillageGrid({ areaId, villages }: VillageGridProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRisk, setFilterRisk] = useState<'all' | RiskLevel>('all');

  const { getVillageLiveStats, lastUpdatedVillage } = useLiveDemo();

  // Compute live updated villages
  const liveVillages = useMemo(() => {
    return villages.map((v) => {
      const live = getVillageLiveStats(v.name);
      if (!live) return v;
      return {
        ...v,
        caseCount: live.totalPatients,
        weeklyCaseCount: live.abnormalCount,
        riskLevel: live.riskLevel,
        abnormalRate: live.abnormalRate,
      };
    });
  }, [villages, getVillageLiveStats]);

  const filteredVillages = useMemo(() => {
    return liveVillages.filter((v) => {
      const matchesSearch = v.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRisk = filterRisk === 'all' || v.riskLevel === filterRisk;
      return matchesSearch && matchesRisk;
    });
  }, [liveVillages, searchTerm, filterRisk]);

  const counts = useMemo(() => {
    return {
      all: liveVillages.length,
      critical: liveVillages.filter((v) => v.riskLevel === 'critical').length,
      elevated: liveVillages.filter((v) => v.riskLevel === 'elevated').length,
      normal: liveVillages.filter((v) => v.riskLevel === 'normal').length,
    };
  }, [liveVillages]);

  return (
    <div>
      {/* ── Search & Filter Toolbar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 bg-slate-100/80 p-2.5 rounded-xl border border-slate-200/80">
        {/* Risk Filter Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setFilterRisk('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterRisk === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Units ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setFilterRisk('critical')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              filterRisk === 'critical'
                ? 'bg-red-500 text-white shadow-xs'
                : 'text-red-700 hover:bg-red-50'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${filterRisk === 'critical' ? 'bg-white' : 'bg-red-500'}`} />
            Critical ({counts.critical})
          </button>
          <button
            type="button"
            onClick={() => setFilterRisk('elevated')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              filterRisk === 'elevated'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-amber-700 hover:bg-amber-50'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${filterRisk === 'elevated' ? 'bg-white' : 'bg-amber-500'}`} />
            Elevated ({counts.elevated})
          </button>
          <button
            type="button"
            onClick={() => setFilterRisk('normal')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              filterRisk === 'normal'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${filterRisk === 'normal' ? 'bg-white' : 'bg-emerald-600'}`} />
            Normal ({counts.normal})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search village or ward..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all shadow-2xs"
          />
          <svg
            className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
      </div>

      {/* ── Cards Grid ── */}
      {filteredVillages.length === 0 ? (
        <div className="card p-12 text-center bg-white">
          <p className="text-slate-500 text-sm font-medium">No villages match your filter criteria.</p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setFilterRisk('all');
            }}
            className="mt-3 text-xs text-brand-600 font-bold hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredVillages.map((village) => {
            const isPulsing =
              lastUpdatedVillage &&
              lastUpdatedVillage.toLowerCase() === village.name.toLowerCase();

            return (
              <Link
                key={village.villageId}
                href={`/region/${areaId}/village/${village.villageId}`}
                className={`group card p-5 transition-all flex flex-col justify-between bg-white relative overflow-hidden ${
                  isPulsing
                    ? 'border-2 border-emerald-500 shadow-md bg-emerald-50/30 ring-2 ring-emerald-200'
                    : 'hover:border-brand-500 hover:shadow-md'
                }`}
              >
                {/* Left risk color accent bar */}
                {village.riskLevel === 'critical' && (
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-risk-critical" />
                )}
                {village.riskLevel === 'elevated' && (
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-risk-elevated" />
                )}
                {village.riskLevel === 'normal' && (
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-risk-normal" />
                )}

                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-base font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                        {village.name}
                      </h4>
                      {isPulsing && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      )}
                    </div>
                    <RiskBadge level={village.riskLevel} size="sm" />
                  </div>

                  {/* Weekly count */}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-baseline justify-between">
                    <div>
                      <span className="text-2xl font-bold text-slate-900">{village.weeklyCaseCount}</span>
                      <span className="text-xs font-medium text-slate-500 ml-1.5">abnormal visits</span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {village.caseCount} patients
                    </span>
                  </div>
                </div>

                {/* Action */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 group-hover:text-brand-600 font-medium transition-colors">
                  <span>View local factors &amp; AI plan</span>
                  <svg
                    className="w-4 h-4 group-hover:translate-x-1 transition-transform text-slate-400 group-hover:text-brand-600"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14" />
                    <path d="M12 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
