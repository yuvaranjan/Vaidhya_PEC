// ============================================================
// ArogyaMap — Stage 4: Linear Trend Forecasting
// Fits linear regression on recent 4-6 weeks and projects 4 weeks forward
// ============================================================

import type { TimeSeriesPoint } from '@/data/types';
import { getVillageWeeklyHistory } from './anomalyDetection';

const FORECAST_LABELS = ['Aug 26', 'Sep 2', 'Sep 9', 'Sep 16'];

/**
 * Fits an ordinary least squares (OLS) linear trend on the array of values.
 * Returns slope (m) and intercept (c).
 */
function fitLinearRegression(values: number[]): { slope: number; intercept: number; variance: number } {
  const n = values.length;
  if (n <= 1) return { slope: 0, intercept: values[0] || 0, variance: 1 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let x = 0; x < n; x++) {
    const y = values[x];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const denominator = n * sumX2 - sumX * sumX;
  const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
  const intercept = (sumY - slope * sumX) / n;

  // Calculate residual variance
  let sumSqResiduals = 0;
  for (let x = 0; x < n; x++) {
    const predicted = slope * x + intercept;
    const residual = values[x] - predicted;
    sumSqResiduals += residual * residual;
  }
  const variance = Math.max(1.5, Math.sqrt(sumSqResiduals / Math.max(1, n - 2)));

  return { slope, intercept, variance };
}

/**
 * Generate 16-point time-series (12 historical + 4 forecast) for a village.
 */
export function generateVillageForecast(villageId: string): TimeSeriesPoint[] {
  const history = getVillageWeeklyHistory(villageId);
  if (!history.length) return [];

  const timeSeries: TimeSeriesPoint[] = [];

  // 1. Add 12 historical actual points with baseline
  for (const w of history) {
    timeSeries.push({
      week: w.weekLabel,
      actual: w.caseCount,
      baseline: w.baseline,
    });
  }

  // 2. Fit linear trend on the last 5 weeks (weeks 7 through 11)
  const windowSize = 5;
  const recentCases = history.slice(-windowSize).map((w) => w.caseCount);
  const { slope, intercept, variance } = fitLinearRegression(recentCases);

  // 3. Project 4 weeks forward
  for (let f = 0; f < 4; f++) {
    // x = windowSize + f
    const x = (windowSize - 1) + (f + 1);
    const projectedRaw = slope * x + intercept;
    const forecast = Math.max(0, Math.round(projectedRaw));

    // Confidence bound expands over forecast horizon (uncertainty grows)
    const margin = Math.round(variance * (1.2 + f * 0.35));
    const upperBound = forecast + margin;
    const lowerBound = Math.max(0, forecast - margin);

    timeSeries.push({
      week: FORECAST_LABELS[f] || `F+${f + 1}`,
      forecast,
      upperBound,
      lowerBound,
    });
  }

  return timeSeries;
}
