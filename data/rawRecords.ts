// ============================================================
// ArogyaMap — Raw Data Layer (Phase 3)
// Real seeded tables: villageProfile & dailyRecords (84 days)
// ============================================================

export type WaterSourceType = 'piped' | 'open_well' | 'borewell' | 'tanker' | 'canal';

export interface VillageProfile {
  villageId: string;
  districtId: string;
  name: string;
  sanitationScore: number; // 0-100 (lower = worse sanitation / higher vector risk)
  waterSourceType: WaterSourceType;
  populationDensity: number; // people per sq km
}

export interface DailyRecord {
  villageId: string;
  date: string; // YYYY-MM-DD
  symptom: string;
  caseCount: number;
  rainfallMm: number;
  gatheringFlag: number; // 0 = standard day, 1 = market/temple gathering
}

// ── Village Profiles (44 villages across 8 districts) ────────

export const villageProfiles: VillageProfile[] = [
  // Chennai (603)
  { villageId: '603-01', districtId: '603', name: 'Royapuram (Ward 48)', sanitationScore: 28, waterSourceType: 'tanker', populationDensity: 26500 },
  { villageId: '603-02', districtId: '603', name: 'T. Nagar (Ward 113)', sanitationScore: 52, waterSourceType: 'piped', populationDensity: 19800 },
  { villageId: '603-03', districtId: '603', name: 'Mylapore (Ward 125)', sanitationScore: 78, waterSourceType: 'piped', populationDensity: 15400 },
  { villageId: '603-04', districtId: '603', name: 'Kodambakkam (Ward 131)', sanitationScore: 48, waterSourceType: 'piped', populationDensity: 18200 },
  { villageId: '603-05', districtId: '603', name: 'Velachery (Ward 177)', sanitationScore: 65, waterSourceType: 'piped', populationDensity: 12100 },
  { villageId: '603-06', districtId: '603', name: 'Anna Nagar (Ward 101)', sanitationScore: 88, waterSourceType: 'piped', populationDensity: 11000 },

  // Madurai (623)
  { villageId: '623-01', districtId: '623', name: 'Melur North', sanitationScore: 32, waterSourceType: 'canal', populationDensity: 4200 },
  { villageId: '623-02', districtId: '623', name: 'Alanganallur', sanitationScore: 45, waterSourceType: 'open_well', populationDensity: 3100 },
  { villageId: '623-03', districtId: '623', name: 'Vadipatti Rural', sanitationScore: 48, waterSourceType: 'borewell', populationDensity: 2800 },
  { villageId: '623-04', districtId: '623', name: 'Usilampatti East', sanitationScore: 70, waterSourceType: 'borewell', populationDensity: 2100 },
  { villageId: '623-05', districtId: '623', name: 'Tirumangalam', sanitationScore: 68, waterSourceType: 'piped', populationDensity: 3800 },
  { villageId: '623-06', districtId: '623', name: 'Sholavandan', sanitationScore: 82, waterSourceType: 'piped', populationDensity: 1900 },

  // Coimbatore (632)
  { villageId: '632-01', districtId: '632', name: 'Pollachi Rural', sanitationScore: 38, waterSourceType: 'canal', populationDensity: 3400 },
  { villageId: '632-02', districtId: '632', name: 'Mettupalayam West', sanitationScore: 50, waterSourceType: 'borewell', populationDensity: 3900 },
  { villageId: '632-03', districtId: '632', name: 'Sulur Block', sanitationScore: 76, waterSourceType: 'piped', populationDensity: 4100 },
  { villageId: '632-04', districtId: '632', name: 'Annur', sanitationScore: 80, waterSourceType: 'borewell', populationDensity: 2200 },
  { villageId: '632-05', districtId: '632', name: 'Valparai High Forest', sanitationScore: 85, waterSourceType: 'piped', populationDensity: 650 },
  { villageId: '632-06', districtId: '632', name: 'Kinathukadavu', sanitationScore: 74, waterSourceType: 'borewell', populationDensity: 1800 },

  // Salem (608)
  { villageId: '608-01', districtId: '608', name: 'Attur East Block', sanitationScore: 30, waterSourceType: 'open_well', populationDensity: 3600 },
  { villageId: '608-02', districtId: '608', name: 'Omalur Rural', sanitationScore: 46, waterSourceType: 'borewell', populationDensity: 3200 },
  { villageId: '608-03', districtId: '608', name: 'Mettur Dam Environs', sanitationScore: 52, waterSourceType: 'canal', populationDensity: 2900 },
  { villageId: '608-04', districtId: '608', name: 'Yercaud Foothills', sanitationScore: 75, waterSourceType: 'borewell', populationDensity: 1100 },
  { villageId: '608-05', districtId: '608', name: 'Sankari', sanitationScore: 72, waterSourceType: 'piped', populationDensity: 2700 },
  { villageId: '608-06', districtId: '608', name: 'Edappadi Town Edge', sanitationScore: 70, waterSourceType: 'borewell', populationDensity: 3100 },

  // Thanjavur (620)
  { villageId: '620-01', districtId: '620', name: 'Kumbakonam Rural', sanitationScore: 34, waterSourceType: 'canal', populationDensity: 4800 },
  { villageId: '620-02', districtId: '620', name: 'Pattukkottai Coastal', sanitationScore: 50, waterSourceType: 'open_well', populationDensity: 2900 },
  { villageId: '620-03', districtId: '620', name: 'Thiruvaiyaru Valley', sanitationScore: 78, waterSourceType: 'canal', populationDensity: 2100 },
  { villageId: '620-04', districtId: '620', name: 'Orathanadu', sanitationScore: 82, waterSourceType: 'borewell', populationDensity: 1800 },
  { villageId: '620-05', districtId: '620', name: 'Papanasam', sanitationScore: 74, waterSourceType: 'piped', populationDensity: 2400 },

  // The Nilgiris (611)
  { villageId: '611-01', districtId: '611', name: 'Gudalur Lowland Sector', sanitationScore: 40, waterSourceType: 'open_well', populationDensity: 1400 },
  { villageId: '611-02', districtId: '611', name: 'Coonoor Foothills', sanitationScore: 60, waterSourceType: 'piped', populationDensity: 1800 },
  { villageId: '611-03', districtId: '611', name: 'Kotagiri Rural', sanitationScore: 84, waterSourceType: 'piped', populationDensity: 950 },
  { villageId: '611-04', districtId: '611', name: 'Kundah Hydel Zone', sanitationScore: 90, waterSourceType: 'piped', populationDensity: 480 },
  { villageId: '611-05', districtId: '611', name: 'Ooty Rural Outskirts', sanitationScore: 92, waterSourceType: 'piped', populationDensity: 820 },

  // Erode (610)
  { villageId: '610-01', districtId: '610', name: 'Bhavani Riverbank', sanitationScore: 29, waterSourceType: 'canal', populationDensity: 4600 },
  { villageId: '610-02', districtId: '610', name: 'Gobichettipalayam East', sanitationScore: 48, waterSourceType: 'canal', populationDensity: 3500 },
  { villageId: '610-03', districtId: '610', name: 'Perundurai Agro Belt', sanitationScore: 55, waterSourceType: 'borewell', populationDensity: 2800 },
  { villageId: '610-04', districtId: '610', name: 'Sathyamangalam Foothills', sanitationScore: 75, waterSourceType: 'borewell', populationDensity: 1600 },
  { villageId: '610-05', districtId: '610', name: 'Anthiyur Lake Zone', sanitationScore: 78, waterSourceType: 'open_well', populationDensity: 2100 },

  // Tirunelveli (628)
  { villageId: '628-01', districtId: '628', name: 'Ambasamudram Canal Zone', sanitationScore: 26, waterSourceType: 'canal', populationDensity: 5100 },
  { villageId: '628-02', districtId: '628', name: 'Cheranmahadevi', sanitationScore: 46, waterSourceType: 'open_well', populationDensity: 3300 },
  { villageId: '628-03', districtId: '628', name: 'Nanguneri Rural', sanitationScore: 54, waterSourceType: 'borewell', populationDensity: 2400 },
  { villageId: '628-04', districtId: '628', name: 'Radhapuram', sanitationScore: 80, waterSourceType: 'piped', populationDensity: 1900 },
  { villageId: '628-05', districtId: '628', name: 'Palayamkottai Outskirts', sanitationScore: 82, waterSourceType: 'piped', populationDensity: 2700 },
];

// ── Daily Records Generator (84 days = 12 historical weeks) ─

function generateSeededDailyRecords(): DailyRecord[] {
  const records: DailyRecord[] = [];
  const startDate = new Date('2026-06-01T00:00:00Z');

  // Specific critical outbreak villages to spike
  const criticalSpikeVillages = new Set([
    '603-01', // Royapuram
    '623-01', // Melur North
    '632-01', // Pollachi Rural
    '608-01', // Attur East
    '620-01', // Kumbakonam Rural
    '611-01', // Gudalur Lowland
    '610-01', // Bhavani Riverbank
    '628-01', // Ambasamudram
  ]);

  const elevatedVillages = new Set([
    '603-02', '603-04',
    '623-02', '623-03',
    '632-02',
    '608-02', '608-03',
    '620-02',
    '611-02',
    '610-02', '610-03',
    '628-02', '628-03',
  ]);

  for (const village of villageProfiles) {
    const isCritical = criticalSpikeVillages.has(village.villageId);
    const isElevated = elevatedVillages.has(village.villageId);

    // Deterministic pseudo-random seed based on villageId chars
    let seed = village.villageId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const pseudoRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    for (let day = 0; day < 84; day++) {
      const currentDate = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
      const dateStr = currentDate.toISOString().split('T')[0];
      const weekIndex = Math.floor(day / 7); // 0 to 11

      // Base environmental patterns
      let rainfallMm = Math.floor(pseudoRandom() * 12);
      let gatheringFlag = (day % 7 === 5 || day % 14 === 0) ? 1 : 0;
      let caseCount = 0;

      // Base daily cases per village profile
      const randVal = pseudoRandom();
      if (randVal > 0.75) {
        caseCount = 1;
      }

      if (isCritical) {
        // Normal baseline for first 9 weeks (days 0–62): weekly total ~2-4 (daily 0-1)
        // Severe rainfall event in week 10 (days 63–69): rainfall 45-85mm + gathering
        // Case spike in week 11 & 12 (days 70–83): daily cases 1-3, weekly total 12-15 (3.5x-4x baseline!)
        if (day >= 63 && day < 70) {
          rainfallMm = 45 + Math.floor(pseudoRandom() * 45); // heavy monsoon burst
          gatheringFlag = (day % 3 === 0) ? 1 : 0;
          caseCount = (pseudoRandom() > 0.4) ? 1 : 0;
        } else if (day >= 70 && day < 77) {
          // Week 11 spike
          rainfallMm = 20 + Math.floor(pseudoRandom() * 25);
          caseCount = 1 + Math.floor(pseudoRandom() * 2); // 1-2 daily
        } else if (day >= 77) {
          // Week 12 acute peak
          rainfallMm = 15 + Math.floor(pseudoRandom() * 20);
          caseCount = 1 + Math.floor(pseudoRandom() * 3); // 1-3 daily (weekly sum ~13-15)
        }
      } else if (isElevated) {
        // Moderate rainfall in week 10, mild case uptick in weeks 11-12 (weekly ~5-7)
        if (day >= 65 && day < 72) {
          rainfallMm = 25 + Math.floor(pseudoRandom() * 30);
        }
        if (day >= 70) {
          caseCount = (pseudoRandom() > 0.35) ? 1 : 0;
          if (day % 3 === 0) caseCount = 2;
        }
      } else {
        // Normal village: steady low counts, dry-day adherence, minimal rain
        if (day >= 65 && day < 72) {
          rainfallMm = 5 + Math.floor(pseudoRandom() * 15);
        }
        caseCount = (pseudoRandom() > 0.8) ? 1 : 0;
      }

      records.push({
        villageId: village.villageId,
        date: dateStr,
        symptom: 'acute_febrile_rash',
        caseCount,
        rainfallMm,
        gatheringFlag,
      });
    }
  }

  return records;
}

export const dailyRecords: DailyRecord[] = generateSeededDailyRecords();

// ── Export helpers ──────────────────────────────────────────

export function getVillageProfile(villageId: string): VillageProfile | undefined {
  return villageProfiles.find((v) => v.villageId === villageId);
}

export function getDailyRecordsForVillage(villageId: string): DailyRecord[] {
  return dailyRecords.filter((r) => r.villageId === villageId);
}
