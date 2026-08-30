# VaidhyaPredict — Public Health & Predictive Analytics Dashboard

A professional, map-driven disease surveillance and predictive analytics platform built for rural telemedicine in Tamil Nadu, India.

---

## ⚡ Live Demo Simulation Mode (Phase 6)

VaidhyaPredict features an **event-driven Live Demo Mode** that simulates real-time patient intake arriving at primary telemedicine centres:

- **▶ Start / ⏸ Pause Simulation**: Generates a new clinical encounter every ~4.5 seconds (simulating 1 new patient visit every 30 minutes in a real rural health clinic).
- **⚡ +1 Visit (Instant)**: Step-by-step presentation trigger for manual demonstrations.
- **Incremental Recalculation**: Only recalculates metrics for the specific village receiving the visit, keeping the interface ultra-responsive.
- **Outbreak Escalation Toast Alerts**: Triggers an alert when a village's abnormal rate crosses the $2.0\times$ baseline threshold into **Critical**.
- **LLM Call Optimization**: AI insight summaries are regenerated **strictly on genuine risk level escalations**, avoiding wasteful API calls on regular ticks.
- **Live Visual Feedback**: Dynamic radar ping on map markers and instant in-place updates across State, District, and Village detail pages.
- **⟲ Reset Demo Data**: 1-click restore to the static CSV baseline.

---

## 🔬 Core Epidemiological Methodology

> [!IMPORTANT]
> **Authentic Clinical Mental Model**:
> VaidhyaPredict operates strictly on **patient vitals and physician diagnostic notes** collected during primary telemedicine encounters. External datasets (such as village-level rainfall or municipal sanitation ratings) were deliberately excluded because such datasets do not reliably exist at village resolution in rural practice.
>
> 1. **Vitals Abnormality Classification**: Each patient visit is independently evaluated against standard clinical thresholds (fever: $\text{temp} \ge 38.0^\circ\text{C}$, tachycardia: $\text{HR} \ge 100$, low SpO2: $\text{SpO}_2 < 94\%$, hypertensive: $\text{BP} \ge 140/90$). Patients are **never** compared to each other.
> 2. **Localized Rollup**: Using each patient's most recent consultation (`visit_number == 1`), the abnormal visit rate is computed per village ($\text{rate} = \frac{\text{abnormal visits}}{\text{total patients}}$).
> 3. **Baseline Comparison & Spike Detection**: The village rate is compared to the **overall regional baseline rate** ($\approx 11.2\%$ across all monitored patients).
>    - 🔴 **Critical**: Village Rate $\ge 2.0\times$ Baseline Rate (e.g. *Royapuram* at 37.5%, *Melur* at 49.7%).
>    - 🟡 **Elevated**: Village Rate $\ge 1.4\times$ Baseline Rate.
>    - 🟢 **Normal**: Otherwise (e.g. *Anna Nagar* at 7.8%).
> 4. **Doctor-Noted Root Cause Profiling**: For flagged villages, the system analyzes physician notes (`doctor_root_cause`) among affected patients to identify the primary clinical drivers (e.g. *Suspected dengue*, *Pneumonia*, *Viral fever*).
> 5. **Clinical Action Plan**: The AI engine translates the abnormal rate, dominant vital flags, and physician findings into actionable field response steps for medical officers.

---

## 📊 Data Sources & Architecture

The application is powered directly by real telemedicine visit records:

1. **Patient Profiles (`data/patients.csv` — 5,000 records)**:
   - Contains de-identified patient demographics (`patient_id`, `name`, `age`, `gender`, `height_cm`, `weight_kg`, `blood_group`, `phone_no`, `abha_id`, `district`, `region_village`, `registered_date`).
2. **Case History & Clinical Vitals (`data/case_history.csv` — 10,000 visits)**:
   - Contains 2 longitudinal visits per patient (`visit_id`, `patient_id`, `district`, `region_village`, `visit_number`, `visit_date`, `chief_complaint`, `bp_systolic`, `bp_diastolic`, `heart_rate`, `spo2`, `temperature_c`, `vital_flag_status`, `vital_flag_types`, `ai_summary`, `doctor_root_cause`).
3. **Geographic TopoJSON (`public/tamil-nadu.topojson`)**:
   - Official district boundary geometries for high-precision SVG map rendering.

---

## 🏛️ Navigation & Dashboard Structure

- **State Overview (`/`)**: Interactive map with zoom/pan controls, district focus dropdown, risk filters, regional surveillance rollups, and Live Demo controls toolbar.
- **District Rollup (`/region/[areaId]`)**: District summary banner ("X of Y villages flagged"), live intake counters, and live-updating village cards.
- **Village Detail (`/region/[areaId]/village/[villageId]`)**: Ground-level unit of care featuring:
  - Weekly abnormal vitals & patient volume trend chart (updates in place).
  - Doctor-noted root causes bar chart & dominant vital flag percentages.
  - AI clinical insight and recommended field intervention protocol.
  - De-identified sample case cards with recorded vitals and physician notes.

---

## 🔄 Re-generating Data & Build

```bash
# 1. Generate 5,000 patient records & 10,000 visits
python scripts/generate_csv_data.py

# 2. Run Next.js production build
npm run build

# 3. Start local development server
npm run dev -p 3000
```
