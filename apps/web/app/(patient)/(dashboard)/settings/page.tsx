import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div className="w-full max-w-3xl mx-auto py-8 px-5 sm:px-8 space-y-7">
      <div className="border-b border-border pb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent mb-1">Edge AI Configuration</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-[-0.025em]">AI Model Settings</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Choose which model powers the clinical intake voicebot for this session.
          Nurses operate this alongside the patient — switch to a larger model if one
          is available and responses seem to be looping or missing detail.
        </p>
      </div>
      <SettingsClient />
    </div>
  );
}
