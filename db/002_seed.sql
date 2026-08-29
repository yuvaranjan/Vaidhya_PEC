-- Project Vaidhya — demo seed.
-- Run after 001_schema.sql. Idempotent: re-running it overwrites, never errors.
--
-- OWNER: T4. This is the starter set that unblocks everyone on hour 1 —
-- login accounts for all lanes, rules the engine can actually fire, one
-- pharmacy deliberately out of stock, and three fake diagnostic reports so T2
-- can build the doctor queue before T1's pipeline exists.
--
-- Doctor / pharmacist password for every seeded account: vaidhya123

-- =====================================================================
-- Jurisdictions
-- =====================================================================

insert into jurisdictions (jurisdiction_id, name, latitude, longitude, edge_server_id) values
  ('jur_thrissur_01', 'Thrissur Rural PHC',  10.5276, 76.2144, 'edge_node_a'),
  ('jur_palakkad_01', 'Palakkad Rural PHC',  10.7867, 76.6548, 'edge_node_b')
on conflict (jurisdiction_id) do update set name = excluded.name;

-- =====================================================================
-- Patients — login is phone + OTP 123456
-- =====================================================================

insert into patients (patient_id, abha_id, phone_number, name, dob, age, sex, home_jurisdiction_id) values
  ('pat_001', '12-3456-7890-0001', '9000000001', 'Anjali Menon',   '1991-03-14', 34, 'F', 'jur_thrissur_01'),
  ('pat_002', '12-3456-7890-0002', '9000000002', 'Rajesh Kumar',   '1978-11-02', 47, 'M', 'jur_thrissur_01'),
  ('pat_003', '12-3456-7890-0003', '9000000003', 'Fathima Beevi',  '1958-06-21', 67, 'F', 'jur_thrissur_01'),
  ('pat_004', '12-3456-7890-0004', '9000000004', 'Suresh Nair',    '2001-01-09', 24, 'M', 'jur_palakkad_01')
on conflict (patient_id) do update set name = excluded.name;

-- =====================================================================
-- Doctors — phone + password (vaidhya123)
-- Every doctor serves every jurisdiction, deliberately: an empty queue on
-- stage is a worse failure than an unrealistic catchment area.
-- =====================================================================

insert into doctors (doctor_id, name, specialty_general, phone_number, password_hash, serves_jurisdiction_ids) values
  ('doc_001', 'Dr. Priya Varghese', 'MBBS', '9100000001',
   '$2b$10$dD3THRMHmk6E20KHvL2fBOPiE3BaRgv/zo1pwiO3xDHRXxyTgrys6',
   '{jur_thrissur_01,jur_palakkad_01}'),
  ('doc_002', 'Dr. Arun Krishnan',  'MBBS', '9100000002',
   '$2b$10$dD3THRMHmk6E20KHvL2fBOPiE3BaRgv/zo1pwiO3xDHRXxyTgrys6',
   '{jur_thrissur_01,jur_palakkad_01}')
on conflict (doctor_id) do update set password_hash = excluded.password_hash;

-- =====================================================================
-- Branching rules — condition strings are parsed, never eval'd
-- =====================================================================

insert into branching_rules (rule_id, trigger_vital_or_finding, condition, question_branch_tags, urgency_flag, description_template) values
  ('rule_spo2_low',           'spo2',                '<92',    '{respiratory}',            true,  'low SpO2 ({value}%)'),
  ('rule_spo2_critical',      'spo2',                '<88',    '{respiratory,emergency}',  true,  'critically low SpO2 ({value}%)'),
  ('rule_fever_high',         'temperature',         '>=38.5', '{infection}',              true,  'high fever ({value}°C)'),
  ('rule_tachycardia',        'pulse',               '>=110',  '{cardiac}',                true,  'tachycardia ({value} bpm)'),
  ('rule_bradycardia',        'pulse',               '<50',    '{cardiac}',                true,  'bradycardia ({value} bpm)'),
  ('rule_tachypnea',          'respiratory_rate',    '>=24',   '{respiratory}',            true,  'raised respiratory rate ({value}/min)'),
  ('rule_rebound_tenderness', 'rebound_tenderness',  '==true', '{abdominal,surgical}',     true,  'rebound tenderness present')
on conflict (rule_id) do update set condition = excluded.condition;

-- =====================================================================
-- Pharmacies + stock (T3)
-- Paracetamol is OUT OF STOCK at Amala — that gap is the point of the
-- "which pharmacy actually has all of it" screen. Do not quietly fix it.
-- =====================================================================

insert into pharmacies (pharmacy_id, name, location, phone_number, jurisdiction_id, latitude, longitude) values
  ('pha_001', 'Amala Medicals',      'Thrissur Town',    '9200000001', 'jur_thrissur_01', 10.5310, 76.2180),
  ('pha_002', 'Devi Pharmacy',       'Ollur',            '9200000002', 'jur_thrissur_01', 10.4820, 76.2510),
  ('pha_003', 'Kerala Medical Store','Chalakudy',        '9200000003', 'jur_thrissur_01', 10.3080, 76.3350)
on conflict (pharmacy_id) do update set name = excluded.name;

insert into stock_items (stock_item_id, pharmacy_id, medicine_name, quantity) values
  ('stk_001', 'pha_001', 'Paracetamol 500mg',   0),    -- out of stock, on purpose
  ('stk_002', 'pha_001', 'Amoxicillin 500mg',   45),
  ('stk_003', 'pha_001', 'ORS Sachet',          120),
  ('stk_004', 'pha_002', 'Paracetamol 500mg',   80),
  ('stk_005', 'pha_002', 'Amoxicillin 500mg',   6),    -- low
  ('stk_006', 'pha_002', 'ORS Sachet',          60),
  ('stk_007', 'pha_003', 'Paracetamol 500mg',   200),
  ('stk_008', 'pha_003', 'Amoxicillin 500mg',   30),
  ('stk_009', 'pha_003', 'ORS Sachet',          15),
  ('stk_010', 'pha_003', 'Pantoprazole 40mg',   25)
on conflict (stock_item_id) do update set quantity = excluded.quantity;

-- =====================================================================
-- Three ready-made visits in the doctor queue.
-- T4 task 1: this unblocks T2's queue and consult screens on hour 1,
-- long before T1's pipeline can produce a real report.
-- =====================================================================

insert into visits (visit_id, patient_id, edge_jurisdiction_id, status, language, created_at) values
  ('vis_seed_001', 'pat_001', 'jur_thrissur_01', 'awaiting_doctor', 'ml', now() - interval '12 minutes'),
  ('vis_seed_002', 'pat_002', 'jur_thrissur_01', 'awaiting_doctor', 'ml', now() - interval '7 minutes'),
  ('vis_seed_003', 'pat_003', 'jur_thrissur_01', 'awaiting_doctor', 'ta', now() - interval '3 minutes')
on conflict (visit_id) do update set status = excluded.status;

insert into vitals_readings (reading_id, visit_id, type, phase, value_numeric, value_text, entered_at) values
  ('rd_001', 'vis_seed_001', 'temperature',      'pass_one_baseline', 38.1, null,     now()),
  ('rd_002', 'vis_seed_001', 'blood_pressure',   'pass_one_baseline', null, '118/76', now()),
  ('rd_003', 'vis_seed_001', 'pulse',            'pass_one_baseline', 96,   null,     now()),
  ('rd_004', 'vis_seed_001', 'spo2',             'pass_one_baseline', 97,   null,     now()),
  ('rd_005', 'vis_seed_001', 'respiratory_rate', 'pass_one_baseline', 18,   null,     now()),
  ('rd_006', 'vis_seed_002', 'temperature',      'pass_one_baseline', 37.2, null,     now()),
  ('rd_007', 'vis_seed_002', 'spo2',             'pass_one_baseline', 89,   null,     now()),
  ('rd_008', 'vis_seed_002', 'respiratory_rate', 'pass_one_baseline', 26,   null,     now()),
  ('rd_009', 'vis_seed_003', 'temperature',      'pass_one_baseline', 36.9, null,     now()),
  ('rd_010', 'vis_seed_003', 'spo2',             'pass_one_baseline', 98,   null,     now())
on conflict (reading_id) do nothing;

insert into diagnostic_reports
  (report_id, visit_id, transcript, vitals_snapshot, urgency_tier, chief_complaint, summary_text) values
  ('rpt_seed_001', 'vis_seed_001',
   '[{"speaker":"bot","text":"What brings you in today?","text_native":"എന്താണ് പ്രശ്നം?"},
     {"speaker":"patient","text":"stomach pain for two days","text_native":"വയറുവേദന രണ്ട് ദിവസമായി"},
     {"speaker":"bot","text":"Has the pain moved to the lower right side?","text_native":"വേദന വലതു വശത്തേക്ക് മാറിയോ?"},
     {"speaker":"patient","text":"yes, since yesterday","text_native":"അതെ, ഇന്നലെ മുതൽ"}]',
   '[{"type":"temperature","value":38.1},{"type":"blood_pressure","value":"118/76"},
     {"type":"pulse","value":96},{"type":"spo2","value":97},{"type":"respiratory_rate","value":18}]',
   '{"tier":"urgent","flags":[{"rule_id":"rule_rebound_tenderness","description":"rebound tenderness present"},
     {"rule_id":"rule_fever_high","description":"high fever (38.1°C)"}],"flag_count":2}',
   'Right lower quadrant abdominal pain, 2 days',
   '34-year-old woman with two days of abdominal pain that began periumbilically and migrated to the right lower quadrant. Mild fever and loss of appetite. Nurse examination reports rebound tenderness on release. Vitals: temperature 38.1°C, BP 118/76, pulse 96, SpO2 97%, respiratory rate 18. No vomiting, no urinary symptoms, no prior abdominal surgery. Presentation is consistent with possible acute appendicitis; surgical review advised.'),

  ('rpt_seed_002', 'vis_seed_002',
   '[{"speaker":"bot","text":"What brings you in today?","text_native":"എന്താണ് പ്രശ്നം?"},
     {"speaker":"patient","text":"breathless for three days, cough at night","text_native":"മൂന്ന് ദിവസമായി ശ്വാസംമുട്ടൽ"}]',
   '[{"type":"temperature","value":37.2},{"type":"spo2","value":89},{"type":"respiratory_rate","value":26}]',
   '{"tier":"urgent","flags":[{"rule_id":"rule_spo2_low","description":"low SpO2 (89%)"},
     {"rule_id":"rule_tachypnea","description":"raised respiratory rate (26/min)"}],"flag_count":2}',
   'Breathlessness and nocturnal cough, 3 days',
   '47-year-old man with three days of progressive breathlessness and a dry nocturnal cough. Reports difficulty completing a sentence without pausing. Vitals: SpO2 89% on room air, respiratory rate 26/min, temperature 37.2°C. No chest pain, no leg swelling, no known cardiac history. Twelve-year history of biomass cooking-fuel exposure. Hypoxia with tachypnoea; requires prompt assessment.'),

  ('rpt_seed_003', 'vis_seed_003',
   '[{"speaker":"bot","text":"What brings you in today?","text_native":"என்ன பிரச்சனை?"},
     {"speaker":"patient","text":"headache for a week","text_native":"ஒரு வாரமாக தலைவலி"}]',
   '[{"type":"temperature","value":36.9},{"type":"spo2","value":98}]',
   '{"tier":"routine","flags":[],"flag_count":0}',
   'Headache, one week',
   '67-year-old woman with a one-week history of bilateral dull headache, worse in the evenings, partially relieved by rest. No visual disturbance, no vomiting, no weakness or numbness. Vitals within normal limits: temperature 36.9°C, SpO2 98%. Takes amlodipine for hypertension, adherence uncertain over the last month. Likely tension-type headache; blood pressure review and medication adherence check advised.')
on conflict (report_id) do update set summary_text = excluded.summary_text;

-- =====================================================================
-- Translation cache — pure optimisation. A cache miss is normal, not an
-- error, and the system is correct with this table completely empty.
-- =====================================================================

insert into question_bank (cache_key, text_en, text_ml, text_ta, text_hi, branch_tag) values
  ('what brings you in today', 'What brings you in today?',
   'എന്താണ് നിങ്ങളുടെ പ്രശ്നം?', 'உங்கள் பிரச்சனை என்ன?', 'आपकी क्या तकलीफ़ है?', 'opening'),
  ('how many days has this been going on', 'How many days has this been going on?',
   'എത്ര ദിവസമായി ഇത് ഉണ്ട്?', 'எத்தனை நாட்களாக இது உள்ளது?', 'यह कितने दिनों से है?', 'duration'),
  ('do you have any fever', 'Do you have any fever?',
   'പനി ഉണ്ടോ?', 'உங்களுக்கு காய்ச்சல் உள்ளதா?', 'क्या आपको बुखार है?', 'infection'),
  ('are you able to eat and drink normally', 'Are you able to eat and drink normally?',
   'സാധാരണ പോലെ ഭക്ഷണം കഴിക്കാൻ കഴിയുന്നുണ്ടോ?', 'சாதாரணமாக சாப்பிட முடிகிறதா?',
   'क्या आप सामान्य रूप से खा-पी सकते हैं?', 'general'),
  ('does the pain get worse when you move', 'Does the pain get worse when you move?',
   'അനങ്ങുമ്പോൾ വേദന കൂടുന്നുണ്ടോ?', 'நகரும்போது வலி அதிகரிக்கிறதா?',
   'हिलने-डुलने पर दर्द बढ़ता है?', 'abdominal'),
  ('have you vomited', 'Have you vomited?',
   'ഛർദ്ദിച്ചിട്ടുണ്ടോ?', 'உங்களுக்கு வாந்தி வந்ததா?', 'क्या आपको उल्टी हुई है?', 'general'),
  ('is there any blood in it', 'Is there any blood in it?',
   'അതിൽ രക്തം ഉണ്ടോ?', 'அதில் இரத்தம் உள்ளதா?', 'क्या उसमें खून है?', 'general'),
  ('how long have you had this cough', 'How long have you had this cough?',
   'ഈ ചുമ എത്ര നാളായി?', 'இந்த இருமல் எவ்வளவு காலமாக உள்ளது?', 'यह खांसी कब से है?', 'respiratory'),
  ('are you finding it hard to breathe', 'Are you finding it hard to breathe?',
   'ശ്വാസമെടുക്കാൻ ബുദ്ധിമുട്ട് ഉണ്ടോ?', 'மூச்சு விடுவதில் சிரமம் உள்ளதா?',
   'क्या आपको सांस लेने में दिक्कत हो रही है?', 'respiratory'),
  ('do you have chest pain', 'Do you have chest pain?',
   'നെഞ്ചുവേദന ഉണ്ടോ?', 'மார்பு வலி உள்ளதா?', 'क्या आपको सीने में दर्द है?', 'cardiac'),
  ('does your heart feel like it is racing', 'Does your heart feel like it is racing?',
   'ഹൃദയമിടിപ്പ് വേഗത്തിലാണോ?', 'இதயம் வேகமாக துடிக்கிறதா?', 'क्या दिल की धड़कन तेज़ महसूस होती है?', 'cardiac'),
  ('have you had any dizziness or fainting', 'Have you had any dizziness or fainting?',
   'തലകറക്കമോ ബോധക്ഷയമോ ഉണ്ടായോ?', 'தலைச்சுற்றல் அல்லது மயக்கம் ஏற்பட்டதா?',
   'क्या आपको चक्कर या बेहोशी महसूस हुई?', 'cardiac'),
  ('when did the fever start', 'When did the fever start?',
   'പനി എപ്പോൾ തുടങ്ങി?', 'காய்ச்சல் எப்போது தொடங்கியது?', 'बुखार कब शुरू हुआ?', 'infection'),
  ('have you taken any medicine for this already', 'Have you taken any medicine for this already?',
   'ഇതിന് എന്തെങ്കിലും മരുന്ന് കഴിച്ചിട്ടുണ്ടോ?', 'இதற்கு ஏற்கனவே மருந்து எடுத்துக் கொண்டீர்களா?',
   'क्या आपने इसके लिए पहले से कोई दवा ली है?', 'general'),
  ('do you have any known allergies', 'Do you have any known allergies?',
   'അറിയപ്പെടുന്ന അലർജികൾ ഉണ്ടോ?', 'உங்களுக்கு தெரிந்த ஒவ்வாமைகள் ஏதேனும் உள்ளதா?',
   'क्या आपको कोई ज्ञात एलर्जी है?', 'general'),
  ('are you on any regular medication', 'Are you on any regular medication?',
   'സ്ഥിരമായി ഏതെങ്കിലും മരുന്ന് കഴിക്കുന്നുണ്ടോ?', 'நீங்கள் தொடர்ந்து ஏதேனும் மருந்து எடுக்கிறீர்களா?',
   'क्या आप कोई नियमित दवा लेते हैं?', 'general'),
  ('does it hurt when i press here', 'Does it hurt when I press here?',
   'ഇവിടെ അമർത്തുമ്പോൾ വേദനിക്കുന്നുണ്ടോ?', 'இங்கே அழுத்தும்போது வலிக்கிறதா?',
   'यहाँ दबाने पर दर्द होता है?', 'abdominal'),
  ('have your bowel movements changed recently', 'Have your bowel movements changed recently?',
   'അടുത്തിടെ മലവിസർജ്ജനത്തിൽ മാറ്റം ഉണ്ടായോ?', 'சமீபத்தில் மலம் கழிப்பதில் மாற்றம் ஏற்பட்டதா?',
   'क्या हाल ही में मल त्याग में बदलाव आया है?', 'abdominal'),
  ('have you noticed any swelling', 'Have you noticed any swelling?',
   'എന്തെങ്കിലും വീക്കം ശ്രദ്ധയിൽപ്പെട്ടോ?', 'ஏதேனும் வீக்கம் கவனித்தீர்களா?', 'क्या आपने कोई सूजन देखी है?', 'general'),
  ('is the pain constant or does it come and go', 'Is the pain constant or does it come and go?',
   'വേദന നിരന്തരമാണോ അതോ ഇടയ്ക്കിടെയാണോ?', 'வலி தொடர்ச்சியானதா அல்லது இடைவிட்டு வருகிறதா?',
   'दर्द लगातार है या रुक-रुक कर आता है?', 'general'),
  ('on a scale of one to ten how bad is the pain', 'On a scale of one to ten, how bad is the pain?',
   'ഒന്ന് മുതൽ പത്ത് വരെയുള്ള സ്കെയിലിൽ വേദന എത്രത്തോളം കഠിനമാണ്?',
   'ஒன்று முதல் பத்து வரை என்றால் வலி எவ்வளவு கடுமையானது?',
   'एक से दस के पैमाने पर दर्द कितना गंभीर है?', 'general')
on conflict (cache_key) do update set
  text_en = excluded.text_en,
  text_ml = excluded.text_ml,
  text_ta = excluded.text_ta,
  text_hi = excluded.text_hi;

-- =====================================================================
-- Public health analytics — regional_case_counts (T4, demo step 13).
-- 10 regions x 4 disease categories x 26 weeks, generated deterministically
-- (no random()) so re-seeding always reproduces the exact same dataset and
-- the exact same anomaly, in the exact same place. rolling_baseline and
-- is_anomaly are computed HERE, once, in the seed script — the dashboard
-- is read-only and never recomputes them.
--
-- week_start_date is anchored to a fixed date, not now(), so re-running
-- this on a different day still updates the same 260 rows per region
-- instead of silently inserting a second copy of the dataset next to them.
-- =====================================================================

with regions(region_id, region_idx, base_multiplier) as (
  values
    ('reg_thrissur',   0, 1.0),
    ('reg_palakkad',   1, 0.9),
    ('reg_ernakulam',  2, 1.3),
    ('reg_kozhikode',  3, 1.1),
    ('reg_malappuram', 4, 1.2),
    ('reg_kannur',     5, 0.8),
    ('reg_kollam',     6, 0.95),
    ('reg_alappuzha',  7, 1.05),
    ('reg_kottayam',   8, 0.85),
    ('reg_wayanad',    9, 0.6)
),
-- Amplitude is kept well under half of base_count for every disease so
-- ordinary seasonal variation + jitter never gets close to the 2x-baseline
-- anomaly threshold on its own — only the deliberate override below does.
diseases(disease_category, disease_idx, base_count, amplitude) as (
  values
    ('respiratory_infection', 0, 20, 4),
    ('diarrheal_disease',     1, 12, 3),
    ('dengue',                2, 8,  2),
    ('hypertension_related',  3, 15, 2)
),
weeks(week_num, week_start_date) as (
  select w, date '2026-08-03' - (26 - w) * 7
  from generate_series(1, 26) as w
),
base as (
  select
    r.region_id,
    d.disease_category,
    w.week_num,
    w.week_start_date,
    greatest(
      1,
      round(
        d.base_count * r.base_multiplier
        + d.amplitude * sin(w.week_num::float8 / 26 * 2 * pi())
        + (((r.region_idx * 7 + d.disease_idx * 13 + w.week_num * 3) % 3) - 1)
      )::int
    ) as raw_count
  from regions r
  cross join diseases d
  cross join weeks w
),
pre_baseline as (
  select
    *,
    avg(raw_count) over (
      partition by region_id, disease_category
      order by week_num
      rows between 4 preceding and 1 preceding
    ) as trailing_baseline
  from base
),
-- One deliberate, unmistakable spike: dengue in Kozhikode, week 19,
-- 3.5x its own trailing 4-week baseline.
spiked as (
  select
    region_id,
    disease_category,
    week_num,
    week_start_date,
    case
      when region_id = 'reg_kozhikode' and disease_category = 'dengue' and week_num = 19
        then round(coalesce(trailing_baseline, raw_count) * 3.5)::int
      else raw_count
    end as case_count
  from pre_baseline
)
insert into regional_case_counts
  (region_id, disease_category, week_start_date, case_count, rolling_baseline, is_anomaly)
select
  region_id,
  disease_category,
  week_start_date,
  case_count,
  rolling_baseline,
  coalesce(case_count > 2 * rolling_baseline, false) as is_anomaly
from (
  select
    *,
    avg(case_count) over (
      partition by region_id, disease_category
      order by week_start_date
      rows between 4 preceding and 1 preceding
    ) as rolling_baseline
  from spiked
) final
on conflict (region_id, disease_category, week_start_date) do update set
  case_count = excluded.case_count,
  rolling_baseline = excluded.rolling_baseline,
  is_anomaly = excluded.is_anomaly;
