-- ============================================================
-- ArogyaMap — Database Schema & Patient Intake Definition
-- Location Field: Mandatory village_id on patients/visits
-- Compatible with Supabase / PostgreSQL
-- ============================================================

-- 1. Village Profiles Table (Reference Data)
CREATE TABLE IF NOT EXISTS village_profiles (
    village_id VARCHAR(32) PRIMARY KEY,
    district_id VARCHAR(32) NOT NULL,
    name VARCHAR(128) NOT NULL,
    sanitation_score NUMERIC(5,2) NOT NULL CHECK (sanitation_score >= 0 AND sanitation_score <= 100),
    water_source_type VARCHAR(32) NOT NULL CHECK (water_source_type IN ('piped', 'open_well', 'borewell', 'tanker', 'canal')),
    population_density INTEGER NOT NULL CHECK (population_density >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Patients Table (Demographics & Village-Level Jurisdiction)
-- CRITICAL: village_id is mandatory to enable localized public health aggregation
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_identifier VARCHAR(64) UNIQUE NOT NULL, -- e.g. ABHA ID or PHC registration number
    full_name VARCHAR(128) NOT NULL,
    age INTEGER NOT NULL CHECK (age >= 0 AND age <= 125),
    gender VARCHAR(16) NOT NULL CHECK (gender IN ('male', 'female', 'other')),
    district_id VARCHAR(32) NOT NULL,
    village_id VARCHAR(32) NOT NULL REFERENCES village_profiles(village_id) ON DELETE RESTRICT,
    phone_number VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast village-level epidemiological lookups
CREATE INDEX IF NOT EXISTS idx_patients_village_id ON patients(village_id);
CREATE INDEX IF NOT EXISTS idx_patients_district_id ON patients(district_id);

-- 3. Diagnostic Reports / Telemedicine Visits Table
CREATE TABLE IF NOT EXISTS diagnostic_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    village_id VARCHAR(32) NOT NULL REFERENCES village_profiles(village_id) ON DELETE RESTRICT,
    chief_complaint TEXT NOT NULL, -- Natural language clinical text (e.g. "high fever, body ache, rash on legs")
    symptom_category VARCHAR(64), -- Classified by classifySymptom() (e.g. 'acute_febrile_rash', 'dengue_like_illness')
    temperature_c NUMERIC(4,1),
    platelet_count INTEGER,
    presumptive_diagnosis VARCHAR(128),
    vhn_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for date-range and village aggregations
CREATE INDEX IF NOT EXISTS idx_diagnostic_reports_village_date ON diagnostic_reports(village_id, created_at);
CREATE INDEX IF NOT EXISTS idx_diagnostic_reports_symptom ON diagnostic_reports(symptom_category);

-- 4. Daily Environmental & Weather Observations Table
CREATE TABLE IF NOT EXISTS daily_environmental_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id VARCHAR(32) NOT NULL REFERENCES village_profiles(village_id),
    observation_date DATE NOT NULL,
    rainfall_mm NUMERIC(6,2) DEFAULT 0.00,
    gathering_flag SMALLINT DEFAULT 0 CHECK (gathering_flag IN (0, 1)),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(village_id, observation_date)
);
