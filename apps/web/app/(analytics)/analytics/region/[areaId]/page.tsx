import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDistrictDetail, getAvailableDetailIds } from '@/data/district-details';
import { RiskBadge } from '@/components/RiskBadge';
import { VillageGrid } from '@/components/VillageGrid';
import { LiveDemoToolbar } from '@/components/LiveDemoToolbar';

/** Generate static params for all known districts */
export async function generateStaticParams() {
  const ids = getAvailableDetailIds();
  return ids.map((areaId) => ({ areaId }));
}

/** Dynamic metadata per district */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ areaId: string }>;
}) {
  const { areaId } = await params;
  const detail = await getDistrictDetail(areaId);
  if (!detail) return { title: 'District Not Found — VaidhyaPredict' };
  return {
    title: `${detail.summary.name} District Rollup — VaidhyaPredict`,
    description: `Village-level patient vitals surveillance and aggregate rollup for ${detail.summary.name} district, Tamil Nadu.`,
  };
}

export default async function DistrictRollupPage({
  params,
}: {
  params: Promise<{ areaId: string }>;
}) {
  const { areaId } = await params;
  const detail = await getDistrictDetail(areaId);

  if (!detail) {
    notFound();
  }

  const { summary, villages, flaggedVillageCount, totalVillageCount, totalDistrictPatients = 0, totalDistrictAbnormal = 0 } = detail;
  const criticalCount = villages.filter((v) => v.riskLevel === 'critical').length;
  const elevatedCount = villages.filter((v) => v.riskLevel === 'elevated').length;

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-8">
      {/* Top row: Back link + Live Simulation Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600
                     transition-colors group font-medium"
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
          Back to Map
        </Link>

        {/* Live Demo Simulation Bar */}
        <div className="shrink-0">
          <LiveDemoToolbar />
        </div>
      </div>

      {/* District Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-3xl font-bold text-slate-900">{summary.name} District</h2>
            <RiskBadge level={summary.riskLevel} size="md" />

            {/* Live Intake Summary Pill */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Patient Intake ({totalDistrictPatients || summary.caseCount} records)
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            District Rollup · Real-time ground surveillance across {totalVillageCount} monitored villages &amp; taluks
          </p>
        </div>

        <div className="flex items-center gap-6 bg-white px-5 py-3 rounded-xl border border-slate-200 shadow-xs">
          <div>
            <p className="text-2xl font-bold text-slate-900">
              {totalDistrictAbnormal || summary.caseCount}
            </p>
            <p className="text-xs text-slate-400 font-medium">Abnormal Vitals</p>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <p className="text-2xl font-bold text-slate-900">{totalVillageCount}</p>
            <p className="text-xs text-slate-400 font-medium">Villages Monitored</p>
          </div>
        </div>
      </div>

      {/* Rollup Summary Banner */}
      <div
        className={`rounded-xl border p-5 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          criticalCount > 0
            ? 'bg-risk-critical-bg border-risk-critical-border'
            : flaggedVillageCount > 0
            ? 'bg-risk-elevated-bg border-risk-elevated-border'
            : 'bg-risk-normal-bg border-risk-normal-border'
        }`}
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              criticalCount > 0
                ? 'bg-risk-critical text-white'
                : flaggedVillageCount > 0
                ? 'bg-risk-elevated text-white'
                : 'bg-risk-normal text-white'
            }`}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {criticalCount > 0 ? (
                <>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </>
              ) : (
                <>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </>
              )}
            </svg>
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {flaggedVillageCount} of {totalVillageCount} villages flagged this week
            </h3>
            <p className="text-sm text-slate-600 mt-0.5">
              {criticalCount > 0
                ? `${criticalCount} village with acute outbreak spike requiring immediate field dispatch (${elevatedCount} elevated).`
                : flaggedVillageCount > 0
                ? `${flaggedVillageCount} villages showing elevated transmission above baseline.`
                : 'All monitored villages are reporting case counts within normal seasonal baselines.'}
            </p>
          </div>
        </div>

        {/* Quick summary pill breakdown */}
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/80 border border-slate-200 text-slate-700">
            {criticalCount} Critical
          </span>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/80 border border-slate-200 text-slate-700">
            {elevatedCount} Elevated
          </span>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/80 border border-slate-200 text-slate-700">
            {totalVillageCount - flaggedVillageCount} Normal
          </span>
        </div>
      </div>

      {/* Villages List Section Header */}
      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-900">Village &amp; Taluk Surveillance Units</h3>
        <p className="text-sm text-slate-500">
          Filter and select any village unit to view localized epidemiological trends, environmental drivers, and AI response guidance.
        </p>
      </div>

      {/* Interactive Grid of Village Cards with Search & Filters */}
      <VillageGrid areaId={areaId} villages={villages} />
    </div>
  );
}
