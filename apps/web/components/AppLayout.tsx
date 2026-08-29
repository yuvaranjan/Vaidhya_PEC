"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ListOrdered,
  Package,
  Home,
  Building2,
  Stethoscope,
  Activity,
  ShieldCheck,
} from "lucide-react";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname() || "";

  const navItems = [
    {
      label: "Dispensing Queue",
      href: "/queue",
      pathMatch: "/queue",
      icon: ListOrdered,
    },
    {
      label: "Pharmacy Stock",
      href: "/stock",
      pathMatch: "/stock",
      icon: Package,
    },
    {
      label: "Directory Hub",
      href: "/",
      pathMatch: "^/$",
      icon: Home,
    },
  ];

  const isNavActive = (pathMatch: string) => {
    if (pathMatch === "^/$") return pathname === "/";
    return pathname.startsWith(pathMatch);
  };

  return (
    <div className="flex min-h-screen bg-[#FBFCFD] text-[#173449]">
      {/* Desktop Sidebar (Section 7: w-64, hidden on mobile) */}
      <aside className="no-print hidden md:flex w-64 flex-col justify-between border-r border-[#DCE7EA] bg-white sticky top-0 h-screen shrink-0 z-30">
        <div>
          {/* Logo Area */}
          <div className="px-6 pt-6 pb-6 border-b border-[#DCE7EA]">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="h-9 w-9 rounded-lg bg-[#173F59] flex items-center justify-center text-white font-bold text-lg shadow-sm group-hover:bg-[#2B9C95] transition-colors">
                <span className="text-[#2B9C95] group-hover:text-white">V</span>
              </div>
              <div>
                <span className="text-lg font-bold tracking-[-0.02em] text-[#173449] block leading-tight">
                  Cure Cloud
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#2B9C95]">
                  Pharmacy Portal
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1.5">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#6D7F8C]">
              Operations
            </div>
            {navItems.map((item) => {
              const active = isNavActive(item.pathMatch);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    active
                      ? "bg-[#E8F4F3] text-[#173F59] shadow-xs"
                      : "text-[#607482] hover:bg-[#EEF6F6] hover:text-[#173449]"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      active ? "text-[#2B9C95] stroke-[2.2]" : "text-[#6D7F8C] stroke-[1.8]"
                    }`}
                  />
                  <span>{item.label}</span>
                  {active && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#2B9C95]"></span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Profile / Node Card */}
        <div className="p-3 border-t border-[#DCE7EA]">
          <div className="rounded-xl bg-[#EEF6F6]/70 border border-[#DCE7EA] p-3 flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-[#173F59] flex items-center justify-center font-bold text-xs text-white">
                PO
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#2B9C95] ring-2 ring-white"></span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[#173449] truncate">Pharmacy Officer</p>
              <p className="text-[10px] text-[#6D7F8C] truncate flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2B9C95] animate-ping"></span>
                Node A · Live Network
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 min-h-screen pb-24 md:pb-8">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="no-print md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#DCE7EA] px-2 py-1.5 flex justify-around items-center shadow-lg">
        {navItems.map((item) => {
          const active = isNavActive(item.pathMatch);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center py-1 px-4 rounded-lg text-[10px] font-semibold transition-all ${
                active
                  ? "bg-[#EEF6F6] text-[#173F59]"
                  : "text-[#6D7F8C] hover:text-[#173449]"
              }`}
            >
              <Icon
                className={`w-4 h-4 mb-0.5 ${
                  active ? "text-[#2B9C95]" : "text-[#6D7F8C]"
                }`}
              />
              <span>{item.label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
