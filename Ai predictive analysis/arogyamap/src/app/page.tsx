import { getDistrictSummaries } from '@/data/districts';
import { MapLegend } from '@/components/MapLegend';
import { TamilNaduMap } from '@/components/TamilNaduMap';
import { LiveDemoToolbar } from '@/components/LiveDemoToolbar';

export default async function HomePage() {
  const districts = await getDistrictSummaries();

  return (
    <div className="h-[calc(100vh-61px)] flex flex-col px-4 sm:px-6 py-2.5 max-w-[1536px] mx-auto overflow-hidden">
      {/* Compact Page header & Live Simulation Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2 shrink-0">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
            Tamil Nadu — Regional Surveillance Map
          </h2>
          <p className="text-xs text-slate-500">
            Real patient intake vitals &amp; physician root-cause surveillance. Click any district to inspect village units.
          </p>
        </div>

        {/* Live Demo Simulation Bar */}
        <div className="shrink-0">
          <LiveDemoToolbar />
        </div>
      </div>

      {/* Main content grid: Map + Legend - Fits exact screen height */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 pb-1">
        {/* Map Area - Expanded column span for larger visual presence */}
        <div className="lg:col-span-8 xl:col-span-9 h-full min-h-0">
          <div className="card p-2 sm:p-3 h-full flex items-center justify-center min-h-0 overflow-hidden relative shadow-xs">
            <TamilNaduMap districts={districts} />
          </div>
        </div>

        {/* Legend Sidebar */}
        <div className="lg:col-span-4 xl:col-span-3 h-full min-h-0">
          <MapLegend districts={districts} />
        </div>
      </div>
    </div>
  );
}