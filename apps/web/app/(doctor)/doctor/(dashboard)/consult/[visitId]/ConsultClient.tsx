"use client";

import { useState, useEffect, useRef } from "react";
import { getMqttClient, subscribeJson } from "@/lib/mqtt";
import { topics, createDedupe } from "@vaidhya/shared";
import type { Visit as MockVisit } from "@/lib/queue";
import type { PatientToDoctorMessage, DoctorToPatientMessage } from "@vaidhya/shared";
import { WebRtcConsultHub } from "@/components/WebRtcConsultHub";
import { submitInlinePrescription, closeConsultSession } from "./actions";
import { enqueueConsultMessage, loadConsultHistory, loadConsultOutbox, mergeConsultMessages, removeConsultOutboxMessage, saveConsultHistory, serverMessageToConsultMessage } from "@/lib/consultHistory";
import { 
  FileText, 
  Send, 
  ShieldCheck, 
  Pill, 
  User, 
  Clock, 
  Sparkles,
  ArrowRight,
  Activity,
  HeartPulse,
  CheckCircle2
} from "lucide-react";

export function ConsultClient({
  visit,
  doctorId,
}: {
  visit: MockVisit;
  doctorId: string;
}) {
  const [messages, setMessages] = useState<Array<DoctorToPatientMessage | PatientToDoctorMessage>>([]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [showPrescription, setShowPrescription] = useState(false);
  const [meds, setMeds] = useState([{ id: crypto.randomUUID(), name: "", dosage: "", duration: "", instructions: "" }]);
  const [isSubmittingRx, setIsSubmittingRx] = useState(false);
  const [rxSent, setRxSent] = useState(false);
  const [followUp, setFollowUp] = useState(false);
  const [rxError, setRxError] = useState("");

  const handleSendPrescription = async (e) => {
    e.preventDefault();
    setIsSubmittingRx(true);
    setRxError("");
    try {
      await submitInlinePrescription(visit.visitId, meds, followUp);
      setRxSent(true);
    } catch (err) {
      setRxError(err.message || "Failed to send prescription");
    } finally {
      setIsSubmittingRx(false);
    }
  };

  const handleCloseSession = async () => {
    await closeConsultSession(visit.visitId, meds);
  };


  // The page is server-rendered at claim time. If intake finishes (or the
  // summary is regenerated) while the doctor is already on this screen, the
  // prop is stale forever without this. `vaidhya/queue/new` is retained, so a
  // late subscribe still gets the last summary for the visit.
  const [summaryText, setSummaryText] = useState(visit.summaryText);
  const [chiefComplaint, setChiefComplaint] = useState(visit.chiefComplaint);

  const flushOutbox = (client = getMqttClient(doctorId)) => {
    if (!client?.connected) return;
    for (const queued of loadConsultOutbox(visit.visitId)) {
      client.publish(topics.doctorToPatient(visit.visitId), JSON.stringify(queued), { qos: 1 }, (error) => {
        if (!error) removeConsultOutboxMessage(visit.visitId, queued.message_id);
      });
    }
  };

  // Restore the visit timeline from the browser immediately, then reconcile it
  // with the edge's SQLite record. MQTT remains live transport, not storage.
  useEffect(() => {
    setMessages(loadConsultHistory(visit.visitId));
    const base = process.env.NEXT_PUBLIC_EDGE_AI_URL ?? "http://localhost:8000";
    void fetch(`${base}/consult/${visit.visitId}/messages`)
      .then((res) => (res.ok ? res.json() : { messages: [] }))
      .then((data) => {
        const restored = (data.messages ?? []).map(serverMessageToConsultMessage).filter(Boolean) as Array<DoctorToPatientMessage | PatientToDoctorMessage>;
        setMessages((previous) => mergeConsultMessages(previous, restored));
      })
      .catch(() => undefined);
  }, [visit.visitId]);

  useEffect(() => {
    saveConsultHistory(visit.visitId, messages);
  }, [visit.visitId, messages]);

  useEffect(() => {
    setSummaryText(visit.summaryText);
    setChiefComplaint(visit.chiefComplaint);
  }, [visit.summaryText, visit.chiefComplaint]);

  useEffect(() => {
    const client = getMqttClient(doctorId);
    if (!client) return;

    return subscribeJson<{
      visit_id?: string;
      chief_complaint?: string;
      summary_text?: string;
    }>(client, "vaidhya/queue/new", (payload) => {
      if (payload.visit_id !== visit.visitId) return;
      if (payload.summary_text) setSummaryText(payload.summary_text);
      if (payload.chief_complaint) setChiefComplaint(payload.chief_complaint);
    });
  }, [doctorId, visit.visitId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const client = getMqttClient(doctorId);
    if (!client) {
      // Single-laptop fallback polling when no MQTT broker is configured
      const interval = setInterval(async () => {
        try {
          const base = process.env.NEXT_PUBLIC_EDGE_AI_URL ?? "http://localhost:8000";
          const res = await fetch(`${base}/consult/${visit.visitId}/answers`);
          if (res.ok) {
            const data = await res.json();
            setMessages((prev) => {
              const newMsgs = [...prev];
              let changed = false;
              for (const ans of data.answers) {
                if (!newMsgs.some(m => m.message_id === ans.message_id)) {
                  newMsgs.push(ans);
                  changed = true;
                }
              }
              return changed ? newMsgs : prev;
            });
          }
        } catch (e) {}
      }, 3000);
      return () => clearInterval(interval);
    }

    const isDuplicate = createDedupe(200);
    const flush = () => flushOutbox(client);
    client.on("connect", flush);
    flush();

    const unsubscribe = subscribeJson<PatientToDoctorMessage>(
      client,
      topics.patientToDoctor(visit.visitId),
      (payload) => {
        if (isDuplicate(payload.message_id)) return;
        setMessages((prev) => mergeConsultMessages(prev, [payload]));
      }
    );

    // Don't disconnectMqtt() here: the client is a shared, tab-wide singleton
    // (see lib/mqtt.ts). Tearing it down on every unmount fought React Strict
    // Mode's double-invoke and every queue<->consult navigation, producing a
    // "WebSocket closed before connection established" reconnect loop.
    return () => {
      client.off("connect", flush);
      unsubscribe();
    };
  }, [doctorId, visit.visitId]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const msg: DoctorToPatientMessage = {
      message_id: crypto.randomUUID(),
      sender: "doctor",
      text: inputValue.trim(),
      timestamp: new Date().toISOString(),
    };

    const client = getMqttClient(doctorId);
    enqueueConsultMessage(visit.visitId, msg);
    if (client) {
      if (client.connected) {
        client.publish(topics.doctorToPatient(visit.visitId), JSON.stringify(msg), { qos: 1 }, (error) => {
          if (!error) removeConsultOutboxMessage(visit.visitId, msg.message_id);
        });
      }
    } else {
      // Single-laptop fallback: hit the edge service's HTTP consult endpoint
      // directly. Same relay, same voicebot, no broker in the middle.
      const base =
        process.env.NEXT_PUBLIC_EDGE_AI_URL ?? "http://localhost:8000";
      void fetch(`${base}/consult/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visit_id: visit.visitId, question_en: msg.text }),
      }).then((response) => {
        if (response.ok) removeConsultOutboxMessage(visit.visitId, msg.message_id);
      }).catch((err) => console.error("[consult] HTTP fallback failed", err));
    }

    setMessages((prev) => mergeConsultMessages(prev, [msg]));
    setInputValue("");
  };

  return (
    <div className="w-full max-w-[90rem] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 sm:p-6 min-h-[88vh]">
      
      {/* LEFT SIDEBAR: Patient Record & Chief Complaint */}
      <div className="lg:col-span-3 flex flex-col bg-card border border-border rounded-2xl shadow-soft p-5 overflow-y-auto space-y-5">
        <div className="border-b border-border pb-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent mb-0.5">Clinical Profile</p>
          <h2 className="text-lg font-extrabold text-foreground tracking-[-0.025em]">Patient Record</h2>
        </div>

        {/* Patient Identity */}
        <div className="p-4 bg-background border border-border rounded-xl space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 text-accent">
            <User className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Demographics</span>
          </div>
          <p className="text-lg font-extrabold text-foreground">{visit.patientName}</p>
          <p className="text-xs text-muted-foreground font-mono">Visit ID: {visit.visitId}</p>
        </div>

        {/* Chief Complaint */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Chief Complaint</p>
          <p className="text-xs font-semibold text-foreground bg-background p-3.5 rounded-xl border border-border leading-relaxed">
            {chiefComplaint}
          </p>
        </div>

        {/* Triage Urgency Level */}
        <div className="pt-2">
          <div className={`p-3.5 rounded-xl border font-bold text-xs flex items-center justify-between shadow-xs ${
            visit.urgency === "urgent" ? "bg-destructive/10 border-destructive/20 text-destructive" :
            visit.urgency === "elevated" ? "bg-[#EEF3FB] border-[#D1E0F5] text-[#315A94]" :
            "bg-[#E5F5F3] border-[#C2E8E4] text-[#14736A]"
          }`}>
            <span className="flex items-center gap-1.5">
              <Activity className="w-4 h-4" /> Triage Tier
            </span>
            <span className="uppercase tracking-widest text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-white/80 shadow-xs">
              {visit.urgency}
            </span>
          </div>
        </div>
      </div>

      {/* CENTER WORKSPACE: WebRTC Stream Hub & Real-time MQTT Chat */}
      <div className="lg:col-span-6 flex flex-col space-y-4">
        
        {/* WebRTC Video / Audio Consultation Stream */}
        <WebRtcConsultHub visitId={visit.visitId} role="doctor" userId={doctorId} />

        {/* Direct Doctor-Patient MQTT Chat */}
        <div className="flex-1 flex flex-col bg-card border border-border rounded-2xl shadow-soft overflow-hidden min-h-[320px]">
          
          {/* Chat Header */}
          <div className="bg-card px-5 py-3 border-b border-border flex justify-between items-center z-10">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">Active Telehealth Session</p>
              <h3 className="font-bold text-foreground text-sm">Direct Patient Messaging Channel</h3>
            </div>
            <span className="text-[9px] uppercase tracking-[0.14em] bg-accent/10 text-accent border border-accent/20 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
              MQTT Sync
            </span>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-xs font-semibold space-y-2 py-8">
                <ShieldCheck className="w-8 h-8 text-accent opacity-50" />
                <p>Direct patient chat channel ready. Send a message below to communicate.</p>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.message_id} className={`flex flex-col ${m.sender === "doctor" ? "items-end" : "items-start"}`}>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5 px-1">
                    {m.sender === "doctor" ? "Attending Doctor (You)" : visit.patientName}
                  </span>
                  <div className={`max-w-[80%] px-3.5 py-2.5 shadow-xs text-xs leading-relaxed ${
                    m.sender === "doctor" 
                      ? "bg-primary text-primary-foreground rounded-xl rounded-tr-xs font-semibold" 
                      : "bg-card border border-border text-foreground rounded-xl rounded-tl-xs font-medium"
                  }`}>
                    <p>{m.text}</p>
                    <p className="text-[9px] mt-1 text-right font-mono opacity-70">
                      {new Date(m.timestamp).toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <form onSubmit={handleSendMessage} className="p-3 bg-card border-t border-border flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type advice or questions for the patient..."
              className="flex-1 h-10 px-3.5 rounded-xl border border-border bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="bg-primary text-primary-foreground px-5 h-10 rounded-xl font-bold text-xs shadow-xs hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-1.5 shrink-0"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

        </div>
      </div>

      {/* RIGHT SIDEBAR: AI Diagnostic Synthesis & Prescribe Action */}
      <div className="lg:col-span-3 flex flex-col bg-card border border-border rounded-2xl shadow-soft p-5 overflow-y-auto space-y-5">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent mb-0.5">Clinical Evaluation</p>
            <h2 className="text-lg font-extrabold text-foreground tracking-[-0.025em]">Edge AI Synthesis</h2>
          </div>
        </div>

        {/* Diagnostic Summary */}
        <div className="space-y-2 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-accent" /> AI Diagnostic Summary
          </p>
          <div className="bg-background p-4 rounded-xl border border-border text-xs text-foreground font-medium leading-relaxed shadow-xs">
            {summaryText || "Waiting for the AI intake summary…"}
          </div>
        </div>

        
        {/* Action Button: Issue Digital Prescription */}
        <div className="pt-3 border-t border-border">
          {!showPrescription ? (
            <button 
              type="button"
              onClick={() => setShowPrescription(true)}
              className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-xl font-bold text-xs hover:opacity-90 transition-all shadow-md flex items-center justify-center gap-2 group"
            >
              <Pill className="w-4 h-4 text-accent group-hover:scale-110 transition-transform" />
              <span>Issue Digital Prescription</span>
              <ArrowRight className="w-3.5 h-3.5 ml-auto" />
            </button>
          ) : rxSent ? (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Prescription sent successfully. You can continue the consultation.</span>
              </div>
              <button
                type="button"
                onClick={handleCloseSession}
                className="w-full bg-secondary text-foreground py-3 px-4 rounded-xl font-bold text-xs hover:bg-secondary/80 transition-all border border-border flex items-center justify-center gap-2"
              >
                Close Session & Return to Queue
              </button>
            </div>
          ) : (
            <form onSubmit={handleSendPrescription} className="space-y-3">
              {rxError && (
                <div className="p-2 bg-destructive/10 text-destructive text-[10px] font-semibold rounded-lg">
                  {rxError}
                </div>
              )}
              {meds.map((med, i) => (
                <div key={med.id} className="p-3 border border-border rounded-lg space-y-2 bg-background">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-accent uppercase tracking-wider">Med #{i+1}</span>
                    {meds.length > 1 && (
                      <button type="button" onClick={() => setMeds(meds.filter(m => m.id !== med.id))} className="text-destructive text-[10px] font-bold">Remove</button>
                    )}
                  </div>
                  <input required placeholder="Medication Name" className="w-full h-8 px-2 text-xs border border-border rounded bg-card focus:ring-1 focus:ring-ring" value={med.name} onChange={(e) => setMeds(meds.map(m => m.id === med.id ? {...m, name: e.target.value} : m))} />
                  <input required placeholder="Dosage (e.g. 1 Tab BD)" className="w-full h-8 px-2 text-xs border border-border rounded bg-card focus:ring-1 focus:ring-ring" value={med.dosage} onChange={(e) => setMeds(meds.map(m => m.id === med.id ? {...m, dosage: e.target.value} : m))} />
                  <div className="flex gap-2">
                    <input required placeholder="Days" className="w-1/3 h-8 px-2 text-xs border border-border rounded bg-card focus:ring-1 focus:ring-ring" value={med.duration} onChange={(e) => setMeds(meds.map(m => m.id === med.id ? {...m, duration: e.target.value} : m))} />
                    <input required placeholder="Instructions" className="flex-1 h-8 px-2 text-xs border border-border rounded bg-card focus:ring-1 focus:ring-ring" value={med.instructions} onChange={(e) => setMeds(meds.map(m => m.id === med.id ? {...m, instructions: e.target.value} : m))} />
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="followUp" checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} className="rounded border-border" />
                <label htmlFor="followUp" className="text-xs font-semibold text-muted-foreground">Request Follow-up</label>
              </div>
              <button type="button" onClick={() => setMeds([...meds, { id: crypto.randomUUID(), name: "", dosage: "", duration: "", instructions: "" }])} className="w-full text-xs font-bold text-accent py-1">
                + Add Medication
              </button>
              <button type="submit" disabled={isSubmittingRx} className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-bold text-xs disabled:opacity-50">
                {isSubmittingRx ? "Sending..." : "Send Prescription"}
              </button>
              <button type="button" onClick={() => setShowPrescription(false)} className="w-full text-muted-foreground py-1 text-xs font-semibold">
                Cancel
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
