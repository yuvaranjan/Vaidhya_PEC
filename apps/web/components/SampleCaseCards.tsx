import type { CaseHistoryRecord } from '@/lib/csvAdapter';

interface SampleCaseCardsProps {
  cases: CaseHistoryRecord[];
  villageName: string;
}

export function SampleCaseCards({ cases, villageName }: SampleCaseCardsProps) {
  if (!cases || cases.length === 0) {
    return null;
  }

  return (
    <div className="card p-5 mt-6">
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Recent Flagged Patient Visits in {villageName}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Sample de-identified cases showing recorded vital abnormalities and physician root causes
          </p>
        </div>
        <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
          Privacy-Protected
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cases.map((c) => (
          <div
            key={c.visit_id}
            className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/90 hover:border-brand-300 transition-all flex flex-col justify-between"
          >
            {/* Top row: ID, Date, Status */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {c.patient_id}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">{c.visit_date}</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                  {c.vital_flag_types.replace('+', ' · ')}
                </span>
              </div>

              {/* Chief complaint */}
              <p className="text-sm font-semibold text-slate-900 mb-2 leading-snug">
                &ldquo;{c.chief_complaint}&rdquo;
              </p>

              {/* Vitals grid */}
              <div className="grid grid-cols-4 gap-1.5 p-2 rounded-lg bg-white border border-slate-200/80 mb-2.5 text-center">
                <div>
                  <p className="text-[9px] uppercase font-bold text-slate-400">BP</p>
                  <p className="text-xs font-extrabold text-slate-800">
                    {c.bp_systolic}/{c.bp_diastolic}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] uppercase font-bold text-slate-400">Pulse</p>
                  <p className="text-xs font-extrabold text-slate-800">{c.heart_rate} bpm</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase font-bold text-slate-400">SpO2</p>
                  <p className={`text-xs font-extrabold ${c.spo2 < 94 ? 'text-red-600' : 'text-slate-800'}`}>
                    {c.spo2}%
                  </p>
                </div>
                <div>
                  <p className="text-[9px] uppercase font-bold text-slate-400">Temp</p>
                  <p className={`text-xs font-extrabold ${c.temperature_c >= 38.0 ? 'text-red-600' : 'text-slate-800'}`}>
                    {c.temperature_c}°C
                  </p>
                </div>
              </div>
            </div>

            {/* Doctor root cause footer */}
            {c.doctor_root_cause && (
              <div className="pt-2 border-t border-slate-200/70 flex items-start gap-1.5 text-xs text-slate-600">
                <span className="font-semibold text-slate-800 shrink-0">Doctor Note:</span>
                <span className="italic text-slate-700 leading-tight">{c.doctor_root_cause}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
