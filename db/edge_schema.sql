-- Project Vaidhya — edge SQLite mirror (services/edge-ai/edge.db)
-- Source: Docs/Project_Vaidhya_Technical_Architecture_v1.md §3.3
--
-- V1: only `sessions` is actually used (session persistence across a restart).
-- The mirror + outbox tables exist now so the phase-2 offline story is a
-- sync worker and nothing else — no schema change under time pressure.

create table if not exists visits (
  visit_id text primary key,
  patient_id text,
  edge_jurisdiction_id text,
  status text not null default 'intake_in_progress',
  identity_unverified_offline integer default 0,
  language text not null default 'en',
  created_at text not null,
  completed_at text
);

create table if not exists vitals_readings (
  reading_id text primary key,
  visit_id text not null,
  type text not null,
  phase text not null,
  value_numeric real,
  value_text text,
  requested_at text,
  entered_at text,
  status text not null default 'entered'
);

create table if not exists diagnostic_reports (
  report_id text primary key,
  visit_id text not null,
  transcript text not null default '[]',
  vitals_snapshot text not null default '[]',
  urgency_tier text not null default '{}',
  chief_complaint text,
  summary_text text,
  generated_at text not null
);

-- Branching rules, mirrored from the `branching_rules` rows in 002_seed.sql.
-- They live here rather than being fetched from Supabase because the rules
-- engine has to fire with the wifi unplugged — that is the whole point of
-- demo steps 4 and 6. `question_branch_tags` is a comma-separated string
-- because SQLite has no array type; Postgres keeps the real text[].
create table if not exists branching_rules (
  rule_id text primary key,
  trigger_vital_or_finding text not null,
  condition text not null,
  question_branch_tags text not null default '',
  urgency_flag integer not null default 0,
  description_template text,
  active integer not null default 1
);

-- Seeded with `or ignore` so a hand-edited row survives a restart.
insert or ignore into branching_rules
  (rule_id, trigger_vital_or_finding, condition, question_branch_tags, urgency_flag, description_template)
values
  ('rule_spo2_low',           'spo2',               '<92',    'respiratory',          1, 'low SpO2 ({value}%)'),
  ('rule_spo2_critical',      'spo2',               '<88',    'respiratory,emergency',1, 'critically low SpO2 ({value}%)'),
  ('rule_fever_high',         'temperature',        '>=38.5', 'infection',            1, 'high fever ({value}°C)'),
  ('rule_tachycardia',        'pulse',              '>=110',  'cardiac',              1, 'tachycardia ({value} bpm)'),
  ('rule_bradycardia',        'pulse',              '<50',    'cardiac',              1, 'bradycardia ({value} bpm)'),
  ('rule_tachypnea',          'respiratory_rate',   '>=24',   'respiratory',          1, 'raised respiratory rate ({value}/min)'),
  ('rule_rebound_tenderness', 'rebound_tenderness', '==true', 'abdominal,surgical',   1, 'rebound tenderness present');

-- Voicebot session state, so a uvicorn restart mid-demo is survivable.
create table if not exists sessions (
  visit_id text primary key,
  payload text not null,          -- JSON dump of the Session object
  updated_at text not null
);

-- Durable doctor ↔ patient chatbot timeline. MQTT delivers events; this table
-- makes them available after a refresh, restart or temporary broker outage.
create table if not exists consult_messages (
  message_id text primary key,
  visit_id text not null,
  speaker text not null,
  text_en text not null,
  text_native text not null default '',
  created_at text not null
);
create index if not exists idx_consult_messages_visit on consult_messages (visit_id, created_at);

-- Phase 2: every edge write lands here; a worker drains it to Supabase.
create table if not exists outbox (
  id integer primary key autoincrement,
  entity text not null,           -- visits | vitals_readings | diagnostic_reports
  entity_id text not null,
  payload text not null,          -- JSON
  created_at text not null,
  synced_at text
);
create index if not exists idx_outbox_unsynced on outbox (synced_at);
