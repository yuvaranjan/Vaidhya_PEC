import Link from 'next/link';

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-2xs">
      <div className="mx-auto max-w-[1536px] px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        {/* Brand & Portal Links */}
        <div className="flex items-center gap-6">
          <Link href="/analytics" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#173F59] to-[#2B9C95] flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-bold text-slate-900 leading-tight">
                  Vaidhya<span className="text-[#2B9C95]">Predict</span>
                </h1>
                <span className="text-[9px] font-bold uppercase tracking-wider bg-[#E5F5F3] text-[#14736A] px-1.5 py-0.2 rounded border border-[#2B9C95]/30">
                  AI Surveillance
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">
                Epidemic Surveillance &amp; Predictive Analytics
              </p>
            </div>
          </Link>

          {/* Quick Portal Switcher */}
          <nav className="hidden lg:flex items-center gap-1 text-xs font-semibold">
            <Link
              href="/"
              className="px-2.5 py-1 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              ← Main Hub
            </Link>
            <Link
              href="/doctor/queue"
              className="px-2.5 py-1 rounded-md text-[#7050A8] hover:bg-[#F4F0FB] transition-colors"
            >
              Doctor Portal
            </Link>
            <Link
              href="/queue"
              className="px-2.5 py-1 rounded-md text-[#14736A] hover:bg-[#E5F5F3] transition-colors"
            >
              Pharmacy
            </Link>
          </nav>
        </div>

        {/* Right side — status indicator */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-800 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Tamil Nadu Live Surveillance</span>
          </div>

          <Link
            href="/"
            className="lg:hidden px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors"
          >
            ← Hub
          </Link>
        </div>
      </div>
    </header>
  );
}

