"use client";

import { useState } from "react";
import type { DistrictSummary } from "@/data/types";
import type { CaseRow } from "@/lib/mockAnalytics";
import { TamilNaduMap } from "@/components/TamilNaduMap";
import { MapLegend } from "@/components/MapLegend";
import { LiveDemoToolbar } from "@/components/LiveDemoToolbar";
import { Header } from "@/components/Header";
import { Maximize2, Minimize2, Sliders } from "lucide-react";

interface AnalyticsViewHubProps {
  districts: DistrictSummary[];
  rows?: CaseRow[];
  isMock?: boolean;
}

export function AnalyticsViewHub({ districts }: AnalyticsViewHubProps) {
  // Default reduced map height (460px instead of 620px)
  const [mapHeight, setMapHeight] = useState<number>(460);

  const presets = [
    { label: "Compact", height: 380 },
    { label: "Medium", height: 460 },
    { label: "Large", height: 560 },
    { label: "Max", height: 680 },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Brand Header */}
      <Header />

      <main className="flex-1 flex flex-col max-w-[1536px] w-full mx-auto px-4 sm:px-6 py-3">
        {/* Subheader & Live Demo Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
              Tamil Nadu — Public Health Surveillance Map
            </h2>
            <p className="text-xs text-slate-500">
              Ground-level patient vitals &amp; doctor diagnostic root-cause surveillance across 5,000+ rural patient encounters.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Map Size Adjustment Controller */}
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <Sliders className="w-3.5 h-3.5 text-[#2B9C95]" />
                <span className="hidden sm:inline">Map Size:</span>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px] font-bold">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setMapHeight(preset.height)}
                    className={`px-2 py-0.5 rounded-md transition-all ${
                      mapHeight === preset.height
                        ? "bg-white text-[#173F59] shadow-2xs font-extrabold"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Slider for fine adjustment */}
              <div className="hidden lg:flex items-center gap-1.5 pl-1.5 border-l border-slate-200">
                <input
                  type="range"
                  min="320"
                  max="700"
                  step="20"
                  value={mapHeight}
                  onChange={(e) => setMapHeight(Number(e.target.value))}
                  className="w-20 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#2B9C95]"
                  title={`Custom height: ${mapHeight}px`}
                />
                <span className="font-mono text-[10px] text-slate-500 w-9 text-right font-medium">
                  {mapHeight}px
                </span>
              </div>
            </div>

            <LiveDemoToolbar />
          </div>
        </div>

        {/* ArogyaMap State Surveillance Map & Legend */}
        <div className="flex-1 min-h-0 flex flex-col pt-3">
          <div
            className="grid grid-cols-1 lg:grid-cols-12 gap-3 pb-4 transition-all duration-300"
            style={{ minHeight: `${mapHeight}px` }}
          >
            {/* Interactive Vector TopoJSON Map */}
            <div
              className="lg:col-span-8 xl:col-span-9 transition-all duration-300"
              style={{ height: `${mapHeight}px` }}
            >
              <div
                className="card p-2 sm:p-3 w-full h-full flex items-center justify-center overflow-hidden relative shadow-xs bg-white rounded-2xl border border-slate-200"
                style={{ height: `${mapHeight}px` }}
              >
                <TamilNaduMap districts={districts} />
              </div>
            </div>

            {/* Legend & District Quick Selector */}
            <div
              className="lg:col-span-4 xl:col-span-3 transition-all duration-300"
              style={{ height: `${mapHeight}px` }}
            >
              <div className="h-full overflow-y-auto">
                <MapLegend districts={districts} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
