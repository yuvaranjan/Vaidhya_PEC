#!/usr/bin/env node
import { createHash } from "node:crypto";

const baseUrl = (process.env.ACTIAN_VECTORAI_URL || process.env.ACTIAN_VECTORAI_REST_URL || "http://localhost:6573").replace(/\/$/, "");
const token = process.env.ACTIAN_VECTORAI_TOKEN || process.env.ACTIAN_VECTORAI_API_KEY || "";
const prefix = process.env.ACTIAN_VECTORAI_COLLECTION_PREFIX || "vaidhya_";
const dimension = Number(process.env.ACTIAN_VECTORAI_DIMENSION || 8);
const UUID_V5_NAMESPACE_URL = "6ba7b8119dad11d180b400c04fd430c8";

const headers = { "Content-Type": "application/json" };
if (token) {
  headers.Authorization = `Bearer ${token}`;
  headers["api-key"] = token;
}

const primaryKeys = {
  jurisdictions: "jurisdiction_id",
  patients: "patient_id",
  doctors: "doctor_id",
  visits: "visit_id",
  vitals_readings: "reading_id",
  diagnostic_reports: "report_id",
  branching_rules: "rule_id",
  pharmacies: "pharmacy_id",
  stock_items: "stock_item_id",
  regional_case_counts: "row_id",
};

function stockStatus(quantity) {
  if (quantity === 0) return "out_of_stock";
  if (quantity < 10) return "low";
  return "in_stock";
}

function hashVector(seed) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i += 1) {
    h1 ^= seed.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= h1 >>> 7;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return Array.from({ length: dimension }, (_, i) => {
    const mixed = Math.imul(h1 ^ (i * 0x9e3779b1), h2 || 1);
    return ((mixed >>> 0) / 0xffffffff) * 2 - 1;
  });
}

function uuidV5(name) {
  const hash = createHash("sha1")
    .update(Buffer.from(UUID_V5_NAMESPACE_URL, "hex"))
    .update(`vaidhya:${name}`)
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));

  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function pointId(table, id) {
  return uuidV5(`${table}:${id}`);
}

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok && response.status !== 409) {
    const detail = body?.status?.error || body?.error || response.statusText;
    throw new Error(`${response.status} ${detail}`);
  }
  return body;
}

async function ensureCollection(table) {
  await request(`/collections/${encodeURIComponent(prefix + table)}`, {
    method: "PUT",
    body: JSON.stringify({ vectors: { size: dimension, distance: "Cosine" } }),
  });
}

function normalizeRow(table, row) {
  const next = { ...row };
  if (table === "stock_items") next.status = stockStatus(next.quantity);
  if (table === "regional_case_counts") {
    next.row_id = `${next.region_id}:${next.disease_category}:${next.week_start_date}`;
  }
  return next;
}

async function upsertRows(table, rows) {
  await ensureCollection(table);
  const pk = primaryKeys[table];
  const points = rows.map((row) => {
    const payload = normalizeRow(table, row);
    const id = String(payload[pk]);
    return { id: pointId(table, id), vector: hashVector(`${table}:${id}`), payload };
  });

  for (let start = 0; start < points.length; start += 128) {
    await request(`/collections/${encodeURIComponent(prefix + table)}/points?wait=true`, {
      method: "PUT",
      body: JSON.stringify({ points: points.slice(start, start + 128) }),
    });
  }
  console.log(`seeded ${String(rows.length).padStart(3, " ")} ${table}`);
}

const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60 * 1000).toISOString();
const now = () => new Date().toISOString();

const seed = {
  jurisdictions: [
    { jurisdiction_id: "jur_thrissur_01", name: "Thrissur Rural PHC", latitude: 10.5276, longitude: 76.2144, edge_server_id: "edge_node_a" },
    { jurisdiction_id: "jur_palakkad_01", name: "Palakkad Rural PHC", latitude: 10.7867, longitude: 76.6548, edge_server_id: "edge_node_b" },
  ],
  patients: [
    { patient_id: "pat_001", abha_id: "12-3456-7890-0001", phone_number: "9000000001", name: "Anjali Menon", dob: "1991-03-14", age: 34, sex: "F", home_jurisdiction_id: "jur_thrissur_01", created_at: now() },
    { patient_id: "pat_002", abha_id: "12-3456-7890-0002", phone_number: "9000000002", name: "Rajesh Kumar", dob: "1978-11-02", age: 47, sex: "M", home_jurisdiction_id: "jur_thrissur_01", created_at: now() },
    { patient_id: "pat_003", abha_id: "12-3456-7890-0003", phone_number: "9000000003", name: "Fathima Beevi", dob: "1958-06-21", age: 67, sex: "F", home_jurisdiction_id: "jur_thrissur_01", created_at: now() },
    { patient_id: "pat_004", abha_id: "12-3456-7890-0004", phone_number: "9000000004", name: "Suresh Nair", dob: "2001-01-09", age: 24, sex: "M", home_jurisdiction_id: "jur_palakkad_01", created_at: now() },
  ],
  doctors: [
    { doctor_id: "doc_001", name: "Dr. Priya Varghese", specialty_general: "MBBS", phone_number: "9100000001", password_hash: "$2b$10$dD3THRMHmk6E20KHvL2fBOPiE3BaRgv/zo1pwiO3xDHRXxyTgrys6", serves_jurisdiction_ids: ["jur_thrissur_01", "jur_palakkad_01"] },
    { doctor_id: "doc_002", name: "Dr. Arun Krishnan", specialty_general: "MBBS", phone_number: "9100000002", password_hash: "$2b$10$dD3THRMHmk6E20KHvL2fBOPiE3BaRgv/zo1pwiO3xDHRXxyTgrys6", serves_jurisdiction_ids: ["jur_thrissur_01", "jur_palakkad_01"] },
  ],
  branching_rules: [
    { rule_id: "rule_spo2_low", trigger_vital_or_finding: "spo2", condition: "<92", question_branch_tags: ["respiratory"], urgency_flag: true, description_template: "low SpO2 ({value}%)", active: true },
    { rule_id: "rule_spo2_critical", trigger_vital_or_finding: "spo2", condition: "<88", question_branch_tags: ["respiratory", "emergency"], urgency_flag: true, description_template: "critically low SpO2 ({value}%)", active: true },
    { rule_id: "rule_fever_high", trigger_vital_or_finding: "temperature", condition: ">=38.5", question_branch_tags: ["infection"], urgency_flag: true, description_template: "high fever ({value} C)", active: true },
    { rule_id: "rule_tachycardia", trigger_vital_or_finding: "pulse", condition: ">=110", question_branch_tags: ["cardiac"], urgency_flag: true, description_template: "tachycardia ({value} bpm)", active: true },
    { rule_id: "rule_bradycardia", trigger_vital_or_finding: "pulse", condition: "<50", question_branch_tags: ["cardiac"], urgency_flag: true, description_template: "bradycardia ({value} bpm)", active: true },
    { rule_id: "rule_tachypnea", trigger_vital_or_finding: "respiratory_rate", condition: ">=24", question_branch_tags: ["respiratory"], urgency_flag: true, description_template: "raised respiratory rate ({value}/min)", active: true },
    { rule_id: "rule_rebound_tenderness", trigger_vital_or_finding: "rebound_tenderness", condition: "==true", question_branch_tags: ["abdominal", "surgical"], urgency_flag: true, description_template: "rebound tenderness present", active: true },
  ],
  pharmacies: [
    { pharmacy_id: "pha_001", name: "Amala Medicals", location: "Thrissur Town", phone_number: "9200000001", jurisdiction_id: "jur_thrissur_01", latitude: 10.531, longitude: 76.218 },
    { pharmacy_id: "pha_002", name: "Devi Pharmacy", location: "Ollur", phone_number: "9200000002", jurisdiction_id: "jur_thrissur_01", latitude: 10.482, longitude: 76.251 },
    { pharmacy_id: "pha_003", name: "Kerala Medical Store", location: "Chalakudy", phone_number: "9200000003", jurisdiction_id: "jur_thrissur_01", latitude: 10.308, longitude: 76.335 },
  ],
  stock_items: [
    { stock_item_id: "stk_001", pharmacy_id: "pha_001", medicine_name: "Paracetamol 500mg", quantity: 0 },
    { stock_item_id: "stk_002", pharmacy_id: "pha_001", medicine_name: "Amoxicillin 500mg", quantity: 45 },
    { stock_item_id: "stk_003", pharmacy_id: "pha_001", medicine_name: "ORS Sachet", quantity: 120 },
    { stock_item_id: "stk_004", pharmacy_id: "pha_002", medicine_name: "Paracetamol 500mg", quantity: 80 },
    { stock_item_id: "stk_005", pharmacy_id: "pha_002", medicine_name: "Amoxicillin 500mg", quantity: 6 },
    { stock_item_id: "stk_006", pharmacy_id: "pha_002", medicine_name: "ORS Sachet", quantity: 60 },
    { stock_item_id: "stk_007", pharmacy_id: "pha_003", medicine_name: "Paracetamol 500mg", quantity: 200 },
    { stock_item_id: "stk_008", pharmacy_id: "pha_003", medicine_name: "Amoxicillin 500mg", quantity: 30 },
    { stock_item_id: "stk_009", pharmacy_id: "pha_003", medicine_name: "ORS Sachet", quantity: 15 },
    { stock_item_id: "stk_010", pharmacy_id: "pha_003", medicine_name: "Pantoprazole 40mg", quantity: 25 },
  ],
  visits: [
    { visit_id: "vis_seed_001", patient_id: "pat_001", edge_jurisdiction_id: "jur_thrissur_01", status: "awaiting_doctor", language: "ml", created_at: minutesAgo(12) },
    { visit_id: "vis_seed_002", patient_id: "pat_002", edge_jurisdiction_id: "jur_thrissur_01", status: "awaiting_doctor", language: "ml", created_at: minutesAgo(7) },
    { visit_id: "vis_seed_003", patient_id: "pat_003", edge_jurisdiction_id: "jur_thrissur_01", status: "awaiting_doctor", language: "ta", created_at: minutesAgo(3) },
  ],
  vitals_readings: [
    { reading_id: "rd_001", visit_id: "vis_seed_001", type: "temperature", phase: "pass_one_baseline", value_numeric: 38.1, entered_at: now(), status: "entered" },
    { reading_id: "rd_002", visit_id: "vis_seed_001", type: "blood_pressure", phase: "pass_one_baseline", value_text: "118/76", entered_at: now(), status: "entered" },
    { reading_id: "rd_003", visit_id: "vis_seed_001", type: "pulse", phase: "pass_one_baseline", value_numeric: 96, entered_at: now(), status: "entered" },
    { reading_id: "rd_004", visit_id: "vis_seed_001", type: "spo2", phase: "pass_one_baseline", value_numeric: 97, entered_at: now(), status: "entered" },
    { reading_id: "rd_005", visit_id: "vis_seed_001", type: "respiratory_rate", phase: "pass_one_baseline", value_numeric: 18, entered_at: now(), status: "entered" },
    { reading_id: "rd_006", visit_id: "vis_seed_002", type: "temperature", phase: "pass_one_baseline", value_numeric: 37.2, entered_at: now(), status: "entered" },
    { reading_id: "rd_007", visit_id: "vis_seed_002", type: "spo2", phase: "pass_one_baseline", value_numeric: 89, entered_at: now(), status: "entered" },
    { reading_id: "rd_008", visit_id: "vis_seed_002", type: "respiratory_rate", phase: "pass_one_baseline", value_numeric: 26, entered_at: now(), status: "entered" },
    { reading_id: "rd_009", visit_id: "vis_seed_003", type: "temperature", phase: "pass_one_baseline", value_numeric: 36.9, entered_at: now(), status: "entered" },
    { reading_id: "rd_010", visit_id: "vis_seed_003", type: "spo2", phase: "pass_one_baseline", value_numeric: 98, entered_at: now(), status: "entered" },
  ],
  diagnostic_reports: [
    { report_id: "rpt_seed_001", visit_id: "vis_seed_001", transcript: [{ speaker: "patient", text: "stomach pain for two days", text_native: "stomach pain for two days" }], vitals_snapshot: [{ type: "temperature", value: 38.1 }, { type: "blood_pressure", value: "118/76" }, { type: "pulse", value: 96 }, { type: "spo2", value: 97 }, { type: "respiratory_rate", value: 18 }], urgency_tier: { tier: "urgent", flags: [{ rule_id: "rule_rebound_tenderness", description: "rebound tenderness present" }, { rule_id: "rule_fever_high", description: "high fever (38.1 C)" }], flag_count: 2 }, chief_complaint: "Right lower quadrant abdominal pain, 2 days", summary_text: "34-year-old woman with two days of abdominal pain that migrated to the right lower quadrant. Mild fever and loss of appetite are present. Nurse examination reports rebound tenderness. Presentation is consistent with possible acute appendicitis; surgical review advised.", generated_at: now() },
    { report_id: "rpt_seed_002", visit_id: "vis_seed_002", transcript: [{ speaker: "patient", text: "breathless for three days, cough at night", text_native: "breathless for three days, cough at night" }], vitals_snapshot: [{ type: "temperature", value: 37.2 }, { type: "spo2", value: 89 }, { type: "respiratory_rate", value: 26 }], urgency_tier: { tier: "urgent", flags: [{ rule_id: "rule_spo2_low", description: "low SpO2 (89%)" }, { rule_id: "rule_tachypnea", description: "raised respiratory rate (26/min)" }], flag_count: 2 }, chief_complaint: "Breathlessness and nocturnal cough, 3 days", summary_text: "47-year-old man with three days of progressive breathlessness and dry nocturnal cough. SpO2 is 89% on room air with respiratory rate 26/min. Hypoxia with tachypnoea requires prompt assessment.", generated_at: now() },
    { report_id: "rpt_seed_003", visit_id: "vis_seed_003", transcript: [{ speaker: "patient", text: "headache for a week", text_native: "headache for a week" }], vitals_snapshot: [{ type: "temperature", value: 36.9 }, { type: "spo2", value: 98 }], urgency_tier: { tier: "routine", flags: [], flag_count: 0 }, chief_complaint: "Headache, one week", summary_text: "67-year-old woman with a one-week bilateral dull headache, worse in the evenings and partially relieved by rest. No visual disturbance, vomiting, weakness, or numbness reported. Vitals are within normal limits. Blood pressure review and medication adherence check advised.", generated_at: now() },
  ],
};

function generateRegionalCaseCounts() {
  const regions = [["reg_thrissur", 0, 1.0], ["reg_palakkad", 1, 0.9], ["reg_ernakulam", 2, 1.3], ["reg_kozhikode", 3, 1.1], ["reg_malappuram", 4, 1.2], ["reg_kannur", 5, 0.8], ["reg_kollam", 6, 0.95], ["reg_alappuzha", 7, 1.05], ["reg_kottayam", 8, 0.85], ["reg_wayanad", 9, 0.6]];
  const diseases = [["respiratory_infection", 0, 20, 4], ["diarrheal_disease", 1, 12, 3], ["dengue", 2, 8, 2], ["hypertension_related", 3, 15, 2]];
  const baseDate = new Date("2026-08-03T00:00:00.000Z");
  const rows = [];

  for (const [regionId, regionIdx, multiplier] of regions) {
    for (const [disease, diseaseIdx, baseCount, amplitude] of diseases) {
      const counts = [];
      for (let week = 1; week <= 26; week += 1) {
        const seasonal = amplitude * Math.sin((week / 26) * 2 * Math.PI);
        const jitter = ((regionIdx * 7 + diseaseIdx * 13 + week * 3) % 3) - 1;
        let count = Math.max(1, Math.round(baseCount * multiplier + seasonal + jitter));
        const baseline = counts.length ? counts.slice(Math.max(0, counts.length - 4)).reduce((sum, value) => sum + value, 0) / Math.min(4, counts.length) : null;
        if (regionId === "reg_kozhikode" && disease === "dengue" && week === 19) {
          count = Math.round((baseline || count) * 3.5);
        }
        counts.push(count);
        const rolling = counts.length > 1 ? counts.slice(Math.max(0, counts.length - 5), counts.length - 1).reduce((sum, value) => sum + value, 0) / Math.min(4, counts.length - 1) : null;
        const date = new Date(baseDate);
        date.setUTCDate(baseDate.getUTCDate() - (26 - week) * 7);
        rows.push({ region_id: regionId, disease_category: disease, week_start_date: date.toISOString().slice(0, 10), case_count: count, rolling_baseline: rolling, is_anomaly: rolling != null ? count > 2 * rolling : false });
      }
    }
  }
  return rows;
}

seed.regional_case_counts = generateRegionalCaseCounts();

for (const [table, rows] of Object.entries(seed)) {
  await upsertRows(table, rows);
}

console.log(`Actian VectorAI DB seed complete at ${baseUrl}`);
