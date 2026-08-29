import Link from "next/link";
import { getSession } from "@/lib/auth";
import { 
  Stethoscope, 
  ArrowRight, 
  Heart, 
  Activity, 
  Thermometer, 
  Calendar, 
  Clock, 
  FileText, 
  CheckCircle2, 
  Sparkles,
  ShieldCheck
} from "lucide-react";

export default async function PatientDashboard() {
  const session = await getSession();
  const userName = session.name || "Patient";

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-5 sm:px-8 space-y-8">
      {/* Header Pattern */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent mb-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
            Patient Portal &bull; Overview
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-[-0.025em]">
            Welcome back, {userName}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-full border border-border text-xs font-semibold text-secondary-foreground">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <span>Health Status: Active</span>
          </div>
        </div>
      </div>

      {/* Grid Layout: Main Feature Card + Side Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Hero Feature Card (Section 6: Feature Card Spec) */}
        <div className="lg:col-span-2 bg-secondary/65 border border-secondary rounded-xl p-6 sm:p-8 relative overflow-hidden shadow-soft flex flex-col justify-between">
          {/* Faded Background Watermark Icon */}
          <Stethoscope className="absolute -right-6 -bottom-6 w-56 h-56 text-primary opacity-[0.06] pointer-events-none stroke-[1.2]" />

          <div className="relative z-10 space-y-4 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-card border border-border shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">AI Telehealth Assistant</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-[-0.025em]">
              Start Instant AI Medical Intake
            </h2>

            <p className="text-muted-foreground text-sm font-normal leading-relaxed">
              Connect with our smart clinical assistant to evaluate your symptoms, log real-time vitals, and automatically queue you for a doctor consultation.
            </p>
          </div>

          <div className="relative z-10 pt-6 mt-4 flex items-center gap-4">
            <Link 
              href="/voicebot"
              className="bg-primary text-primary-foreground px-6 h-11 rounded-lg font-semibold text-sm shadow-sm hover:opacity-90 transition-all flex items-center gap-2 group"
            >
              <span>Begin Voicebot Intake</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        {/* Quick Health Summary Panel */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-soft flex flex-col justify-between space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent mb-2">Vitals Snapshot</p>
            <h3 className="text-lg font-bold text-foreground">Recent Readings</h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-accent">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Blood Pressure</p>
                  <p className="text-sm font-bold text-foreground">120 / 80 mmHg</p>
                </div>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-[#E5F5F3] text-[#14736A]">
                Optimal
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-destructive">
                  <Heart className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Heart Rate</p>
                  <p className="text-sm font-bold text-foreground">72 bpm</p>
                </div>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-[#E5F5F3] text-[#14736A]">
                Normal
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-accent">
                  <Thermometer className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Body Temp</p>
                  <p className="text-sm font-bold text-foreground">98.6 °F</p>
                </div>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-[#E5F5F3] text-[#14736A]">
                Normal
              </span>
            </div>
          </div>

          <Link href="/voicebot" className="text-xs font-bold text-accent hover:underline flex items-center gap-1">
            <span>Log new vitals</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

      </div>

      {/* Lower Section: Medical History & Activity Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent Consultations Preview */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 shadow-soft space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent mb-1">Clinical Records</p>
              <h3 className="text-lg font-bold text-foreground">Recent Visits & Consultations</h3>
            </div>
            <Link href="/history" className="text-xs font-bold text-accent hover:underline flex items-center gap-1">
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-xl border border-border bg-background hover:bg-secondary/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#E5F5F3] text-[#14736A] flex items-center justify-center font-bold text-sm shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-[#E5F5F3] text-[#14736A]">
                      Medical Visit
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> July 28, 2026
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-foreground">General Medical Consultation</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">Chief Complaint: Mild fever and persistent cough.</p>
                </div>
              </div>
              <Link href="/history" className="self-end sm:self-center px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-secondary transition-colors">
                View Report
              </Link>
            </div>

            <div className="p-4 rounded-xl border border-border bg-background hover:bg-secondary/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#EEF3FB] text-[#315A94] flex items-center justify-center font-bold text-sm shrink-0">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-[#EEF3FB] text-[#315A94]">
                      Lab Result
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Feb 14, 2026
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-foreground">Comprehensive Blood Panel</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">Results: All parameters within normal ranges.</p>
                </div>
              </div>
              <Link href="/history" className="self-end sm:self-center px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-secondary transition-colors">
                View Results
              </Link>
            </div>
          </div>
        </div>

        {/* Health Care Plan Card */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-soft space-y-4 flex flex-col justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent mb-1">Active Plan</p>
            <h3 className="text-lg font-bold text-foreground">Personal Care Plan</h3>
          </div>

          <div className="p-4 rounded-xl bg-[#F4F0FB] border border-[#E4D9F5] space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-[#E8DCFA] text-[#7050A8]">
                Care Plan Active
              </span>
              <CheckCircle2 className="w-4 h-4 text-[#7050A8]" />
            </div>
            <h4 className="text-sm font-bold text-[#173F59]">Hydration & Daily Vitals Tracking</h4>
            <p className="text-xs text-[#7050A8] leading-relaxed">
              Log temperature and blood pressure daily. Stay hydrated with 2.5L water daily.
            </p>
          </div>

          <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>Primary Doctor: Dr. Smith</span>
            <span className="font-semibold text-foreground">Next Review: In 5 days</span>
          </div>
        </div>

      </div>
    </div>
  );
}
