'use client';

import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import type { RootCauseStat, VitalFlagStat } from '@/lib/csvAdapter';

interface ContributingFactorsProps {
  causes?: RootCauseStat[];
  vitalFlags?: VitalFlagStat[];
  factors?: Array<{ name: string; importance?: number; count?: number; direction?: 'increasing' | 'decreasing' }>;
}

const BAR_COLOR = '#0284c7'; // brand blue

/** Custom tooltip */
function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload: { name: string; count: number };
    value: number;
  }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="bg-white rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-md">
      <p className="font-semibold text-slate-800">{item.name}</p>
      <p className="text-slate-600 mt-0.5">
        Documented in <span className="font-bold text-brand-600">{item.count}</span> patient visits
      </p>
    </div>
  );
}

export function ContributingFactors({ causes, vitalFlags, factors }: ContributingFactorsProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Adapt input data
  const rootCausesData =
    causes && causes.length > 0
      ? causes.map((c) => ({ name: c.cause, count: c.count }))
      : factors && factors.length > 0
      ? factors.map((f) => ({ name: f.name, count: f.count ?? f.importance ?? 1 }))
      : [];

  if (!mounted) {
    return (
      <div className="card">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-slate-800">
            Doctor-Noted Root Causes
          </h3>
          <p className="text-sm text-slate-400 mt-0.5">
            Most frequent clinical triggers documented by examining physicians
          </p>
        </div>
        <div className="w-full flex items-center justify-center bg-slate-50 rounded-lg" style={{ height: 260 }}>
          <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="card flex flex-col justify-between">
      <div>
        <div className="mb-3">
          <h3 className="text-base font-bold text-slate-900">
            Doctor-Noted Root Causes
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Most common clinical etiologies documented by physicians for abnormal cases
          </p>
        </div>

        {/* Vital Flags Breakdown Pills */}
        {vitalFlags && vitalFlags.length > 0 && (
          <div className="mb-4 pt-2 pb-3 border-b border-slate-100">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Dominant Vital Abnormalities
            </p>
            <div className="flex flex-wrap gap-2">
              {vitalFlags.map((vf) => (
                <div
                  key={vf.flag}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-xs font-semibold text-slate-700"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      vf.flag === 'fever'
                        ? 'bg-red-500'
                        : vf.flag === 'low_spo2'
                        ? 'bg-amber-500'
                        : vf.flag === 'tachycardia'
                        ? 'bg-purple-500'
                        : 'bg-blue-500'
                    }`}
                  />
                  <span>{vf.label.split(' (')[0]}</span>
                  <span className="font-extrabold text-slate-900 ml-0.5">{vf.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bar chart of top causes */}
        <div className="w-full" style={{ height: 180 }}>
          {rootCausesData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              No specific root causes flagged (normal baseline)
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rootCausesData}
                layout="vertical"
                margin={{ top: 4, right: 30, bottom: 4, left: 10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f1f5f9"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 11, fill: '#475569' }}
                  tickLine={false}
                  axisLine={false}
                  width={170}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18} fill={BAR_COLOR} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="pt-2.5 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Source: Physician notes in case history</span>
        <span>Most recent patient visits</span>
      </div>
    </div>
  );
}
