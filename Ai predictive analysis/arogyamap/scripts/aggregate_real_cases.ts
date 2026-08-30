// ============================================================
// CLI script: Ingests patient reports, runs symptom classification,
// and outputs live vs seeded aggregation statistics.
// ============================================================

import { runClassifierSelfTests } from '../src/lib/symptomClassifier';
import { liveDiagnosticReports } from '../src/data/patientRecords';
import { aggregateLiveDiagnosticReports, getVillageProvenanceInfo } from '../src/lib/realCaseAggregation';
import { villageProfiles } from '../src/data/rawRecords';

console.log('=' .repeat(65));
console.log('ArogyaMap — Real Patient Intake Aggregation & Classifier Verification');
console.log('=' .repeat(65));

// 1. Run classifier self-tests
console.log('\n1. Running Deterministic Symptom Classifier Self-Tests:');
const testResults = runClassifierSelfTests();
console.log(`✓ Tests Passed: ${testResults.passed} / ${testResults.total}`);

if (testResults.failed > 0) {
  console.error(`✗ ${testResults.failed} test(s) failed!`);
  process.exit(1);
}

// 2. Ingest diagnostic reports
console.log(`\n2. Ingesting ${liveDiagnosticReports.length} Raw Diagnostic Intake Reports:`);
const aggregatedLive = aggregateLiveDiagnosticReports(liveDiagnosticReports);
console.log(`✓ Grouped into ${aggregatedLive.length} village-date-symptom daily live records.`);

// 3. Print sample provenance breakdown
console.log('\n3. Village Data Provenance Breakdown (Sample):');
console.log('-----------------------------------------------------------------');
console.log('Village Name                    | Live Cases | Seeded | Source');
console.log('-----------------------------------------------------------------');

for (const v of villageProfiles.slice(0, 8)) {
  const prov = getVillageProvenanceInfo(v.villageId);
  const namePad = v.name.padEnd(30, ' ');
  const livePad = String(prov.liveRecordCount).padStart(10, ' ');
  const seededPad = String(prov.seededRecordCount).padStart(6, ' ');
  const sourcePad = `  ${prov.primarySource.toUpperCase()}`;
  console.log(`${namePad} | ${livePad} | ${seededPad} | ${sourcePad}`);
}
console.log('-----------------------------------------------------------------');
console.log('[Success] Real patient case bridge is verified and operational.');
