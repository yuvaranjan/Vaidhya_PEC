import Link from "next/link";
import {
  Search,
  Calendar,
  UserCheck,
  Download,
  Eye,
} from "lucide-react";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type VisitRow = {
  visit_id: string;
  status: string;
  created_at: string;
  doctors: { name: string } | null;
  diagnostic_reports: Array<{
    chief_complaint: string | null;
    summary_text: string | null;
    urgency_tier: { tier?: string; flag_count?: number } | null;
  }>;
  prescriptions: Array<{
    prescription_id: string;
    medications: unknown[];
  }>;
};

type Record = {
  id: string;
  typeLabel: string;
  date: string;
  doctor: string;
  complaint: string;
  diagnosis: string;
  medsCount: number;
  prescriptionId: string | null;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
};

// Urgency drives the badge colour, per the frozen theme: green routine,
// amber elevated, red urgent. Nothing else in this table is colour-coded.
const BADGE = {
  routine: {
    badgeBg: "bg-[#E5F5F3]",
    badgeText: "text-[#14736A]",
    badgeBorder: "border-[#C2E8E4]",
  },
  elevated: {
    badgeBg: "bg-[#FDF3E4]",
    badgeText: "text-[#9A6414]",
    badgeBorder: "border-[#F2DFBF]",
  },
  urgent: {
    badgeBg: "bg-destructive/10",
    badgeText: "text-destructive",
    badgeBorder: "border-destructive/20",
  },
} as const;

function toRecord(v: VisitRow): Record {
  const report = v.diagnostic_reports?.[v.diagnostic_reports.length - 1];
  const rx = v.prescriptions?.[v.prescriptions.length - 1];
  const tier = (report?.urgency_tier?.tier ?? "routine") as keyof typeof BADGE;

  return {
    id: v.visit_id,
    typeLabel: tier === "routine" ? "Medical Visit" : `${tier} Visit`,
    date: v.created_at,
    doctor: v.doctors?.name ?? "Vaidhya Edge Clinic",
    complaint: report?.chief_complaint ?? "Consultation",
    diagnosis: report?.summary_text?.split(". ")[0] ?? "No report filed",
    medsCount: Array.isArray(rx?.medications) ? rx.medications.length : 0,
    prescriptionId: rx?.prescription_id ?? null,
    ...(BADGE[tier] ?? BADGE.routine),
  };
}

async function loadHistory(patientId: string | undefined): Promise<Record[]> {
  if (!db || !patientId) return [];

  const { data, error } = await db
    .from("visits")
    .select(
      "visit_id, status, created_at, doctors(name), " +
        "diagnostic_reports(chief_complaint, summary_text, urgency_tier), " +
        "prescriptions(prescription_id, medications)",
    )
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[history] read failed:", error.message);
    return [];
  }
  return (data as unknown as VisitRow[]).map(toRecord);
}

export default async function MedicalHistoryPage() {
  const session = await getSession();
  const history = await loadHistory(session.patientId);

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-5 sm:px-8 space-y-7">
      {/* Header Pattern */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent mb-1">Health Records</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-[-0.025em]">Medical History</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-4 h-10 rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:opacity-90 transition-opacity flex items-center gap-2">
            <Download className="w-4 h-4" />
            <span>Export Health Summary</span>
          </button>
        </div>
      </div>

      {/* Filter Bar & Search (Section 6: Segmented Control Spec) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Segmented Control Filter */}
        <div className="inline-flex rounded-lg bg-secondary p-1 border border-border">
          <button className="px-3.5 py-1.5 rounded-md bg-card text-primary font-bold text-xs shadow-sm">
            All Records ({history.length})
          </button>
          <button className="px-3.5 py-1.5 rounded-md text-muted-foreground hover:text-foreground font-semibold text-xs transition-colors">
            Medical Visits
          </button>
          <button className="px-3.5 py-1.5 rounded-md text-muted-foreground hover:text-foreground font-semibold text-xs transition-colors">
            Lab Results
          </button>
          <button className="px-3.5 py-1.5 rounded-md text-muted-foreground hover:text-foreground font-semibold text-xs transition-colors">
            Care Plans
          </button>
        </div>

        {/* Search Input (Section 6: Search Specs) */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search records or doctors..."
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Records List Container */}
      <div className="bg-card border border-border rounded-xl shadow-soft overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 bg-secondary/80 border-b border-border px-6 py-3.5 text-[11px] font-bold uppercase tracking-[0.14em] text-secondary-foreground">
          <div className="col-span-3 sm:col-span-2">Type & Date</div>
          <div className="col-span-6 sm:col-span-7">Clinical Summary & Diagnosis</div>
          <div className="col-span-3 sm:col-span-3 text-right">Actions</div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-border">
          {history.length === 0 && (
            <div className="p-10 text-center text-xs font-semibold text-muted-foreground">
              No visits on record yet. Completed consultations appear here with
              their diagnostic report and prescription.
            </div>
          )}

          {history.map((record) => (
            <div
              key={record.id}
              className="grid grid-cols-12 p-5 px-6 items-center hover:bg-secondary/30 transition-colors group"
            >
              {/* Type & Date */}
              <div className="col-span-3 sm:col-span-2 space-y-1.5">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${record.badgeBg} ${record.badgeText} ${record.badgeBorder}`}>
                  {record.typeLabel}
                </span>
                <p className="text-xs font-bold text-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-muted-foreground" />
                  {new Date(record.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>

              {/* Summary */}
              <div className="col-span-6 sm:col-span-7 pr-4 space-y-1">
                <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  {record.complaint}
                </h4>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 font-semibold text-foreground">
                    <UserCheck className="w-3.5 h-3.5 text-accent" /> {record.doctor}
                  </span>
                  <span>&bull;</span>
                  <span>Diagnosis: <strong className="text-foreground font-semibold">{record.diagnosis}</strong></span>
                  {record.medsCount > 0 && (
                    <>
                      <span>&bull;</span>
                      <span>{record.medsCount} medication{record.medsCount === 1 ? "" : "s"}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="col-span-3 sm:col-span-3 flex items-center justify-end gap-2">
                {record.prescriptionId ? (
                  <Link
                    href={`/prescription?id=${record.prescriptionId}`}
                    className="px-3 h-8 rounded-lg bg-background border border-border text-foreground text-xs font-bold hover:bg-secondary transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5 text-accent" />
                    <span>Report</span>
                  </Link>
                ) : (
                  <span className="px-3 h-8 rounded-lg bg-background border border-border text-muted-foreground text-xs font-bold flex items-center gap-1.5 shadow-sm opacity-60">
                    <Eye className="w-3.5 h-3.5" />
                    <span>Report</span>
                  </span>
                )}
                <button className="p-2 rounded-lg bg-background border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shadow-sm" title="Download Record">
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
