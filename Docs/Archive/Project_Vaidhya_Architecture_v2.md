# Project Vaidhya: AI-Powered Offline Telemedicine Architecture (v3)

*Supersedes v2. This version fills in the Pharmacist Portal, previously a placeholder, based on the project owner's follow-up direction.*

## Executive Summary & Core Objective
An offline-capable AI teleconsultation platform for rural India under low-bandwidth conditions. Rural patients interact directly with an AI voicebot at a local health center (nurse present in the room, but not a separate system user), which conducts intake, builds a diagnostic summary, and connects the patient to a city-based doctor via video, audio, or MQTT-based text — with MQTT-text as the flagship, high-priority mode and the platform's core USP.

The system has three portals: **Patient**, **Doctor**, and **Pharmacist** (pharmacist details pending).

---

## 1. Patient Portal

### 1.1 Login
- Patient authenticates using ABHA ID, phone number, or fingerprint — whichever is most accessible to them.
- No separate nurse login. The nurse is physically present with the patient during the session and participates by responding to prompts the voicebot directs at them (e.g., requests to perform a physical test), but does not have their own account or portal.

### 1.2 Entry Screen: AI Voicebot Intake (Two-Pass Model)

The intake flow runs in two passes, plus a dynamic extension mechanism, so the voicebot always starts the conversation with clinical context already loaded.

**Pass One — Silent Triage (pre-conversation):**
- As the patient is seated and authenticated, the nurse takes quick baseline vitals — temperature and SpO2 as the minimum baseline set (see 1.2.1 for the full field list).
- These are entered into the portal and injected silently into the global session state before the voicebot says a word.
- Nothing about this pass is conversational or patient-facing — it's a fast clinical baseline captured in the background.

**Pass Two — Conversational Intake:**
- The voicebot wakes up, greets the patient, and asks for their complaint/reason for visit.
- It already has the Pass One baseline data available to inform its initial logic tree (see 1.2.2 for branching rules), but to the patient it feels like a natural, unprompted conversation — the vitals-awareness is invisible to them.
- The bot gathers full details conversationally, tracking state (Zustand-style state engine) so it never re-asks for information already given (e.g., "stomach pain for 2 days" registers both the complaint and the duration).

**On-Demand Extensions (dynamic, mid-conversation):**
- If the conversation surfaces a need that couldn't have been anticipated at Pass One (e.g., patient reports stomach pain), the voicebot dynamically requests the nurse perform a specific, relevant physical exam finding (e.g., abdominal palpation) in the moment.
- The nurse's input is captured into the same session state as soon as entered, and the voicebot incorporates it into the ongoing conversation (e.g., adjusting its next question based on the finding).

#### 1.2.1 Vitals & Exam Findings Fields (Nurse Input)

**Core vitals (numeric, structured):**
- Temperature
- Blood pressure (systolic/diastolic)
- Pulse / heart rate
- SpO2 (oxygen saturation)
- Respiratory rate
- Weight

**Basic exam findings (structured + free text, requested on-demand):**
- Palpation results (e.g., abdominal tenderness, location, severity)
- Visible symptom observations (e.g., rash appearance, swelling, discoloration)
- Any other locally feasible physical assessment the voicebot requests mid-conversation

Both categories share one nurse-facing input mechanism in the portal — vitals and exam findings are entered through the same interface, distinguished by when they're triggered (upfront baseline vs. on-demand request).

#### 1.2.2 Vitals-Driven Branching Logic (Voicebot Question Tree)

The voicebot uses Pass One vitals to prioritize, skip, or deepen specific question branches before the conversation even starts. Example rules:

- **Low SpO2 (below normal range):** Prioritize respiratory questions early — ask about breathlessness, onset, triggers (exertion vs. at rest), chest pain, cough, in more depth than default. Flag as higher-urgency in the diagnostic summary.
- **Normal SpO2:** Deprioritize/skip deep respiratory branching unless the patient's stated complaint independently points that way.
- **Fever (elevated temperature):** Immediately branch into fever-pattern questions — duration, pattern (continuous vs. intermittent), associated chills/sweating, recent travel or exposure — before general complaint questions.
- **Elevated blood pressure:** Add branch for headache, vision changes, chest pain, known hypertension history/medication adherence.
- **Abnormal pulse (high/low):** Branch into palpitations, dizziness, fainting history.
- **Low weight relative to history (if prior visit data exists):** Branch into appetite, weight loss duration, associated GI symptoms.
- **On-demand exam findings (e.g., palpation result = tenderness in lower right abdomen):** Immediately re-prioritize toward appendicitis-relevant questions (nausea, vomiting, pain migration pattern) rather than continuing the original question order.

These rules determine question *priority and depth*, not hard gating — the voicebot still lets the patient's stated complaint drive the primary thread; vitals reorder and weight the branches around it. This logic tree should be documented as a maintainable rules table (or lightweight decision model) rather than hardcoded conditionals, so it's easy to extend with more vitals-to-branch mappings later.

### 1.3 Diagnostic Summary Generation
Once the conversation is complete, the system automatically compiles a single diagnostic report combining:
- Previous medical reports and visit history
- Current prescriptions / medications in progress
- The full transcript of the current voicebot conversation
- Any nurse-entered test results from this visit

This becomes the structured diagnostic summary sent to the doctor.

### 1.4 Connecting to the Doctor (Cascading Network Modes)
The system attempts to connect the patient to a doctor using the best available mode, in this priority order:
1. **Video call** — used when bandwidth is good.
2. **Audio call** — used when video isn't feasible but voice is.
3. **MQTT text-based consultation** — the flagship, high-priority mode of the platform. Only the compressed diagnostic report (text) is transmitted between patient and doctor.

In video/audio mode, the doctor speaks with the patient directly — no AI mediation is needed for follow-up questions.

In MQTT-text mode only, if the doctor needs more information:
- The doctor enters the request in their portal.
- It's delivered to the patient side, where the AI voicebot asks the patient (by voice) for that specific information.
- The patient's voice answer is captured, processed, and relayed back to the doctor as text.

**Mode-selection mechanism (demo scope):** rather than real bandwidth/latency probing, the video → audio → MQTT-text cascade is triggered by a manual toggle for the hackathon demo. Real network-quality detection (e.g. WebRTC stats, connection speed probe) is deferred to a post-demo build phase.

### 1.5 Prescription Delivery
- The doctor reviews the diagnostic report (and any follow-up answers) and issues a prescription.
- The final prescription is sent back to the patient as text, viewable and printable in the patient portal.

### 1.6 Additional Patient Portal Pages
- **Medical Summary & History:** Calendar/timeline-based view of past visits. Each visit shows the summary of what happened and what medications were prescribed at that time.
- **Account Settings:** Manage/update patient account details.

---

## 2. Doctor Portal

### 2.1 Waiting Room / Queue
- Once a patient finishes their AI voicebot conversation and the diagnostic summary is generated, the patient is placed into a doctor's waiting room/queue.
- Doctors see a list of all available/waiting patients.
- A doctor can view any patient's diagnostic report before deciding, and selects which patient to connect to next (doctor-initiated pickup, not automatic assignment).

### 2.2 Connection Establishment
- On selecting a patient, the doctor is connected via whichever mode is available: video, audio, or MQTT-text (same cascading logic as the patient side).

### 2.3 Consultation
- Doctor reviews the diagnostic summary alongside the patient's past records.
- In video/audio mode: doctor asks follow-up questions directly to the patient.
- In MQTT-text mode: doctor submits follow-up info requests through the portal; these route through the patient's AI voicebot (see 1.4) and return as text.
- Doctor tracks currently active medications and any new prescription given during the visit.

### 2.4 Prescription
- Doctor issues final prescription/instructions, sent back to the patient as text.

---

## 3. Pharmacist Portal

A standalone portal for local pharmacy staff, distinct from the Patient and Doctor portals. Its core purpose is to let a pharmacy maintain its own stock and billing records — which in turn feeds two other flows: the patient's "find nearby medicine" lookup (1.5/1.6) and the doctor's pre-prescription stock check (2.4). The pharmacy's own stock/billing tools are the primary function; visibility into that data elsewhere in the system is a byproduct of keeping it current.

### 3.1 Login
- Local pharmacy staff authenticate via phone number, consistent with the patient portal's lightweight auth pattern.
- Each pharmacy is its own account/tenant — this is not a centralized back-office model.

### 3.2 Stock Management
- Pharmacist adds, updates, or removes medicines and on-hand quantities.
- Items can be flagged low-stock or out-of-stock.
- This is the data source that both the patient-side nearby-medicine lookup and the doctor-side stock-check panel read from.

### 3.3 Incoming Prescription Queue
- Prescriptions routed to this pharmacy (from doctors/patients) appear in a queue.
- Pharmacist marks each as pending or fulfilled as patients come to collect medicine.

### 3.4 Billing
- When a patient collects a prescribed medicine, the pharmacist generates a bill/invoice.
- Basic sales record, tied to the fulfilled prescription.

### 3.5 Feed Into Doctor Portal — "Check Nearby Stock" Panel
- Before finalizing a prescription (2.4), the doctor can open a separate "check nearby stock" panel.
- The doctor searches a medicine and sees nearby pharmacies with their stock status, pulled from pharmacist-maintained data.
- This is a distinct panel/modal, not inline in the prescription form itself.

### 3.6 Feed Into Patient Portal — Nearby Medicine Lookup
- Once a patient has a prescription, the patient portal shows a list of nearby pharmacies with stock status (in stock / low / out) for each prescribed medicine.
- Not a single best-match recommendation — the patient sees the full list and status per pharmacy.
- Includes a mock "request delivery" action per pharmacy — simulates coordination for the demo; no real courier/logistics integration.

### 3.7 Demo Scope
- For the hackathon, pharmacy stock is **seeded/mock inventory** — a small seeded dataset of local pharmacies with mock stock levels, consistent with the seeded-data approach used for the public health analytics dashboard (5.2). No real pharmacy integration.
- The portal itself (login, stock CRUD, prescription queue, billing) should still be built and functional against that seeded/session data — it's the surrounding pharmacy-integration network (real partner pharmacies, real-time sync) that's mocked, not the portal UI/logic.

---

## 4. Cross-Cutting System Notes (carried over from original doc, still applicable)

### Unified Patient History / Data Security
- Encrypted data storage linked to the central ABHA ID database.
- History displayed in calendar-like or infinite-scroll format, grouped by visit.

### Nurse-Assisted Diagnostics
- Nurse performs basic, locally feasible physical assessments at the voicebot's request during the patient's session (no advanced scans like MRI/X-ray, which the system explicitly avoids ordering).
- See 1.2 for the full two-pass vitals/exam-findings model (baseline vitals pre-conversation, on-demand exam requests mid-conversation) and 1.2.2 for how vitals drive the voicebot's question branching.

### Visual Symptom Capture
- For visual conditions (e.g., skin rashes), the AI captures a still image via webcam and generates a medical text description to append to the diagnostic report, since live video streaming for this purpose isn't reliable.

### Secondary / Advanced Modules

**Decision: all three secondary modules below are in scope to fully build for the demo** (not mocked), per project owner direction. Each has a confirmed initial approach; the agentic module has an explicit upgrade path if time allows.

#### 5.1 Agentic AI Decision Support (Virtual Sub-Specialists)
- **Purpose:** Assist general MBBS doctors in the doctor portal with expert-level input on complex/emergency cases across Cardiology, Thoracic Medicine, Neurology, and Ophthalmology.
- **Interaction model: doctor-triggered advisory panel.** The doctor stays in control — on any patient case, the doctor can click "Consult Specialist AI," select the relevant specialty, and receive an advisory opinion/diagnostic insight injected into their portal view. This is not automatic/proactive flagging.
- **Backend approach (Phase 1, hackathon-scoped):** A single underlying LLM (cloud-hosted) with a distinct system prompt and specialty-specific context/knowledge per sub-specialist. Each "specialist" is a prompt configuration, not a separate agent — fastest to build, still reads as distinct specialists to the doctor.
- **Upgrade path (Phase 2, time permitting):** Migrate to a true multi-agent framework (LangGraph or CrewAI), where each specialist becomes a distinct agent node with its own tools/retrieval, orchestrated rather than prompt-switched. This is a stretch goal, not required for initial demo readiness.
- **Case data passed to the advisory call:** the full diagnostic report (history, transcript, vitals) is sent as-is — no doctor-curated excerpt step. Simplest to build; the specialist prompt is responsible for extracting what's relevant.
- **Open detail to finalize later:** exact prompt/context design per specialty.

#### 5.2 Regional Predictive Public Health Analytics
- **Purpose:** Aggregate anonymized patient data across villages/cities/states to identify potential pandemic/endemic patterns early.
- **Demo approach: live dashboard from seeded data.** Build a real dashboard (charts/maps) rendering simulated aggregated case data across multiple villages/regions, with at least one anomaly/spike deliberately seeded and visually highlighted. The seed data is prepared ahead of time — this is not live ML inference running during the demo itself.
- **Seed dataset scope:** broader — 10+ regions, 3-4 disease categories, a longer time range (e.g. several months), with at least one clear anomaly/spike seeded in.
- **Visualization approach: both.** A map view for regional overview (color-coded intensity, spike region highlighted geographically) plus chart views (time-series trends) for drill-down detail per region/disease.
- **Open detail to finalize later:** what specifically defines an "anomaly" worth highlighting for the demo narrative (threshold logic, or just a deliberately implausible spike).
- **Longer-term note:** a real ML pipeline (anomaly detection/clustering on live data) remains the eventual production goal; the seeded dashboard is the hackathon-appropriate stand-in.

#### 5.3 Patient Engagement & Outreach (IVR/SMS)
- **Purpose:** Automated medication reminders and doctor-requested follow-up reminders reaching patients who may not have smartphone/data access.
- **Demo approach: real integration**, so the demo can trigger an actual SMS or IVR call to a real phone live during the presentation.
- **Provider: Twilio**, chosen by default for fastest hackathon setup (well-documented sandbox, no India-specific onboarding friction). Exotel remains worth evaluating post-hackathon for its India-specific telephony/IVR support, but isn't the build target for the demo.
- **Open detail to finalize later:** trigger conditions (on prescription issuance? on a schedule?), and message/call script content.

#### 5.4 Integrated Pharmacy & Inventory Management
- Superseded by the full **Pharmacist Portal** (see Section 3) — this is no longer a standalone secondary module. Section 3 is now the canonical reference for pharmacy/inventory functionality.

---

## Open Items / To Reconcile

All major open items resolved as of this pass. Remaining details are narrow and can be settled during build:
- Agentic specialist Phase 1: exact prompt/context design per specialty (case data scope is now settled — full diagnostic report).
- Public health analytics: precise anomaly definition/threshold for the demo narrative (dataset scope and visualization approach are now settled).
- IVR/SMS: trigger conditions and message/call script content (provider is now settled — Twilio).
- Real network-quality detection for the video → audio → MQTT-text cascade remains future scope; demo uses a manual toggle.
