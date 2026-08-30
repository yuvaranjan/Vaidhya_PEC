// ============================================================
// Export rawRecords & weekly aggregates to JSON for Python script
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read rawRecords.ts and evaluate village profiles & daily records
import { villageProfiles, dailyRecords } from '../src/data/rawRecords.ts';
import { getVillageWeeklyHistory } from '../src/lib/anomalyDetection.ts';

const trainingRows = [];

for (const village of villageProfiles) {
  const weeklyHistory = getVillageWeeklyHistory(village.villageId);

  // Encode waterSourceType as categorical integer
  const waterSourceMap = {
    piped: 0,
    borewell: 1,
    open_well: 2,
    tanker: 3,
    canal: 4,
  };
  const waterSourceCode = waterSourceMap[village.waterSourceType] ?? 0;

  for (const week of weeklyHistory) {
    trainingRows.push({
      villageId: village.villageId,
      villageName: village.name,
      districtId: village.districtId,
      weekIndex: week.weekIndex,
      rainfallMm: week.rainfallMm,
      sanitationScore: village.sanitationScore,
      populationDensity: village.populationDensity,
      gatheringDays: week.gatheringDays,
      waterSourceType: village.waterSourceType,
      waterSourceCode,
      caseCount: week.caseCount,
      baseline: week.baseline,
      isSpike: week.isSpike ? 1 : 0,
    });
  }
}

const outputPath = path.join(__dirname, 'training_data.json');
fs.writeFileSync(outputPath, JSON.stringify(trainingRows, null, 2), 'utf-8');
console.log(`Exported ${trainingRows.length} weekly records to ${outputPath}`);
