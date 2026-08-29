"use client";

import { useActionState } from "react";
import { loginDoctor } from "./actions";
import { 
  Stethoscope, 
  Phone, 
  Lock, 
  ArrowRight, 
  ShieldCheck 
} from "lucide-react";

export default function DoctorLoginPage() {
  const [state, formAction, isPending] = useActionState(loginDoctor, null);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-5 sm:p-8">
      <div className="w-full max-w-md bg-card p-6 sm:p-8 rounded-xl shadow-soft border border-border space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-primary text-accent mx-auto flex items-center justify-center shadow-sm">
            <Stethoscope className="w-7 h-7 text-accent" />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent">Clinical Physician Portal</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-[-0.025em]">Cure Cloud Doctor</h1>
          <p className="text-xs text-muted-foreground font-medium">Access your triage queue, review reports, and prescribe eRx.</p>
        </div>

        <form action={formAction} className="space-y-5">
          {state?.error && (
            <div className="p-3.5 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs font-semibold">
              {state.error}
            </div>
          )}

          <div>
            <label htmlFor="phone" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-accent" /> Physician Phone ID
            </label>
            <input 
              type="tel" 
              id="phone" 
              name="phone" 
              required 
              defaultValue="9000000002" 
              className="w-full h-11 px-3.5 border border-border rounded-lg bg-background text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring" 
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-accent" /> Security Password
            </label>
            <input 
              type="password" 
              id="password" 
              name="password" 
              required 
              defaultValue="vaidhya123"
              className="w-full h-11 px-3.5 border border-border rounded-lg bg-background text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="mt-2.5 p-2.5 rounded-lg bg-secondary/80 border border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Demo Doctor Pass:</span>
              <code className="font-bold text-accent font-mono bg-card px-2 py-0.5 rounded border border-border">vaidhya123</code>
            </div>
          </div>

          <button 
            disabled={isPending} 
            className="w-full h-11 mt-2 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 shadow-sm disabled:opacity-50 transition-all text-xs flex items-center justify-center gap-2"
          >
            <span>{isPending ? "Authenticating Physician..." : "Enter Doctor Portal"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-4 border-t border-border text-center">
          <a href="/login" className="text-xs font-semibold text-accent hover:underline">
            Are you a patient seeking consultation? Patient Portal &rarr;
          </a>
        </div>

      </div>
    </div>
  );
}
