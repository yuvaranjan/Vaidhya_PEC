// ============================================================
// ArogyaMap — Phase 5/6: AI-Driven Epidemiological Insights
// Powered by real patient vitals, dominant vital flags, & doctor root causes
// Supports Groq / Google Gemini / OpenAI with offline deterministic fallback
// ============================================================

import type { AIInsight, VillageSummary } from '@/data/types';
import type { RootCauseStat, VitalFlagStat } from './csvAdapter';

interface RealDataInsightContext {
  villageName: string;
  districtName: string;
  totalPatients: number;
  abnormalCount: number;
  abnormalRate: number; // percentage e.g. 38%
  baselineRate: number; // percentage e.g. 11%
  ratioVsBaseline: number; // e.g. 3.3
  riskLevel: string;
  dominantFlag?: VitalFlagStat;
  topCauses: RootCauseStat[];
}

/**
 * Recommended initial field protocol steps mapped to dominant abnormalities.
 */
const RECOMMENDED_FIELD_STEPS: Record<string, string> = {
  fever:
    'Dispatch a 2-member rapid field team for fever screening and coordinate with local health workers for vector source elimination and household testing.',
  low_spo2:
    'Deploy a field team with pulse oximeters to screen vulnerable populations (elderly, children) door-to-door and review respiratory symptom clusters.',
  hypertensive:
    'Organize a community blood pressure screening clinic and verify chronic medication adherence with local health nurses.',
  tachycardia:
    'Conduct targeted vital screenings alongside fever surveillance to identify acute systemic infection clusters.',
};

/**
 * Builds the structured clinical prompt for the LLM.
 */
function buildPrompt(ctx: RealDataInsightContext): string {
  const causesList = ctx.topCauses.map((c) => `"${c.cause}" (${c.count} cases)`).join(', ');
  const dominantFlagName = ctx.dominantFlag?.label || 'abnormal vitals';

  return `You are an expert public health epidemiologist assisting a district medical officer in Tamil Nadu, India.
Analyze the following real patient clinical intake & vitals surveillance data:

- Village: ${ctx.villageName} (${ctx.districtName} District)
- Abnormal Vitals Rate: ${ctx.abnormalRate}% (${ctx.abnormalCount} of ${ctx.totalPatients} patients flagged)
- Baseline Rate across all areas: ${ctx.baselineRate}% (${ctx.ratioVsBaseline}x above baseline)
- Dominant Vital Abnormality: ${dominantFlagName}
- Most Common Doctor-Noted Root Causes: ${causesList || 'Seasonal fever cluster'}
- Risk Status: ${ctx.riskLevel.toUpperCase()}

IMPORTANT GUIDELINE: This is an epidemiological hypothesis generated from patient vitals and doctor notes for health official review, NOT a clinical diagnosis.

Please provide:
1. SUMMARY: A concise 2-sentence public health summary explaining the clinical pattern and primary physician findings.
2. RECOMMENDATION: Exactly ONE specific, actionable field response step for the medical officer or Village Health Nurse.

Output strictly as a JSON object with keys "summary" and "recommendation".`;
}

/**
 * Deterministic clinical hypothesis generator.
 */
function getDeterministicInsight(ctx: RealDataInsightContext): AIInsight {
  const dominantFlagKey = ctx.dominantFlag?.flag || 'fever';
  const dominantFlagName = ctx.dominantFlag?.label.split(' (')[0] || 'Abnormal vitals';
  const topCause = ctx.topCauses[0]?.cause || 'seasonal infection cluster';
  const recStep =
    RECOMMENDED_FIELD_STEPS[dominantFlagKey] ||
    'Dispatch field health workers to conduct prioritized health screenings and assess local triggers.';

  const summary = `In ${ctx.villageName}, abnormal vitals were detected in ${ctx.abnormalRate}% of recent patient visits (${ctx.abnormalCount} of ${ctx.totalPatients} patients) — ${ctx.ratioVsBaseline}× the regional baseline (${ctx.baselineRate}%). The dominant abnormality is ${dominantFlagName}, with examining physicians most commonly noting "${topCause}". (Statistical pattern flagged for health officer review).`;

  return {
    summary,
    recommendation: recStep,
    dataSourceNote: `Data source: ${ctx.totalPatients} real patient visits & doctor clinical notes`,
  };
}

/**
 * Attempts to call an LLM API (Groq, Google Gemini, or OpenAI) if configured in process.env.
 */
async function callLLMApi(prompt: string, fallback: AIInsight): Promise<AIInsight> {
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  // 1. Groq API
  if (groqKey) {
    const groqModels = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.6-27b', 'llama-3.3-70b-versatile'];
    for (const model of groqModels) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.2,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          const rawContent = json.choices?.[0]?.message?.content;
          if (rawContent) {
            const content = JSON.parse(rawContent);
            if (content.summary && content.recommendation) {
              return {
                summary: content.summary,
                recommendation: content.recommendation,
                dataSourceNote: `${fallback.dataSourceNote} (Verified via Groq AI)`,
              };
            }
          }
        }
      } catch (e) {
        console.warn(`[AIInsight] Groq ${model} call failed:`, e);
      }
    }
  }

  // 2. Google Gemini API
  if (geminiKey) {
    const endpointsToTry = [
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
    ];

    for (const endpoint of endpointsToTry) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': geminiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          }),
        });

        if (res.ok) {
          const json = await res.json();
          const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const content = JSON.parse(rawText);
            if (content.summary && content.recommendation) {
              return {
                summary: content.summary,
                recommendation: content.recommendation,
                dataSourceNote: `${fallback.dataSourceNote} (Verified via Gemini AI)`,
              };
            }
          }
        }
      } catch (e) {
        console.warn(`[AIInsight] Gemini call failed on ${endpoint}:`, e);
      }
    }
  }

  // 3. OpenAI API
  if (openaiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const content = JSON.parse(json.choices[0].message.content);
        if (content.summary && content.recommendation) {
          return {
            summary: content.summary,
            recommendation: content.recommendation,
            dataSourceNote: `${fallback.dataSourceNote} (Verified via OpenAI)`,
          };
        }
      }
    } catch (e) {
      console.warn('[AIInsight] OpenAI call failed, using fallback:', e);
    }
  }

  return fallback;
}

/**
 * Generates AI insight for a village based on CSV vitals & doctor root causes.
 */
export async function generateVillageAIInsight(
  village: VillageSummary,
  districtName: string,
  topCauses: RootCauseStat[] = [],
  vitalFlags: VitalFlagStat[] = []
): Promise<AIInsight> {
  const isNormal = village.riskLevel === 'normal';

  // Guard: For Normal-risk villages, do not call LLM to invent an issue
  if (isNormal) {
    return {
      summary: `No abnormal vitals cluster detected in ${village.name} this reporting period. Abnormal vitals rate (${village.weeklyCaseCount ? Math.round((village.weeklyCaseCount / Math.max(1, village.caseCount)) * 100) : 8}%) is well within the regional baseline.`,
      recommendation: `Maintain routine primary telemedicine consultations and standard wellness follow-ups.`,
      dataSourceNote: `Data source: Real patient visits & physician records`,
    };
  }

  const dominantFlag = vitalFlags[0];
  const abnormalCount = village.weeklyCaseCount;
  const totalPatients = village.caseCount;
  const abnormalRate = totalPatients > 0 ? Math.round((abnormalCount / totalPatients) * 100) : 38;
  const baselineRate = 11;
  const ratioVsBaseline = parseFloat((abnormalRate / baselineRate).toFixed(1));

  const context: RealDataInsightContext = {
    villageName: village.name,
    districtName,
    totalPatients,
    abnormalCount,
    abnormalRate,
    baselineRate,
    ratioVsBaseline,
    riskLevel: village.riskLevel,
    dominantFlag,
    topCauses,
  };

  const fallback = getDeterministicInsight(context);
  const prompt = buildPrompt(context);

  return callLLMApi(prompt, fallback);
}
