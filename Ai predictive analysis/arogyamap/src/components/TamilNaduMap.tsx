'use client';

import { useRouter } from 'next/navigation';
import { useState, useMemo, useEffect } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps';
import type { DistrictSummary, RiskLevel } from '@/data/types';
import { RiskBadge } from './RiskBadge';
import { useLiveDemo } from '@/context/LiveDemoContext';

const TOPOJSON_URL = '/tamil-nadu.topojson';

/** Map risk levels to fill colors */
const riskFillColors: Record<RiskLevel, { default: string; hover: string; pulse: string }> = {
  normal: { default: '#86efac', hover: '#4ade80', pulse: '#22c55e' },
  elevated: { default: '#fde047', hover: '#facc15', pulse: '#eab308' },
  critical: { default: '#fca5a5', hover: '#f87171', pulse: '#ef4444' },
};

const DEFAULT_FILL = '#e2e8f0';
const STROKE_COLOR = '#94a3b8';
const DEFAULT_CENTER: [number, number] = [78.45, 11.0];
const DEFAULT_ZOOM = 1;

interface TamilNaduMapProps {
  districts: DistrictSummary[];
}

/** Build a lookup from Dist_Name → DistrictSummary */
function buildLookup(districts: DistrictSummary[]): Map<string, DistrictSummary> {
  const map = new Map<string, DistrictSummary>();
  for (const d of districts) {
    map.set(d.name.toLowerCase(), d);
  }
  return map;
}

export function TamilNaduMap({ districts }: TamilNaduMapProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | RiskLevel>('all');
  const [position, setPosition] = useState<{ coordinates: [number, number]; zoom: number }>({
    coordinates: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
  });

  // Live Demo Context for real-time pulse and counts
  const { lastUpdatedDistrict, getDistrictLiveCaseCount } = useLiveDemo();

  const [tooltipData, setTooltipData] = useState<{
    name: string;
    count: number;
    level: RiskLevel;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const lookup = useMemo(() => buildLookup(districts), [districts]);

  // Counts for filter pills
  const counts = useMemo(() => {
    return {
      all: districts.length,
      critical: districts.filter((d) => d.riskLevel === 'critical').length,
      elevated: districts.filter((d) => d.riskLevel === 'elevated').length,
      normal: districts.filter((d) => d.riskLevel === 'normal').length,
    };
  }, [districts]);

  // Zoom control handlers
  function handleZoomIn() {
    if (position.zoom >= 4) return;
    setPosition((pos) => ({ ...pos, zoom: Number((pos.zoom * 1.35).toFixed(2)) }));
  }

  function handleZoomOut() {
    if (position.zoom <= 1) return;
    setPosition((pos) => ({ ...pos, zoom: Math.max(1, Number((pos.zoom / 1.35).toFixed(2))) }));
  }

  function handleReset() {
    setPosition({ coordinates: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
    setActiveFilter('all');
  }

  function handleFocusDistrict(districtId: string) {
    const target = districts.find((d) => d.id === districtId);
    if (target) {
      setPosition({
        coordinates: [target.longitude, target.latitude],
        zoom: 2.4,
      });
    }
  }

  function handleMoveEnd(position: { coordinates: [number, number]; zoom: number }) {
    setPosition(position);
  }

  function handleClick(distName: string) {
    const d = lookup.get(distName.toLowerCase());
    if (d) {
      router.push(`/region/${d.id}`);
    }
  }

  function handleMouseEnter(
    geo: { properties: { Dist_Name?: string } },
    evt: React.MouseEvent
  ) {
    const name = geo.properties.Dist_Name || '';
    const d = lookup.get(name.toLowerCase());
    if (d) {
      const liveCount = getDistrictLiveCaseCount(d.id, d.caseCount);
      setHoveredId(d.id);
      setTooltipData({
        name: d.name,
        count: liveCount,
        level: d.riskLevel,
        x: evt.clientX,
        y: evt.clientY,
      });
    }
  }

  function handleMouseLeave() {
    setHoveredId(null);
    setTooltipData(null);
  }

  if (!mounted) {
    return (
      <div className="w-full h-full flex items-center justify-center min-h-[360px]">
        <div className="flex flex-col items-center gap-2.5">
          <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          <p className="text-xs text-slate-400">Loading Tamil Nadu Map…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center min-h-0 select-none overflow-hidden group/map">
      {/* ── Top-Left Floating Controls: Risk Filter & District Switcher ── */}
      <div className="absolute top-2.5 left-2.5 z-20 flex flex-wrap items-center gap-1.5 bg-white/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-200/90 shadow-sm max-w-[calc(100%-120px)]">
        {/* Risk Filter Segmented Control */}
        <div className="flex items-center gap-1 bg-slate-100/90 p-0.5 rounded-lg text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-2.5 py-1 rounded-md transition-all ${
              activeFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('critical')}
            className={`px-2 py-1 rounded-md flex items-center gap-1 transition-all ${
              activeFilter === 'critical'
                ? 'bg-red-500 text-white shadow-xs'
                : 'text-red-700 hover:bg-red-50'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${activeFilter === 'critical' ? 'bg-white' : 'bg-red-500'}`} />
            Critical ({counts.critical})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('elevated')}
            className={`px-2 py-1 rounded-md flex items-center gap-1 transition-all ${
              activeFilter === 'elevated'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-amber-700 hover:bg-amber-50'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${activeFilter === 'elevated' ? 'bg-white' : 'bg-amber-500'}`} />
            Elevated ({counts.elevated})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('normal')}
            className={`px-2 py-1 rounded-md flex items-center gap-1 transition-all ${
              activeFilter === 'normal'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${activeFilter === 'normal' ? 'bg-white' : 'bg-emerald-600'}`} />
            Normal ({counts.normal})
          </button>
        </div>

        {/* Quick District Focus Dropdown */}
        <select
          onChange={(e) => {
            if (e.target.value) handleFocusDistrict(e.target.value);
          }}
          defaultValue=""
          className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer shadow-2xs hover:border-slate-300"
        >
          <option value="" disabled>
            Focus District ▾
          </option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.riskLevel.toUpperCase()})
            </option>
          ))}
        </select>
      </div>

      {/* ── Top-Right Floating Zoom & Navigation Controls ── */}
      <div className="absolute top-2.5 right-2.5 z-20 flex flex-col gap-1 bg-white/90 backdrop-blur-md p-1 rounded-xl border border-slate-200/90 shadow-sm">
        <button
          type="button"
          onClick={handleZoomIn}
          title="Zoom In"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors font-bold text-lg"
        >
          +
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          title="Zoom Out"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors font-bold text-lg"
        >
          −
        </button>
        <div className="h-px bg-slate-200 my-0.5" />
        <button
          type="button"
          onClick={handleReset}
          title="Reset Map View"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-brand-50 hover:text-brand-600 active:bg-brand-100 transition-colors text-sm"
        >
          ⟲
        </button>
      </div>

      {/* ── Bottom-Left Subtle Interaction Hint ── */}
      <div className="absolute bottom-2 left-3 z-10 pointer-events-none opacity-60 group-hover/map:opacity-90 transition-opacity">
        <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5 bg-white/80 backdrop-blur-xs px-2 py-1 rounded-md border border-slate-200/60 shadow-2xs">
          <span>🖐️ Drag to pan</span>
          <span>·</span>
          <span>🔍 Scroll or use + / − to zoom</span>
          <span>·</span>
          <span>👆 Click district to drill down</span>
        </p>
      </div>

      {/* ── Interactive SVG Map with ZoomableGroup ── */}
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 7400,
          center: DEFAULT_CENTER,
        }}
        width={600}
        height={650}
        style={{ width: '100%', height: '100%', maxHeight: '100%', cursor: 'grab' }}
      >
        <ZoomableGroup
          center={position.coordinates}
          zoom={position.zoom}
          minZoom={1}
          maxZoom={4.5}
          onMoveEnd={handleMoveEnd}
        >
          <Geographies geography={TOPOJSON_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const distName: string = geo.properties.Dist_Name || '';
                const d = lookup.get(distName.toLowerCase());
                const isHovered = d && hoveredId === d.id;

                const matchesFilter = !d || activeFilter === 'all' || d.riskLevel === activeFilter;

                let fill = DEFAULT_FILL;
                let opacity = matchesFilter ? 1 : 0.28;

                if (d) {
                  const colors = riskFillColors[d.riskLevel];
                  fill = isHovered ? colors.hover : colors.default;
                }

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fill}
                    stroke={matchesFilter ? STROKE_COLOR : '#cbd5e1'}
                    strokeWidth={isHovered ? 1.8 : 0.8}
                    opacity={opacity}
                    style={{
                      default: { outline: 'none', cursor: d ? 'pointer' : 'default', transition: 'all 200ms ease' },
                      hover: { outline: 'none', opacity: 1 },
                      pressed: { outline: 'none' },
                    }}
                    onClick={() => handleClick(distName)}
                    onMouseEnter={(evt: React.MouseEvent) =>
                      handleMouseEnter(geo, evt)
                    }
                    onMouseLeave={handleMouseLeave}
                  />
                );
              })
            }
          </Geographies>

          {/* Case count badges on each district */}
          {districts.map((d) => {
            const matchesFilter = activeFilter === 'all' || d.riskLevel === activeFilter;
            if (!matchesFilter) return null;

            const isPulsing =
              lastUpdatedDistrict &&
              lastUpdatedDistrict.toLowerCase() === d.name.toLowerCase();

            const currentCount = getDistrictLiveCaseCount(d.id, d.caseCount);

            return (
              <Marker key={d.id} coordinates={[d.longitude, d.latitude]}>
                <g
                  onClick={() => router.push(`/region/${d.id}`)}
                  style={{ cursor: 'pointer' }}
                  className="transition-transform duration-200 hover:scale-115"
                >
                  {/* Pulsing radar wave if district received live intake */}
                  {isPulsing && (
                    <circle
                      r={24}
                      fill="#ef4444"
                      opacity={0.3}
                      className="animate-ping pointer-events-none"
                    />
                  )}

                  {/* Background pill */}
                  <rect
                    x={-19}
                    y={-11}
                    width={38}
                    height={22}
                    rx={11}
                    fill="white"
                    fillOpacity={0.96}
                    stroke={
                      isPulsing
                        ? '#dc2626'
                        : d.riskLevel === 'critical'
                        ? '#dc2626'
                        : d.riskLevel === 'elevated'
                        ? '#d97706'
                        : '#16a34a'
                    }
                    strokeWidth={isPulsing ? 2.5 : 1.8}
                    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.12))' }}
                  />

                  {/* Count text */}
                  <text
                    textAnchor="middle"
                    y={4}
                    style={{
                      fontFamily: 'Inter, system-ui, sans-serif',
                      fontSize: '11px',
                      fontWeight: 700,
                      fill:
                        d.riskLevel === 'critical'
                          ? '#dc2626'
                          : d.riskLevel === 'elevated'
                            ? '#d97706'
                            : '#16a34a',
                    }}
                  >
                    {currentCount}
                  </text>
                </g>
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

      {/* ── Modern Glassmorphic Tooltip ── */}
      {tooltipData && (
        <div
          className="fixed z-50 pointer-events-none px-3.5 py-2.5 bg-white/95 backdrop-blur-md rounded-xl border border-slate-200/90
                     shadow-xl text-xs space-y-1 transform -translate-x-1/2 -translate-y-full mb-3 animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: tooltipData.x,
            top: tooltipData.y - 12,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold text-slate-900 text-sm">{tooltipData.name}</p>
            <RiskBadge level={tooltipData.level} size="sm" />
          </div>
          <p className="text-slate-600 font-medium">
            <span className="font-extrabold text-slate-900">{tooltipData.count}</span> reported patient cases
          </p>
          <p className="text-[10px] text-brand-600 font-semibold pt-1 border-t border-slate-100 flex items-center gap-1">
            <span>Click to inspect village surveillance</span>
            <span>→</span>
          </p>
        </div>
      )}
    </div>
  );
}
