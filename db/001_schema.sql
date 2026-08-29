-- Project Vaidhya — Supabase schema (THE hour-0 contract)
-- Source: Docs/Project_Vaidhya_Technical_Architecture_v1.md §3.2
--
-- Apply once, in the Supabase SQL editor, before anyone writes a query.
-- If this file changes after hour 1, everyone must be told in the group chat.
--
-- Note: table order here differs from the architecture doc — `pharmacies` is
-- created before `prescriptions` because `prescriptions.pharmacy_id`
-- references it. Same schema, valid execution order.

-- =====================================================================
-- Reference / identity
-- =====================================================================

create table jurisdictions (
  jurisdiction_id text primary key,
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  edge_server_id text
);

create table patients (
  patient_id text primary key,
  abha_id text unique,
  phone_number text not null,
  fingerprint_hash text,
  name text not null,
  dob date,
  age int,
  sex text,
  home_jurisdiction_id text references jurisdictions,
  created_at timestamptz default now()
);

create table doctors (
  doctor_id text primary key,
  name text not null,
  specialty_general text default 'MBBS',
  phone_number text unique not null,
  password_hash text not null,
  serves_jurisdiction_ids text[] not null default '{}'
);

-- =====================================================================
-- Visit lifecycle
--   T1 owns visits until status = 'awaiting_doctor'.
--   T2 owns visits from 'awaiting_doctor' onward. Never simultaneous.
-- =====================================================================

create type visit_status as enum
  ('intake_in_progress','awaiting_doctor','in_consult','completed','cancelled');

create table visits (
  visit_id text primary key,
  patient_id text references patients,
  edge_jurisdiction_id text references jurisdictions,
  status visit_status not null default 'intake_in_progress',
  unreconciled boolean default false,
  identity_unverified_offline boolean default false,
  consultation_id text,                       -- == visit_id once in_consult
  claimed_by_doctor_id text references doctors,
  language text not null default 'en',        -- ta | ml | hi | en
  last_heartbeat_at timestamptz,              -- drives the lazy consult timeout
  created_at timestamptz default now(),
  completed_at timestamptz
);
create index on visits (status, edge_jurisdiction_id);

-- Written by T1 only.
create table vitals_readings (
  reading_id text primary key,
  visit_id text references visits on delete cascade,
  type text not null,
  phase text not null,                        -- pass_one_baseline | on_demand
  value_numeric double precision,
  value_text text,
  requested_at timestamptz,
  entered_at timestamptz,
  status text not null default 'entered'      -- entered | not_obtained
);

-- Written by T1 only.
create table diagnostic_reports (
  report_id text primary key,
  visit_id text references visits on delete cascade,
  transcript jsonb not null default '[]',     -- [{speaker,text,text_native,timestamp}]
  vitals_snapshot jsonb not null default '[]',
  prior_history_summary jsonb,
  visual_symptom_description text,
  visual_symptom_image_url text,
  urgency_tier jsonb not null,                -- {tier, flags[], flag_count}
  chief_complaint text,
  summary_text text,
  generated_at timestamptz default now()
);

-- =====================================================================
-- Clinical knowledge (seeded by T4)
-- =====================================================================

create table branching_rules (
  rule_id text primary key,
  trigger_vital_or_finding text not null,
  condition text not null,                    -- "<90"  ">=180"  "==true"
  question_branch_tags text[] not null default '{}',
  urgency_flag boolean not null default false,
  description_template text,                  -- "low SpO2 ({value}%)"
  active boolean not null default true
);

-- Translation CACHE, not a question source. The LLM authors questions freely;
-- this table only lets common phrasings skip the IndicTrans2 call.
-- Safe to leave empty — a cache miss is normal, not an error.
create table question_bank (
  cache_key text primary key,                 -- normalize(text_en): lowercased, punctuation stripped
  text_en text not null,
  text_hi text,
  text_ta text,
  text_ml text,
  branch_tag text
);

-- =====================================================================
-- Pharmacy (T3)
-- =====================================================================

create table pharmacies (
  pharmacy_id text primary key,
  name text not null,
  location text,
  phone_number text unique not null,
  jurisdiction_id text references jurisdictions,
  latitude double precision,
  longitude double precision
);

create table stock_items (
  stock_item_id text primary key,
  pharmacy_id text references pharmacies on delete cascade,
  medicine_name text not null,
  quantity int not null default 0,
  status text generated always as (
    case when quantity = 0 then 'out_of_stock'
         when quantity < 10 then 'low'
         else 'in_stock' end) stored
);

-- Written by T2 only.
create table prescriptions (
  prescription_id text primary key,
  visit_id text references visits,
  doctor_id text references doctors,
  medications jsonb not null default '[]',    -- [{name,dosage,duration,instructions}]
  follow_up_requested boolean default false,
  pharmacy_id text references pharmacies,
  issued_at timestamptz default now()
);

create table bills (
  bill_id text primary key,
  prescription_id text references prescriptions,
  pharmacy_id text references pharmacies,
  line_items jsonb not null default '[]',
  total numeric not null default 0,
  created_at timestamptz default now()
);

create table pharmacy_queue (
  entry_id text primary key,
  pharmacy_id text references pharmacies,
  prescription_id text references prescriptions unique,
  status text not null default 'pending',     -- pending | fulfilled
  created_at timestamptz default now()
);

-- =====================================================================
-- Phase 2 tables — created now so no migration is needed mid-hackathon
-- =====================================================================

create table regional_case_counts (
  region_id text,
  disease_category text,
  week_start_date date,
  case_count int not null,
  rolling_baseline double precision,
  is_anomaly boolean,
  primary key (region_id, disease_category, week_start_date)
);

create table scheduled_reminders (
  reminder_id text primary key,
  prescription_id text references prescriptions,
  phone_number text not null,
  kind text not null,                         -- immediate_rx | follow_up
  body text not null,
  due_at timestamptz not null,
  sent_at timestamptz,
  status text not null default 'pending'      -- pending | sent | failed
);
