import type { DistrictSummary, RiskLevel } from '@/data/types';

interface MapLegendProps {
  districts: DistrictSummary[];
}

export function MapLegend({ districts }: MapLegendProps) {
  const totalCases = districts.reduce((sum, d) => sum + d.caseCount, 0);
  const criticalCount = districts.filter((d) => d.riskLevel === 'critical').length;
  const elevatedCount = districts.filter((d) => d.riskLevel === 'elevated').length;
  const normalCount = districts.filter((d) => d.riskLevel === 'normal').length;

  const legendItems: { level: RiskLevel; label: string; description: string; color: string }[] = [
    {
      level: 'critical',
      label: 'Critical Anomaly',
      description: 'Acute village spike — field response required',
      color: '#fca5a5',
    },
    {
      level: 'elevated',
      label: 'Elevated Watch',
      description: 'Above seasonal village baseline',
      color: '#fde047',
    },
    {
      level: 'normal',
      label: 'Normal Baseline',
      description: 'Expected seasonal variance',
      color: '#86efac',
    },
  ];

  return (
    <div className="h-full flex flex-col justify-between gap-2.5 text-slate-800">
      {/* Combined Main Card: Surveillance Metrics & Color Scale */}
      <div className="card p-3.5 flex-1 flex flex-col justify-between">
        {/* Top: Summary Numbers */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Surveillance Rollup
            </h3>
            <span className="text-[11px] font-medium text-slate-500">Live Telemedicine</span>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2.5">
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/70">
              <p className="text-xl font-extrabold text-slate-900 leading-tight">{totalCases.toLocaleString()}</p>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">Reported Cases</p>
            </div>
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/70">
              <p className="text-xl font-extrabold text-slate-900 leading-tight">{districts.length}</p>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">Districts Tracked</p>
            </div>
          </div>

          {/* Risk breakdown pills */}
          <div className="grid grid-cols-3 gap-1.5 pb-2.5 border-b border-slate-100">
            <div className="text-center py-1 px-1 rounded-md bg-risk-critical-bg border border-risk-critical-border">
              <p className="text-xs font-extrabold text-risk-critical leading-tight">{criticalCount}</p>
              <p className="text-[9px] font-bold text-risk-critical uppercase">Critical</p>
            </div>
            <div className="text-center py-1 px-1 rounded-md bg-risk-elevated-bg border border-risk-elevated-border">
              <p className="text-xs font-extrabold text-risk-elevated leading-tight">{elevatedCount}</p>
              <p className="text-[9px] font-bold text-risk-elevated uppercase">Elevated</p>
            </div>
            <div className="text-center py-1 px-1 rounded-md bg-risk-normal-bg border border-risk-normal-border">
              <p className="text-xs font-extrabold text-risk-normal leading-tight">{normalCount}</p>
              <p className="text-[9px] font-bold text-risk-normal uppercase">Normal</p>
            </div>
          </div>
        </div>

        {/* Bottom of main card: Color Scale */}
        <div className="pt-2">
          <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Map Risk Legend
          </h4>
          <div className="space-y-1.5">
            {legendItems.map((item) => (
              <div key={item.level} className="flex items-center gap-2">
                <div
                  className="w-3.5 h-3.5 rounded-sm shrink-0 border border-slate-300 shadow-2xs"
                  style={{ backgroundColor: item.color }}
                />
                <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
                  <p className="text-xs font-bold text-slate-700">{item.label}</p>
                  <p className="text-[10px] text-slate-400 truncate">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Info Card - Compact & Never Clipped */}
      <div className="card p-2.5 bg-brand-50 border-brand-200 shrink-0 flex items-start gap-2">
        <svg
          className="w-4 h-4 text-brand-600 mt-0.5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <div>
          <p className="text-xs font-bold text-brand-900 leading-tight">
            Village-First Ground Detection
          </p>
          <p className="text-[10px] text-brand-700 mt-0.5 leading-snug">
            District values are rollups of village surveillance. Click any district on the map to inspect village-level outbreaks.
          </p>
        </div>
      </div>
    </div>
  );
}
