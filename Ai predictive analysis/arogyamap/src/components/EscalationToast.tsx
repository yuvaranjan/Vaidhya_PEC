'use client';

import { useLiveDemo } from '@/context/LiveDemoContext';

export function EscalationToast() {
  const { escalationAlert, dismissAlert } = useLiveDemo();

  if (!escalationAlert) return null;

  return (
    <aside
      aria-label="Epidemiological Outbreak Alert"
      className="fixed bottom-5 right-5 z-50 max-w-md bg-white border-2 border-red-500 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom-5 duration-300"
    >
      <div className="flex items-start gap-3">
        {/* Animated warning icon */}
        <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center text-white shrink-0 shadow-sm animate-pulse">
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
              Live Threshold Escalation
            </span>
            <span className="text-[10px] text-slate-400 font-mono">{escalationAlert.timestamp}</span>
          </div>

          <h4 className="text-sm font-bold text-slate-900 mt-1 leading-snug">
            {escalationAlert.villageName} ({escalationAlert.districtName}) has escalated to{' '}
            <span className="text-red-600 font-extrabold">CRITICAL</span>
          </h4>

          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            Abnormal vitals rate has crossed <span className="font-bold text-slate-900">{escalationAlert.abnormalRate}%</span> ({escalationAlert.ratioVsBaseline}× regional baseline) driven by acute <span className="font-semibold text-slate-800">{escalationAlert.dominantFlag}</span> reports.
          </p>

          <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <span className="text-[11px] font-semibold text-brand-600 flex items-center gap-1">
              <span>✨ AI Insight auto-refreshed</span>
            </span>
            <button
              type="button"
              onClick={dismissAlert}
              className="text-xs font-bold text-slate-500 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
