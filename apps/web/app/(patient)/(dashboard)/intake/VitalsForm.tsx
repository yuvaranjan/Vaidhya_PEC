"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { edgeApi } from "@/lib/edgeApi";
import type { VitalReadingInput } from "@vaidhya/shared";
import { 
  Thermometer, 
  Activity, 
  Heart, 
  Wind, 
  ShieldCheck, 
  ArrowRight,
  Sparkles 
} from "lucide-react";

export function VitalsForm({
  visitId,
  patientId,
}: {
  visitId: string;
  patientId: string;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const temperature = parseFloat(formData.get("temperature") as string);
    const bloodPressure = formData.get("blood_pressure") as string;
    const pulse = parseInt(formData.get("pulse") as string, 10);
    const spo2 = parseInt(formData.get("spo2") as string, 10);
    const respRate = parseInt(formData.get("respiratory_rate") as string, 10);

    const readings: VitalReadingInput[] = [
      { type: "temperature", value_numeric: temperature, unit: "fahrenheit" },
      { type: "blood_pressure", value_text: bloodPressure },
      { type: "pulse", value_numeric: pulse },
      { type: "spo2", value_numeric: spo2 },
      { type: "respiratory_rate", value_numeric: respRate },
    ];

    try {
      // patient_id lets the edge service open the visit here — Pass One runs
      // before the consult screen picks a language and calls /session/start.
      await edgeApi.vitals({
        visit_id: visitId,
        patient_id: patientId,
        phase: "pass_one_baseline",
        readings,
      });
      router.push("/consult");
    } catch (err: any) {
      console.error("Vitals submission failed:", err);
      setError(err.message || "Failed to submit vitals");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto my-6 bg-card p-6 sm:p-8 rounded-xl shadow-soft border border-border">
      {/* Header Pattern */}
      <div className="mb-7 border-b border-border pb-5 flex justify-between items-start">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E5F5F3] text-[#14736A] text-[10px] font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3 h-3 text-[#14736A]" /> Step 1 of 2
          </div>
          <h2 className="text-2xl font-bold text-foreground tracking-[-0.025em]">Record Baseline Vitals</h2>
          <p className="text-muted-foreground text-sm mt-1">Input baseline physiological readings for the AI triage engine.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3.5 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          <div>
            <label htmlFor="temperature" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Thermometer className="w-3.5 h-3.5 text-accent" /> Temperature (°F)
            </label>
            <input 
              type="number" 
              step="0.1" 
              id="temperature" 
              name="temperature" 
              required 
              defaultValue="98.6"
              className="w-full h-11 px-3.5 border border-border rounded-lg bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring text-foreground" 
              placeholder="98.6" 
            />
          </div>

          <div>
            <label htmlFor="blood_pressure" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-accent" /> Blood Pressure
            </label>
            <input 
              type="text" 
              id="blood_pressure" 
              name="blood_pressure" 
              required 
              defaultValue="120/80"
              pattern="\d{2,3}/\d{2,3}" 
              title="Format: 120/80" 
              className="w-full h-11 px-3.5 border border-border rounded-lg bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring text-foreground" 
              placeholder="120/80" 
            />
          </div>

          <div>
            <label htmlFor="pulse" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-destructive" /> Pulse (bpm)
            </label>
            <input 
              type="number" 
              id="pulse" 
              name="pulse" 
              required 
              defaultValue="76"
              className="w-full h-11 px-3.5 border border-border rounded-lg bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring text-foreground" 
              placeholder="80" 
            />
          </div>

          <div>
            <label htmlFor="spo2" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-accent" /> SpO2 (%)
            </label>
            <input 
              type="number" 
              id="spo2" 
              name="spo2" 
              required 
              min="0" 
              max="100" 
              defaultValue="98"
              className="w-full h-11 px-3.5 border border-border rounded-lg bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring text-foreground" 
              placeholder="98" 
            />
          </div>

        </div>

        <div>
          <label htmlFor="respiratory_rate" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <Wind className="w-3.5 h-3.5 text-accent" /> Respiratory Rate (breaths/min)
          </label>
          <input 
            type="number" 
            id="respiratory_rate" 
            name="respiratory_rate" 
            required 
            defaultValue="16"
            className="w-full h-11 px-3.5 border border-border rounded-lg bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring text-foreground" 
            placeholder="16" 
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 mt-6 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 shadow-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          <span>{isSubmitting ? "Saving Vitals..." : "Proceed to AI Consultation"}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
