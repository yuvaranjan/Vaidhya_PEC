// ============================================================
// ArogyaMap — Stage 2: Deterministic Symptom Classifier
// Rule-based, keyword-driven bucketing of natural language chief complaints
// (Transparent, auditable, deterministic — NO LLM / NO patient comparisons)
// ============================================================

export type TrackedSymptomCategory =
  | 'acute_febrile_rash'
  | 'dengue_like_illness'
  | 'acute_diarrheal_illness';

/**
 * Classifies a patient's chief complaint text into a tracked public health category.
 *
 * Rules:
 * 1. acute_febrile_rash:
 *    Requires: "fever" (or temperature like 102F / "febrile", AND NOT negated like "no fever")
 *    AND at least one of: "rash", "spots", "petechiae", "skin eruption"
 *
 * 2. dengue_like_illness:
 *    Requires: "fever" (AND NOT negated)
 *    AND at least one of: "joint pain", "body ache", "muscle pain", "retro-orbital", "myalgia", "arthralgia"
 *    AND DOES NOT contain: "rash", "spots", "petechiae" (which would classify as acute_febrile_rash)
 *
 * 3. acute_diarrheal_illness:
 *    Requires at least one of: "diarrhea", "loose stool", "loose motion", "watery stool", "vomiting"
 *
 * Returns null if the complaint does not match any monitored public health category
 * (excluded from outbreak analytics, never miscategorized).
 */
export function classifySymptom(chiefComplaintText: string): TrackedSymptomCategory | null {
  if (!chiefComplaintText || typeof chiefComplaintText !== 'string') {
    return null;
  }

  const text = chiefComplaintText.toLowerCase();

  // Explicit fever negation check (e.g. "no fever", "without fever", "denies fever", "nil fever")
  const isFeverNegated =
    text.includes('no fever') ||
    text.includes('without fever') ||
    text.includes('denies fever') ||
    text.includes('nil fever') ||
    text.includes('afebrile') ||
    text.includes('not febrile');

  // Positive fever indicators
  const hasPositiveFever =
    !isFeverNegated &&
    (text.includes('fever') ||
      text.includes('febrile') ||
      text.includes('high temp') ||
      /\b10[0-9](\.[0-9])?f\b/.test(text));

  // Rash / Spots keywords
  const hasRashOrSpots =
    text.includes('rash') ||
    text.includes('spot') ||
    text.includes('petechia') ||
    text.includes('eruption');

  // Dengue-specific ache / pain keywords
  const hasDengueAches =
    text.includes('joint pain') ||
    text.includes('body ache') ||
    text.includes('body pain') ||
    text.includes('muscle pain') ||
    text.includes('retro-orbital') ||
    text.includes('myalgia') ||
    text.includes('arthralgia');

  // Diarrheal keywords
  const hasDiarrheal =
    text.includes('diarrhea') ||
    text.includes('diarrhoea') ||
    text.includes('loose stool') ||
    text.includes('loose motion') ||
    text.includes('watery stool') ||
    text.includes('vomiting');

  // 1. Acute Febrile Rash (Highest specificity for dengue/measles surveillance)
  if (hasPositiveFever && hasRashOrSpots) {
    return 'acute_febrile_rash';
  }

  // 2. Dengue-like Illness (Febrile arthralgia/myalgia without skin rash)
  if (hasPositiveFever && hasDengueAches && !hasRashOrSpots) {
    return 'dengue_like_illness';
  }

  // 3. Acute Diarrheal Illness
  if (hasDiarrheal) {
    return 'acute_diarrheal_illness';
  }

  // Unmonitored or non-infectious complaint
  return null;
}

// ── Test Cases & Verification Suite ─────────────────────────

export interface TestCase {
  input: string;
  expected: TrackedSymptomCategory | null;
  description: string;
}

export const symptomClassifierTestCases: TestCase[] = [
  {
    input: 'Patient has high continuous fever for 4 days, erythematous rash on arms and chest, headache',
    expected: 'acute_febrile_rash',
    description: 'Fever + rash -> acute_febrile_rash',
  },
  {
    input: 'Sudden onset fever, petechiae spots on forearms, severe body pain',
    expected: 'acute_febrile_rash',
    description: 'Fever + spots -> acute_febrile_rash',
  },
  {
    input: 'Severe joint pain, intense body ache, persistent fever and shivering for 3 days',
    expected: 'dengue_like_illness',
    description: 'Fever + joint pain/body ache (no rash) -> dengue_like_illness',
  },
  {
    input: 'High fever, retro-orbital eye pain, severe myalgia',
    expected: 'dengue_like_illness',
    description: 'Fever + retro-orbital/myalgia -> dengue_like_illness',
  },
  {
    input: 'Watery diarrhea and vomiting since morning, dehydration',
    expected: 'acute_diarrheal_illness',
    description: 'Diarrhea + vomiting -> acute_diarrheal_illness',
  },
  {
    input: 'Routine blood pressure checkup, mild chronic knee osteoarthritis, no fever',
    expected: null,
    description: 'Non-fever routine checkup with "no fever" negation -> null (excluded)',
  },
  {
    input: 'Fever 102F, rash eruption on torso, chills',
    expected: 'acute_febrile_rash',
    description: '102F temp + rash eruption -> acute_febrile_rash',
  },
  {
    input: 'Skin rash on arm after touching plant, no fever, no aches',
    expected: null,
    description: 'Rash with "no fever" negation -> null (contact dermatitis, not acute febrile rash)',
  },
];

/**
 * Runs self-tests for the symptom classifier and logs verification results.
 */
export function runClassifierSelfTests(): { passed: number; failed: number; total: number } {
  let passed = 0;
  let failed = 0;

  for (const test of symptomClassifierTestCases) {
    const result = classifySymptom(test.input);
    if (result === test.expected) {
      passed++;
    } else {
      failed++;
      console.error(`[Classifier Test Failed] Input: "${test.input}" | Expected: ${test.expected} | Got: ${result}`);
    }
  }

  return { passed, failed, total: symptomClassifierTestCases.length };
}
