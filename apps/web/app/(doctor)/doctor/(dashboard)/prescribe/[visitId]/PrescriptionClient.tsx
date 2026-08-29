"use client";

import { useState } from "react";
import { submitPrescription } from "./actions";
import { 
  Pill, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  User, 
  Clock, 
  AlertTriangle,
  FileCheck
} from "lucide-react";

type Medication = {
  id: string;
  name: string;
  dosage: string;
  duration: string;
  instructions: string;
};

export function PrescriptionClient({ visitId, patientName }: { visitId: string; patientName: string }) {
  const [meds, setMeds] = useState<Medication[]>([
    { id: crypto.randomUUID(), name: "", dosage: "", duration: "", instructions: "" }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleAddRow = () => {
    setMeds([...meds, { id: crypto.randomUUID(), name: "", dosage: "", duration: "", instructions: "" }]);
  };

  const handleRemoveRow = (id: string) => {
    setMeds(meds.filter(m => m.id !== id));
  };

  const handleChange = (id: string, field: keyof Medication, value: string) => {
    setMeds(meds.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("medications", JSON.stringify(meds));
      await submitPrescription(visitId, formData);
    } catch (err: any) {
      setError(err.message || "Failed to submit prescription");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-5 sm:px-8 space-y-7">
      {/* Header Pattern */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent mb-1 flex items-center gap-1.5">
            <Pill className="w-3.5 h-3.5" /> Doctor Portal &bull; Final Step
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-[-0.025em]">Electronic Prescription (eRx)</h1>
        </div>
        <div className="flex items-center gap-2 px-3.5 py-1.5 bg-secondary rounded-full border border-border">
          <User className="w-4 h-4 text-accent" />
          <span className="text-xs font-bold text-foreground">Patient: {patientName}</span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl font-semibold flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Prescription Form */}
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl shadow-soft p-6 sm:p-8 space-y-6">
        
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-accent" />
            <span>Prescribed Medications</span>
          </h2>
          <span className="text-xs font-semibold text-muted-foreground">
            {meds.length} {meds.length === 1 ? "Item" : "Items"} Listed
          </span>
        </div>

        <div className="space-y-5">
          {meds.map((med, index) => (
            <div key={med.id} className="p-5 border border-border rounded-xl bg-background relative shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-border/60 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5" /> Medication #{index + 1}
                </span>
                {meds.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => handleRemoveRow(med.id)}
                    className="text-destructive hover:opacity-80 text-xs font-bold transition-opacity flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Medication Name
                  </label>
                  <input
                    required
                    type="text"
                    value={med.name}
                    onChange={(e) => handleChange(med.id, "name", e.target.value)}
                    placeholder="e.g. Amoxicillin 500mg"
                    className="w-full h-11 px-3.5 border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-ring text-xs font-semibold text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Dosage & Frequency
                  </label>
                  <input
                    required
                    type="text"
                    value={med.dosage}
                    onChange={(e) => handleChange(med.id, "dosage", e.target.value)}
                    placeholder="e.g. 1 Tablet Twice Daily"
                    className="w-full h-11 px-3.5 border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-ring text-xs font-semibold text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Duration (Days)
                  </label>
                  <input
                    required
                    type="text"
                    value={med.duration}
                    onChange={(e) => handleChange(med.id, "duration", e.target.value)}
                    placeholder="e.g. 5 days"
                    className="w-full h-11 px-3.5 border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-ring text-xs font-semibold text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Patient Instructions
                  </label>
                  <input
                    required
                    type="text"
                    value={med.instructions}
                    onChange={(e) => handleChange(med.id, "instructions", e.target.value)}
                    placeholder="e.g. Take with warm food after meals"
                    className="w-full h-11 px-3.5 border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-ring text-xs font-semibold text-foreground"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border">
          <button
            type="button"
            onClick={handleAddRow}
            className="text-accent font-bold hover:opacity-80 transition-opacity text-xs flex items-center gap-1.5 px-4 h-10 rounded-lg bg-secondary border border-border"
          >
            <Plus className="w-4 h-4" />
            <span>Add Additional Medication</span>
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-primary text-primary-foreground px-8 h-11 rounded-lg font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition-all text-xs flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <CheckCircle2 className="w-4 h-4 text-accent" />
            <span>{isSubmitting ? "Finalizing Visit..." : "Sign eRx & Complete Consultation"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
