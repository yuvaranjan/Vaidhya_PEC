import type { AIInsight } from '@/data/types';

interface AIInsightCardProps {
  insight: AIInsight;
}

export function AIInsightCard({ insight }: AIInsightCardProps) {
  return (
    <div
      className="rounded-xl border-l-4 border border-l-[var(--color-ai-accent)]
                 border-r-[var(--color-ai-border)] border-t-[var(--color-ai-border)]
                 border-b-[var(--color-ai-border)]
                 bg-[var(--color-ai-bg)] p-5"
    >
      {/* Header with AI icon */}
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: 'var(--color-ai-accent)' }}
        >
          {/* Sparkle icon */}
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-800">AI Insight</h3>
          <p className="text-xs text-slate-400">Automated epidemiological analysis · updated today</p>
        </div>
      </div>

      {/* Summary */}
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">
        {insight.summary}
      </p>

      {/* Recommendation callout */}
      <div className="bg-white/70 rounded-lg border border-[var(--color-ai-border)] px-4 py-3 mb-3">
        <div className="flex items-start gap-2">
          <svg
            className="w-4 h-4 mt-0.5 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-ai-accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1">
              Recommended Action
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">
              {insight.recommendation}
            </p>
          </div>
        </div>
      </div>

      {/* Data Source Provenance & Clinical Review Disclaimer */}
      <div className="pt-2 border-t border-[var(--color-ai-border)]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-400">
        <span className="font-medium text-slate-500 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
          {insight.dataSourceNote || 'Data source: Seeded surveillance data'}
        </span>
        <span className="italic">Hypothesis for health officer review — not a clinical diagnosis</span>
      </div>
    </div>
  );
}
