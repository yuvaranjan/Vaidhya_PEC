"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { claimVisit } from "./actions";
import { getMqttClient, subscribeJson } from "@/lib/mqtt";
import type { Visit as MockVisit } from "@/lib/queue";
import { 
  Users, 
  Clock, 
  Activity, 
  ArrowRight, 
  Radio, 
  AlertTriangle, 
  CheckCircle2, 
  Search,
  UserCheck
} from "lucide-react";

export function QueueClient({ initialQueue, doctorId }: { initialQueue: MockVisit[], doctorId: string }) {
  const [queue, setQueue] = useState<MockVisit[]>(initialQueue);
  const [error, setError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const client = getMqttClient(doctorId);
    // No broker configured — the queue still renders from its server fetch,
    // it just does not update live.
    if (!client) return;

    const unsubscribe = subscribeJson<{
      visit_id?: string;
      visitId?: string;
      patient_name?: string;
      patientName?: string;
      chief_complaint?: string;
      chiefComplaint?: string;
      summary_text?: string;
      summaryText?: string;
      urgency?: "routine" | "elevated" | "urgent";
    }>(
      client,
      "vaidhya/queue/new",
      (payload) => {
        // Kept undefined when absent so a merge below can tell "the broker had
        // nothing to say about this field" apart from "the broker sent a
        // placeholder", and never downgrades a real summary to either.
        const vId = payload.visit_id || payload.visitId || `visit_${Date.now()}`;
        const pName = payload.patient_name || payload.patientName;
        const complaint = payload.chief_complaint || payload.chiefComplaint;
        const summary = payload.summary_text || payload.summaryText;
        const urgencyVal = payload.urgency;

        setQueue((prev) => {
          const existing = prev.findIndex((v) => v.visitId === vId);

          // A visit already on the board is the common case, not the rare one:
          // the server render lists it as soon as intake starts, and this
          // retained message is what carries the finished AI summary. Bailing
          // out on a duplicate id meant the doctor's card kept the placeholder
          // forever. Merge instead, and never overwrite a real value with the
          // payload's own placeholder defaults.
          if (existing !== -1) {
            const merged = [...prev];
            const row = merged[existing];
            merged[existing] = {
              ...row,
              patientName: pName || row.patientName,
              chiefComplaint: complaint || row.chiefComplaint,
              summaryText: summary || row.summaryText,
              urgency: urgencyVal || row.urgency,
            };
            return merged;
          }

          return [
            {
              visitId: vId,
              patientName: pName || "Unknown Patient",
              chiefComplaint: complaint || "Intake completed",
              summaryText: summary || "Incoming AI Triage Summary...",
              urgency: urgencyVal || "routine",
              status: "awaiting_doctor",
              claimedByDoctorId: null,
              createdAt: Date.now(),
            },
            ...prev,
          ];
        });
      }
    );

    // Don't disconnectMqtt() here: the client is a shared, tab-wide singleton
    // (see lib/mqtt.ts). Tearing it down on every unmount fought React Strict
    // Mode's double-invoke and every queue<->consult navigation, producing a
    // "WebSocket closed before connection established" reconnect loop.
    return unsubscribe;
  }, [doctorId]);

  const handleClaim = async (visitId: string) => {
    setIsClaiming(visitId);
    setError(null);
    try {
      const res = await claimVisit(visitId);
      if (res?.error) {
        setError(res.error);
        setQueue((prev) => prev.filter(v => v.visitId !== visitId));
      } else if (res?.redirectUrl) {
        router.push(res.redirectUrl);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to claim visit");
    } finally {
      setIsClaiming(null);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-5 sm:px-8 space-y-7">
      {/* Header Pattern */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent mb-1 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Doctor Portal &bull; Triage Queue
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-[-0.025em]">Waiting Room Queue</h1>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-full border border-border shadow-sm">
          <div className="relative flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-accent animate-ping absolute"></span>
            <span className="w-2 h-2 rounded-full bg-accent"></span>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-secondary-foreground">Live MQTT Sync</span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="inline-flex rounded-lg bg-secondary p-1 border border-border">
          <button className="px-3.5 py-1.5 rounded-md bg-card text-primary font-bold text-xs shadow-sm">
            All Waiting ({queue.length})
          </button>
          <button className="px-3.5 py-1.5 rounded-md text-muted-foreground hover:text-foreground font-semibold text-xs transition-colors">
            Urgent Triage
          </button>
          <button className="px-3.5 py-1.5 rounded-md text-muted-foreground hover:text-foreground font-semibold text-xs transition-colors">
            Routine Check
          </button>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search patient name or ID..."
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Queue Cards */}
      {queue.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-border rounded-xl bg-card shadow-soft space-y-3">
          <div className="w-12 h-12 rounded-full bg-secondary text-accent mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Waiting Room Clear</h3>
          <p className="text-muted-foreground text-sm font-medium max-w-sm mx-auto">
            There are currently no patients waiting in the triage queue. New intake submissions will appear here instantly.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {queue.map((visit, idx) => (
            <div key={visit.visitId ? `${visit.visitId}-${idx}` : `visit-item-${idx}`} className="bg-card border border-border p-6 rounded-xl shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-card-hover transition-all">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-lg text-foreground">{visit.patientName || "Unknown Patient"}</h3>
                  <span className={`px-2.5 py-0.5 text-[10px] uppercase tracking-[0.14em] font-extrabold rounded-full border ${
                    visit.urgency === "urgent" ? "bg-destructive/10 text-destructive border-destructive/20" : 
                    visit.urgency === "elevated" ? "bg-[#EEF3FB] text-[#315A94] border-[#D1E0F5]" : 
                    "bg-[#E5F5F3] text-[#14736A] border-[#C2E8E4]"
                  }`}>
                    {visit.urgency} Urgency
                  </span>
                </div>
                <p className="text-foreground text-sm font-medium">{visit.chiefComplaint}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                  <span className="flex items-center gap-1 font-semibold">
                    <Clock className="w-3.5 h-3.5 text-accent" />
                    Waiting since: {new Date(visit.createdAt).toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span>&bull;</span>
                  <span className="font-mono text-[11px] bg-background px-2 py-0.5 rounded border border-border">ID: {visit.visitId}</span>
                </div>
              </div>

              <button
                onClick={() => handleClaim(visit.visitId)}
                disabled={isClaiming === visit.visitId}
                className="px-6 h-11 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 shadow-sm disabled:opacity-50 transition-all text-xs flex items-center justify-center gap-2 shrink-0"
              >
                <span>{isClaiming === visit.visitId ? "Claiming Session..." : "Claim & Review Patient"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
