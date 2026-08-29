"use client";

import { useState } from "react";

interface SpecialistOpinion {
  opinion: string;
  confidence: "high" | "moderate" | "low";
  evidence: Array<{ source: string; detail: string }>;
  reasoning: string;
  red_flags: string[];
}

export function SpecialistPanel({ visitId }: { visitId: string }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SpecialistOpinion | null>(null);
  const [error, setError] = useState("");

  const handleRequest = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/specialist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visit_id: visitId })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to fetch specialist opinion");

      // The API validates its own shape server-side now, but a panel that
      // trusts an LLM-shaped response without checking is exactly how this
      // crashed the first time — belt and suspenders.
      const CONFIDENCE_LEVELS = ["high", "moderate", "low"];
      if (
        typeof json?.opinion !== "string" ||
        !CONFIDENCE_LEVELS.includes(json?.confidence) ||
        !Array.isArray(json?.evidence) ||
        typeof json?.reasoning !== "string" ||
        !Array.isArray(json?.red_flags)
      ) {
        throw new Error("The specialist response was malformed.");
      }

      setData(json);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm mt-4">
      <h3 className="text-lg font-semibold mb-2">Specialist AI (Advisory)</h3>
      <p className="text-sm text-gray-500 mb-4">
        This AI provides an opinion for the treating doctor's judgment. It does not issue a prescription or a final diagnosis.
      </p>
      
      {!data && (
        <button 
          onClick={handleRequest} 
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Consulting Specialist..." : "Request Specialist Opinion"}
        </button>
      )}

      {error && <p className="text-red-600 mt-2">{error}</p>}

      {data && (
        <div className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-700">Confidence:</span>
            <span className={`px-2 py-1 text-xs rounded-full font-medium ${
              data.confidence === "high" ? "bg-green-100 text-green-800" :
              data.confidence === "moderate" ? "bg-yellow-100 text-yellow-800" :
              "bg-red-100 text-red-800"
            }`}>
              {data.confidence.toUpperCase()}
            </span>
          </div>

          <div>
            <h4 className="font-medium text-gray-700 mb-1">Opinion</h4>
            <p className="text-gray-900">{data.opinion}</p>
          </div>

          <div>
            <h4 className="font-medium text-gray-700 mb-1">Red Flags</h4>
            {data.red_flags.length > 0 ? (
              <ul className="list-disc pl-5">
                {data.red_flags.map((flag, i) => (
                  <li key={i} className="text-red-600">{flag}</li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">None identified.</p>
            )}
          </div>

          <div>
            <h4 className="font-medium text-gray-700 mb-1">Evidence Trace</h4>
            <ul className="list-disc pl-5">
              {data.evidence.map((ev, i) => (
                <li key={i} className="text-gray-800">
                  <span className="capitalize font-semibold text-gray-600">{ev.source}:</span> {ev.detail}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Decision Trace</h4>
            <p className="text-sm text-gray-600 font-mono whitespace-pre-wrap">{data.reasoning}</p>
          </div>
        </div>
      )}
    </div>
  );
}
