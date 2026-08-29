"use client";

import { useEffect, useState } from "react";
import { Cpu, Cloud, CheckCircle2, RefreshCw, AlertCircle } from "lucide-react";
import type { ModelOption } from "@vaidhya/shared";
import { edgeApi, USE_MOCK_AI } from "@/lib/edgeApi";

export function SettingsClient() {
  const [current, setCurrent] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [available, setAvailable] = useState<ModelOption[]>([]);
  const [selected, setSelected] = useState<ModelOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await edgeApi.listModels();
      setCurrent(res.current);
      setProvider(res.provider);
      setAvailable(res.available);
    } catch (err) {
      setError((err as Error).message || "Could not reach the edge-ai service.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!USE_MOCK_AI) void load();
    else setLoading(false);
  }, []);

  const handleApply = async () => {
    if (!selected) return;
    setApplying(true);
    setApplied(false);
    setError(null);
    try {
      await edgeApi.setModel({ model: selected.id, provider: selected.provider });
      setCurrent(selected.id);
      setProvider(selected.provider);
      setApplied(true);
    } catch (err) {
      setError((err as Error).message || "Could not switch model.");
    } finally {
      setApplying(false);
    }
  };

  if (USE_MOCK_AI) {
    return (
      <div className="p-5 bg-secondary/60 border border-border rounded-xl text-sm text-muted-foreground font-medium">
        Running against mocked responses (<code className="text-xs bg-card px-1.5 py-0.5 rounded border border-border">NEXT_PUBLIC_USE_MOCK_AI=true</code>).
        Model selection talks to the real edge-ai service, so it has nothing to switch here.
      </div>
    );
  }

  const local = available.filter((m) => m.provider === "lmstudio");
  const cloud = available.filter((m) => m.provider === "groq");

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl shadow-soft p-5 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Currently Active</p>
          <p className="text-foreground font-bold text-sm mt-0.5 flex items-center gap-2">
            {provider === "groq" ? <Cloud className="w-4 h-4 text-accent" /> : <Cpu className="w-4 h-4 text-accent" />}
            {current ?? (loading ? "Loading…" : "Unknown")}
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="p-2 rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          title="Refresh model list"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl font-bold text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !error && (
        <div className="py-10 text-center text-xs font-semibold text-muted-foreground">
          Checking LM Studio and Groq for available models…
        </div>
      )}

      {!loading && !error && available.length === 0 && (
        <div className="py-10 text-center text-xs font-semibold text-muted-foreground">
          No models reachable — check the edge-ai service, LM Studio, and GROQ_API_KEY.
        </div>
      )}

      {local.length > 0 && (
        <ModelGroup
          title="Local — LM Studio"
          hint="Runs on this machine. Only these keep the offline claim true."
          icon={<Cpu className="w-3.5 h-3.5" />}
          models={local}
          current={current}
          selected={selected}
          onSelect={setSelected}
        />
      )}

      {cloud.length > 0 && (
        <ModelGroup
          title="Cloud — Groq"
          hint="Needs internet. Larger and faster, but not the offline story."
          icon={<Cloud className="w-3.5 h-3.5" />}
          models={cloud}
          current={current}
          selected={selected}
          onSelect={setSelected}
        />
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => void handleApply()}
          disabled={!selected || applying || selected.id === current}
          className="px-5 h-11 bg-primary text-primary-foreground rounded-lg font-bold text-xs shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {applying ? "Switching…" : "Use This Model"}
        </button>
        {applied && (
          <span className="text-xs font-bold text-[#14736A] flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Active for the rest of this session
          </span>
        )}
      </div>
    </div>
  );
}

function ModelGroup({
  title,
  hint,
  icon,
  models,
  current,
  selected,
  onSelect,
}: {
  title: string;
  hint: string;
  icon: React.ReactNode;
  models: ModelOption[];
  current: string | null;
  selected: ModelOption | null;
  onSelect: (m: ModelOption) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent flex items-center gap-1.5">
        {icon} {title}
      </p>
      <p className="text-xs text-muted-foreground -mt-1">{hint}</p>
      <div className="border border-border rounded-xl divide-y divide-border overflow-hidden bg-card">
        {models.map((m) => {
          const isCurrent = m.id === current;
          const isSelected = selected?.id === m.id && selected?.provider === m.provider;
          return (
            <button
              key={`${m.provider}-${m.id}`}
              onClick={() => onSelect(m)}
              className={`w-full text-left px-4 py-3 flex items-center justify-between text-sm transition-colors ${
                isSelected ? "bg-[#E5F5F3]" : "hover:bg-secondary/50"
              }`}
            >
              <span className="font-semibold text-foreground truncate pr-3">{m.id}</span>
              <span className="flex items-center gap-2 shrink-0">
                {isCurrent && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#E5F5F3] text-[#14736A] border border-[#C2E8E4]">
                    Active
                  </span>
                )}
                <span
                  className={`w-4 h-4 rounded-full border-2 ${
                    isSelected ? "border-primary bg-primary" : "border-border"
                  }`}
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
