"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = {
  label: string;
  href: string;
  iconName?: string;
};

// Bulletproof SVG Icon components preventing Turbopack module factory HMR errors
const IconDashboard = ({ size = 18, strokeWidth = 1.8 }: { size?: number; strokeWidth?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
);

const IconSparkles = ({ size = 18, strokeWidth = 1.8 }: { size?: number; strokeWidth?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4M3 5h4M19 17v4M17 19h4" />
  </svg>
);

const IconHeartPulse = ({ size = 18, strokeWidth = 1.8 }: { size?: number; strokeWidth?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    <path d="M12 5 9.04 11l-2.08-3.08" />
  </svg>
);

const IconPill = ({ size = 18, strokeWidth = 1.8 }: { size?: number; strokeWidth?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
    <path d="m8.5 8.5 7 7" />
  </svg>
);

const IconFileText = ({ size = 18, strokeWidth = 1.8 }: { size?: number; strokeWidth?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M10 9H8M16 13H8M16 17H8" />
  </svg>
);

const IconUser = ({ size = 18, strokeWidth = 1.8 }: { size?: number; strokeWidth?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconUsers = ({ size = 18, strokeWidth = 1.8 }: { size?: number; strokeWidth?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconSettings = ({ size = 18, strokeWidth = 1.8 }: { size?: number; strokeWidth?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconStethoscope = ({ size = 18, strokeWidth = 1.8 }: { size?: number; strokeWidth?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.8 2.3A.3.3 0 0 0 4.5 2h-1a.3.3 0 0 0-.3.3v7.7c0 4.4 3.6 8 8 8s8-3.6 8-8V2.3a.3.3 0 0 0-.3-.3h-1a.3.3 0 0 0-.3.3v7.7a6.4 6.4 0 1 1-12.8 0V2.3z" />
    <path d="M12 18v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4" />
    <circle cx="20" cy="12" r="2" />
  </svg>
);

const getIcon = (name?: string, active?: boolean) => {
  const strokeWidth = active ? 2.2 : 1.8;
  const size = 18;
  switch (name) {
    case "dashboard":
      return <IconDashboard size={size} strokeWidth={strokeWidth} />;
    case "assistant":
    case "consult":
      return <IconSparkles size={size} strokeWidth={strokeWidth} />;
    case "intake":
    case "vitals":
      return <IconHeartPulse size={size} strokeWidth={strokeWidth} />;
    case "prescription":
    case "pharmacy":
    case "erx":
      return <IconPill size={size} strokeWidth={strokeWidth} />;
    case "history":
    case "records":
      return <IconFileText size={size} strokeWidth={strokeWidth} />;
    case "profile":
    case "account":
      return <IconUser size={size} strokeWidth={strokeWidth} />;
    case "settings":
      return <IconSettings size={size} strokeWidth={strokeWidth} />;
    case "queue":
    case "patients":
      return <IconUsers size={size} strokeWidth={strokeWidth} />;
    default:
      return <IconStethoscope size={size} strokeWidth={strokeWidth} />;
  }
};

export function Sidebar({ 
  items, 
  userName, 
  userRole 
}: { 
  items: NavItem[]; 
  userName: string; 
  userRole: string; 
}) {
  const pathname = usePathname();

  const checkActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/doctor/queue") return pathname === "/doctor/queue";
    return pathname.startsWith(href);
  };

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-card border-r border-border flex flex-col z-20 shadow-[2px_0_12px_rgba(15,45,64,0.03)] hidden md:flex">
      {/* Brand Header */}
      <div className="h-[76px] flex items-center px-6 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
            <IconHeartPulse size={20} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-[-0.02em] leading-tight">Cure Cloud</h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent">Smart Care OS</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5 bg-background/40">
        <p className="px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-accent mb-3">Navigation</p>
        {items.map((item, index) => {
          const isActive = checkActive(item.href);
          return (
            <Link
              key={`${item.href}-${index}`}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all group ${
                isActive 
                  ? "bg-[#E8F4F3] text-primary font-bold shadow-sm" 
                  : "text-[#607482] hover:bg-secondary/80 hover:text-foreground"
              }`}
            >
              <div className={`transition-colors ${isActive ? "text-accent" : "text-muted-foreground group-hover:text-foreground"}`}>
                {getIcon(item.iconName || item.label.toLowerCase().split(' ')[0], isActive)}
              </div>
              <span className="flex-1">{item.label}</span>
              {isActive && (
                <div className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_6px_rgba(43,156,149,0.6)]"></div>
              )}
            </Link>
          );
        })}
      </div>

      {/* User Footer Card */}
      <div className="p-3 border-t border-border bg-card">
        <div className="flex items-center gap-3 p-3 bg-secondary/60 rounded-xl border border-border/80">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shadow-sm">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-accent ring-2 ring-white"></span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate leading-snug">{userName}</p>
            <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-muted-foreground">{userRole}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
