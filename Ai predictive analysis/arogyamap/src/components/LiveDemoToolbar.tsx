'use client';

import { useLiveDemo } from '@/context/LiveDemoContext';

export function LiveDemoToolbar() {
  const {
    isLiveRunning,
    sessionVisitCount,
    toggleLiveDemo,
    resetDemoData,
    triggerManualTick,
    lastUpdatedVillage,
  } = useLiveDemo();

  return (
    <div className="flex items-center justify-between gap-3 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200/90 shadow-sm flex-wrap text-xs">
      {/* Left: Status & Live Ticker */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isLiveRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
            }`}
          />
          <span className="font-bold text-slate-800">
            {isLiveRunning ? 'Live Demo Mode Active' : 'Live Demo Mode'}
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 font-semibold text-slate-600">
          <span>Processed:</span>
          <span className="font-extrabold text-brand-600">{sessionVisitCount}</span>
          <span className="text-[10px] text-slate-400">visits</span>
        </div>

        {/* Real-time intake indicator */}
        {lastUpdatedVillage && (
          <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 animate-in fade-in duration-150">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            New intake: {lastUpdatedVillage}
          </span>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5">
        {/* Step 1 manually */}
        <button
          type="button"
          onClick={triggerManualTick}
          title="Simulate 1 incoming patient visit immediately"
          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-semibold transition-colors flex items-center gap-1 shadow-2xs"
        >
          <span>⚡ +1 Visit</span>
        </button>

        {/* Play/Pause Toggle */}
        <button
          type="button"
          onClick={toggleLiveDemo}
          className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all shadow-xs ${
            isLiveRunning
              ? 'bg-amber-500 hover:bg-amber-600 text-white'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          {isLiveRunning ? (
            <>
              <span>⏸</span>
              <span>Pause</span>
            </>
          ) : (
            <>
              <span>▶</span>
              <span>Start Live Demo</span>
            </>
          )}
        </button>

        {/* Reset Button */}
        {sessionVisitCount > 0 && (
          <button
            type="button"
            onClick={resetDemoData}
            title="Reset data back to static CSV baseline"
            className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 font-semibold transition-colors flex items-center gap-1 shadow-2xs"
          >
            <span>⟲</span>
            <span className="hidden sm:inline">Reset</span>
          </button>
        )}
      </div>
    </div>
  );
}
