import fs from 'fs';
import path from 'path';
import { generateVillageAIInsight } from '../src/lib/aiInsight';
import { getVillageDetail } from '../src/data/villages';

// Read .env.local manually
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...vals] = trimmed.split('=');
      process.env[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
}

async function runTest() {
  console.log('--- Testing Live AI LLM Generation ---');
  console.log('GROQ_API_KEY:', process.env.GROQ_API_KEY ? 'Present' : 'Missing');
  console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'Present' : 'Missing');

  console.log('\n[1] Fetching Melur (Critical Respiratory Cluster)...');
  const detail = await getVillageDetail('623', '623-01');
  if (!detail) {
    console.log('Could not find village detail.');
    return;
  }

  console.log('[2] Calling generateVillageAIInsight()...');
  const insight = await generateVillageAIInsight(
    detail.summary,
    detail.districtName,
    detail.causes,
    detail.vitalFlags
  );

  console.log('\n--- Output Result ---');
  console.log('Summary:', insight.summary);
  console.log('Recommendation:', insight.recommendation);
  console.log('Verified Tag:', insight.dataSourceNote);
  console.log('---------------------');
}

runTest().catch((err) => {
  console.error('[Error during test]', err);
});
