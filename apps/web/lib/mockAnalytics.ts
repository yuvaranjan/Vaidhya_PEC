export type CaseRow = {
  region_id: string;
  disease_category: string;
  week_start_date: string;
  case_count: number;
  rolling_baseline: number | null;
  is_anomaly: boolean | null;
  predicted_case_count?: number | null;
  forecast_upper?: number | null;
  forecast_lower?: number | null;
  is_forecast?: boolean;
  outbreak_risk_level?: "low" | "moderate" | "high";
  outbreak_probability?: number;
};

export const REGION_LABELS: Record<string, string> = {
  reg_thrissur: "Thrissur",
  reg_palakkad: "Palakkad",
  reg_ernakulam: "Ernakulam",
  reg_kozhikode: "Kozhikode",
  reg_malappuram: "Malappuram",
  reg_kannur: "Kannur",
  reg_kollam: "Kollam",
  reg_alappuzha: "Alappuzha",
  reg_kottayam: "Kottayam",
  reg_wayanad: "Wayanad",
};

export const DISEASE_LABELS: Record<string, string> = {
  dengue: "Dengue Fever",
  respiratory_infection: "Respiratory Infection",
  diarrheal_disease: "Diarrheal Disease",
  hypertension_related: "Hypertension-Related",
};

const REGIONS = [
  { id: "reg_thrissur", mult: 1.0 },
  { id: "reg_palakkad", mult: 0.9 },
  { id: "reg_ernakulam", mult: 1.3 },
  { id: "reg_kozhikode", mult: 1.1 },
  { id: "reg_malappuram", mult: 1.2 },
  { id: "reg_kannur", mult: 0.8 },
  { id: "reg_kollam", mult: 0.95 },
  { id: "reg_alappuzha", mult: 1.05 },
  { id: "reg_kottayam", mult: 0.85 },
  { id: "reg_wayanad", mult: 0.6 },
];

const DISEASES = [
  { id: "dengue", base: 8, amp: 2 },
  { id: "respiratory_infection", base: 20, amp: 4 },
  { id: "diarrheal_disease", base: 12, amp: 3 },
  { id: "hypertension_related", base: 15, amp: 2 },
];

export function generateMockAnalyticsRows(): CaseRow[] {
  const rows: CaseRow[] = [];
  const anchorDate = new Date("2026-08-03");

  // 1. Historical 26 Weeks
  for (let w = 1; w <= 26; w++) {
    const d = new Date(anchorDate);
    d.setDate(d.getDate() - (26 - w) * 7);
    const dateStr = d.toISOString().split("T")[0];

    for (const r of REGIONS) {
      for (const dis of DISEASES) {
        const pseudoWave = Math.sin((w + r.id.length + dis.id.length) * 0.5);
        let caseCount = Math.round((dis.base + pseudoWave * dis.amp) * r.mult);

        let isAnomaly = false;
        if (r.id === "reg_ernakulam" && dis.id === "dengue" && w === 24) {
          caseCount = 38; // 3.2x baseline spike
          isAnomaly = true;
        }

        let baseline: number | null = null;
        if (w >= 4) {
          const pastCounts = rows
            .filter(row => row.region_id === r.id && row.disease_category === dis.id)
            .slice(-4)
            .map(row => row.case_count);
          if (pastCounts.length > 0) {
            const sum = pastCounts.reduce((a, b) => a + b, 0);
            baseline = Math.round((sum / pastCounts.length) * 10) / 10;
          }
        }

        if (baseline && caseCount >= baseline * 2 && w > 4) {
          isAnomaly = true;
        }

        rows.push({
          region_id: r.id,
          disease_category: dis.id,
          week_start_date: dateStr,
          case_count: caseCount,
          rolling_baseline: baseline,
          is_anomaly: isAnomaly,
          predicted_case_count: caseCount, // historical matches actual
          is_forecast: false,
          outbreak_risk_level: isAnomaly ? "high" : caseCount > 20 ? "moderate" : "low",
          outbreak_probability: isAnomaly ? 92 : Math.min(85, Math.round(caseCount * 2.5)),
        });
      }
    }
  }

  // 2. Predictive ML 4-Week Future Horizon (Weeks 27 to 30)
  for (let fw = 1; fw <= 4; fw++) {
    const d = new Date(anchorDate);
    d.setDate(d.getDate() + fw * 7);
    const dateStr = d.toISOString().split("T")[0];

    for (const r of REGIONS) {
      for (const dis of DISEASES) {
        // Calculate trailing trend from last 4 weeks (weeks 23-26)
        const recentRows = rows
          .filter(row => row.region_id === r.id && row.disease_category === dis.id && !row.is_forecast)
          .slice(-4);
        
        const recentAvg = recentRows.reduce((a, b) => a + b.case_count, 0) / (recentRows.length || 1);
        const lastVal = recentRows[recentRows.length - 1]?.case_count || recentAvg;
        
        // Holt-Winters / ARMA Trend slope simulation
        let trendSlope = (lastVal - recentAvg) * 0.4;
        let predictedVal = Math.max(2, Math.round(lastVal + trendSlope * fw));

        // High predictive risk for Dengue in Ernakulam and Malappuram due to post-surge decay/secondary wave
        if (r.id === "reg_ernakulam" && dis.id === "dengue") {
          predictedVal = Math.round(32 - fw * 4); // Secondary wave trajectory (28, 24, 20, 16)
        } else if (r.id === "reg_malappuram" && dis.id === "respiratory_infection") {
          predictedVal = Math.round(26 + fw * 3); // Upward seasonal outbreak projection
        }

        const upperBound = Math.round(predictedVal * 1.25 + 3);
        const lowerBound = Math.max(1, Math.round(predictedVal * 0.75 - 2));

        const riskProb = Math.min(96, Math.round((predictedVal / (dis.base * r.mult)) * 45));
        const riskLevel = riskProb > 75 ? "high" : riskProb > 50 ? "moderate" : "low";

        rows.push({
          region_id: r.id,
          disease_category: dis.id,
          week_start_date: dateStr,
          case_count: predictedVal, // for chart continuity
          rolling_baseline: Math.round(recentAvg * 10) / 10,
          is_anomaly: riskLevel === "high",
          predicted_case_count: predictedVal,
          forecast_upper: upperBound,
          forecast_lower: lowerBound,
          is_forecast: true,
          outbreak_risk_level: riskLevel,
          outbreak_probability: riskProb,
        });
      }
    }
  }

  return rows;
}
