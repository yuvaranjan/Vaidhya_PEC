"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  ListOrdered,
  Package,
  UserCheck,
  Stethoscope,
  ChevronRight,
  ShieldCheck,
  Activity,
  HeartPulse,
  BarChart3,
  Copy,
  Check,
  Zap,
  Radio,
  Clock,
  ArrowRight,
  Sparkles
} from "lucide-react";

const NODE_ROLE = process.env.NEXT_PUBLIC_NODE_ROLE ?? "edge";
const EDGE_AI_URL = process.env.NEXT_PUBLIC_EDGE_AI_URL ?? "http://localhost:8000";

export default function Home() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    // Quick health check ping for Edge AI service
    fetch(`${EDGE_AI_URL}/health`, { mode: 'cors' })
      .then((res) => {
        if (res.ok) setAiStatus("online");
        else setAiStatus("offline");
      })
      .catch(() => setAiStatus("offline"));
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#FAFDFD] via-[#F3F8F8] to-[#EAEFF0] text-[#173449] pb-16">
      {/* Top Banner & Navigation Header */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-white/80 border-b border-[#DCE7EA] px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#173F59] to-[#2B9C95] flex items-center justify-center text-white shadow-md shadow-[#2B9C95]/20">
              <HeartPulse className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-tight text-lg text-[#173449]">
                  Vaidhya<span className="text-[#2B9C95]">.AI</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#E5F5F3] text-[#14736A] px-2 py-0.5 rounded-full border border-[#2B9C95]/30">
                  Rural Telemedicine
                </span>
              </div>
              <p className="text-xs text-[#6D7F8C]">Edge-AI Teleconsultation & Pharmacy Fulfillment Network</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 text-xs">
            {/* AI Service Status */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EEF6F6] border border-[#DCE7EA]">
              <Radio className={`w-3.5 h-3.5 ${aiStatus === "online" ? "text-emerald-500 animate-pulse" : "text-amber-500"}`} />
              <span className="text-[#6D7F8C]">Edge AI:</span>
              <span className={`font-semibold ${aiStatus === "online" ? "text-emerald-700" : "text-amber-700"}`}>
                {aiStatus === "checking" ? "Checking..." : aiStatus === "online" ? "Online (8000)" : "Mock AI"}
              </span>
            </div>

            {/* Active Node Role */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#173F59] text-white font-medium shadow-xs">
              <Zap className="w-3.5 h-3.5 text-[#2B9C95]" />
              <span className="opacity-80">Node:</span>
              <span className="font-mono font-bold uppercase text-[#70C6BC]">{NODE_ROLE}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-8 space-y-10">
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#173F59] via-[#1E4D6B] to-[#2B9C95] p-8 sm:p-12 text-white shadow-xl shadow-[#173F59]/15">
          {/* Subtle Background Pattern Orbs */}
          <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 w-64 h-64 rounded-full bg-[#2B9C95]/20 blur-2xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-3.5 py-1 rounded-full text-xs font-medium text-[#A3DDD5]">
              <Sparkles className="w-3.5 h-3.5 text-[#70C6BC]" />
              <span>Offline-First Telehealth & Smart Prescribing</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              Instant Clinical Access for Doctors & Patients
            </h1>

            <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-light">
              Connect rural health workers, village clinics, doctors, and automated pharmacy fulfillment seamlessly—with real-time AI triage and epidemic tracking.
            </p>
          </div>
        </section>

        {/* Primary Action Portals: Doctor & Patient */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[#6D7F8C] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#2B9C95]" /> Primary Consult Portals
            </h2>
            <span className="text-xs text-[#6D7F8C]">Select your portal to log in</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Doctor Portal Card */}
            <div className="group relative overflow-hidden rounded-2xl bg-white border-2 border-[#DCE7EA] hover:border-[#7050A8] transition-all duration-300 shadow-md hover:shadow-xl hover:shadow-[#7050A8]/10 flex flex-col justify-between p-6 sm:p-8">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#7050A8]/10 to-transparent rounded-bl-full pointer-events-none" />
              
              <div className="space-y-5">
                <div className="flex items-start justify-between">
                  <div className="w-14 h-14 rounded-2xl bg-[#F4F0FB] text-[#7050A8] flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                    <Stethoscope className="w-7 h-7" />
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#F4F0FB] text-[#7050A8] border border-[#7050A8]/20">
                    Physician & Specialist Portal
                  </span>
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-[#173449] group-hover:text-[#7050A8] transition-colors">
                    Doctor Telemedicine Portal
                  </h3>
                  <p className="text-xs sm:text-sm text-[#6D7F8C] mt-2 leading-relaxed">
                    Examine incoming patient queues, review Edge-AI diagnostic summaries, conduct audio/video consults, issue digital prescriptions, and escalate complex cases.
                  </p>
                </div>

                {/* Features List */}
                <div className="space-y-2 pt-2 border-t border-[#F0F4F6]">
                  <div className="flex items-center gap-2 text-xs text-[#418EA7]">
                    <Check className="w-3.5 h-3.5 text-[#2B9C95]" />
                    <span>Real-time patient triage & SOAP generator</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#418EA7]">
                    <Check className="w-3.5 h-3.5 text-[#2B9C95]" />
                    <span>1-Click Digital Rx & Specialist Escalation</span>
                  </div>
                </div>
              </div>

              {/* Action Area */}
              <div className="mt-8 space-y-3">
                <Link
                  href="/doctor/login"
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#7050A8] hover:bg-[#5D3F91] text-white font-bold text-sm shadow-md shadow-[#7050A8]/25 transition-all group-hover:translate-y-[-1px]"
                >
                  <span>Enter Doctor Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                {/* Demo Credentials Quick Box */}
                <div className="bg-[#FAF8FD] rounded-xl p-3 border border-[#E9E2F5] flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-[#7050A8] block">Demo Credentials</span>
                    <span className="font-mono text-[#6D7F8C]">9100000001 · vaidhya123</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard("9100000001", "doctor-phone")}
                    className="flex items-center gap-1 text-[11px] font-semibold text-[#7050A8] bg-white hover:bg-[#F4F0FB] px-2.5 py-1 rounded-md border border-[#D8CEEB] transition-colors cursor-pointer"
                  >
                    {copiedKey === "doctor-phone" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === "doctor-phone" ? "Copied" : "Copy Phone"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Patient & Clinic Intake Portal Card */}
            <div className="group relative overflow-hidden rounded-2xl bg-white border-2 border-[#DCE7EA] hover:border-[#2B9C95] transition-all duration-300 shadow-md hover:shadow-xl hover:shadow-[#2B9C95]/10 flex flex-col justify-between p-6 sm:p-8">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#2B9C95]/10 to-transparent rounded-bl-full pointer-events-none" />

              <div className="space-y-5">
                <div className="flex items-start justify-between">
                  <div className="w-14 h-14 rounded-2xl bg-[#E5F5F3] text-[#14736A] flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                    <UserCheck className="w-7 h-7" />
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#E5F5F3] text-[#14736A] border border-[#2B9C95]/20">
                    Patient & Clinic Intake
                  </span>
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-[#173449] group-hover:text-[#14736A] transition-colors">
                    Patient & Nurse Portal
                  </h3>
                  <p className="text-xs sm:text-sm text-[#6D7F8C] mt-2 leading-relaxed">
                    Patient OTP session login, rural clinic health intake, vital signs registration, active consultation status, and physical prescription access.
                  </p>
                </div>

                {/* Features List */}
                <div className="space-y-2 pt-2 border-t border-[#F0F4F6]">
                  <div className="flex items-center gap-2 text-xs text-[#418EA7]">
                    <Check className="w-3.5 h-3.5 text-[#2B9C95]" />
                    <span>Quick Phone OTP authentication (Mock 123456)</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#418EA7]">
                    <Check className="w-3.5 h-3.5 text-[#2B9C95]" />
                    <span>Live consultation queue & digital prescription lookup</span>
                  </div>
                </div>
              </div>

              {/* Action Area */}
              <div className="mt-8 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-[#2B9C95] hover:bg-[#1F7D77] text-white font-bold text-sm shadow-md shadow-[#2B9C95]/25 transition-all group-hover:translate-y-[-1px]"
                  >
                    <span>Patient Login</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>

                  <Link
                    href="/prescription"
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-xl bg-[#EEF6F6] hover:bg-[#DCEEEF] text-[#14736A] font-bold text-sm border border-[#2B9C95]/30 transition-colors"
                  >
                    <span>Prescriptions</span>
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>

                {/* Demo Credentials Quick Box */}
                <div className="bg-[#E5F5F3]/50 rounded-xl p-3 border border-[#CBEAE5] flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-[#14736A] block">Demo Credentials</span>
                    <span className="font-mono text-[#6D7F8C]">9000000001 · OTP 123456</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard("9000000001", "patient-phone")}
                    className="flex items-center gap-1 text-[11px] font-semibold text-[#14736A] bg-white hover:bg-[#E5F5F3] px-2.5 py-1 rounded-md border border-[#B3E1DB] transition-colors cursor-pointer"
                  >
                    {copiedKey === "patient-phone" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === "patient-phone" ? "Copied" : "Copy Phone"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Secondary Operations Grid */}
        <section className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[#6D7F8C] flex items-center gap-2">
            <Package className="w-4 h-4 text-[#2B9C95]" /> Pharmacy & Network Operations
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Pharmacy Dispensing Queue */}
            <Link
              href="/queue"
              className="group bg-white rounded-2xl border border-[#DCE7EA] p-5 shadow-xs hover:border-[#2B9C95] hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-[#E5F5F3] text-[#14736A] group-hover:bg-[#2B9C95] group-hover:text-white transition-colors">
                    <ListOrdered className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#E5F5F3] text-[#14736A]">
                    Lane T3
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-base text-[#173449] group-hover:text-[#2B9C95] transition-colors">
                    Incoming Dispensing Queue
                  </h4>
                  <p className="text-xs text-[#6D7F8C] mt-1 leading-relaxed">
                    Live queue of incoming digital prescriptions, one-click fulfillment, and printed GST tax invoices.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end text-xs font-bold text-[#2B9C95] group-hover:translate-x-1 transition-transform">
                Open Queue <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </Link>

            {/* Pharmacy Stock & Inventory CRUD */}
            <Link
              href="/stock"
              className="group bg-white rounded-2xl border border-[#DCE7EA] p-5 shadow-xs hover:border-[#2B9C95] hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-[#E5F5F3] text-[#14736A] group-hover:bg-[#2B9C95] group-hover:text-white transition-colors">
                    <Package className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#E5F5F3] text-[#14736A]">
                    Inventory
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-base text-[#173449] group-hover:text-[#2B9C95] transition-colors">
                    Pharmacy Stock & Inventory
                  </h4>
                  <p className="text-xs text-[#6D7F8C] mt-1 leading-relaxed">
                    Manage medicine quantities, unit pricing, batch tracking, and low-stock replenishment.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end text-xs font-bold text-[#2B9C95] group-hover:translate-x-1 transition-transform">
                Manage Stock <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </Link>

            {/* Analytics & Health Surveillance */}
            <Link
              href="/analytics"
              className="group bg-white rounded-2xl border border-[#DCE7EA] p-5 shadow-xs hover:border-[#7050A8] hover:shadow-md transition-all flex flex-col justify-between space-y-4 sm:col-span-2 lg:col-span-1"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-[#F4F0FB] text-[#7050A8] group-hover:bg-[#7050A8] group-hover:text-white transition-colors">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#F4F0FB] text-[#7050A8]">
                    Surveillance
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-base text-[#173449] group-hover:text-[#7050A8] transition-colors">
                    Health & Epidemic Analytics
                  </h4>
                  <p className="text-xs text-[#6D7F8C] mt-1 leading-relaxed">
                    Regional health monitoring, disease heatmaps, triage distribution metrics, and sync node telemetry.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end text-xs font-bold text-[#7050A8] group-hover:translate-x-1 transition-transform">
                View Analytics <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </Link>
          </div>
        </section>

        {/* Footer Quick Info */}
        <footer className="pt-6 border-t border-[#DCE7EA]/80 flex flex-col sm:flex-row items-center justify-between text-xs text-[#6D7F8C] gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#2B9C95]" />
            <span>Vaidhya Healthcare · Seeded Demo Dataset Active</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-[#2B9C95] transition-colors">Patient Login</Link>
            <span>·</span>
            <Link href="/doctor/login" className="hover:text-[#7050A8] transition-colors">Doctor Login</Link>
            <span>·</span>
            <Link href="/queue" className="hover:text-[#2B9C95] transition-colors">Pharmacy</Link>
            <span>·</span>
            <Link href="/analytics" className="hover:text-[#2B9C95] transition-colors">Analytics</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}

