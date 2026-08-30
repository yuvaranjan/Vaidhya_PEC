import Link from 'next/link';

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="mx-auto max-w-[1440px] px-6 py-3 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          {/* Pulse icon */}
          <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center
                          group-hover:bg-brand-700 transition-colors">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">
              VaidhyaPredict
            </h1>
            <p className="text-[11px] text-slate-400 leading-tight tracking-wide uppercase font-semibold">
              Public Health &amp; Predictive Analytics
            </p>
          </div>
        </Link>

        {/* Right side — status indicator */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500">
            <span className="w-2 h-2 rounded-full bg-risk-normal animate-pulse" />
            <span className="font-medium">Live — Tamil Nadu</span>
          </div>
          <div className="text-xs text-slate-400 hidden md:block">
            Last updated: {new Date().toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
