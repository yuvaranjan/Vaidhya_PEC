# Project Vaidhya: AI-Powered Offline Telemedicine Architecture (v5)

*Supersedes v4. This version closes all five previously-open items, adds a Data Topology section (edge/central split with an explicit hackathon simplification), a full Data Model, cross-portal API/event contracts (including MQTT topic/payload schema), key state machines, and offline/error/concurrency handling — the layer needed for an AI coding agent (Claude Code, Antigravity, etc.) to implement this without inventing product decisions. No new features were introduced; every addition below specifies *how* an already-approved v4 behavior actually works end to end. Tech stack (framework/DB/broker choice) is intentionally left open — that's an implementation decision for the build agent, not a product decision for this doc. This draft also underwent an explicit self-review pass (a fresh read as if by the implementing coding agent) that surfaced and closed additional gaps: a missing `Jurisdiction` entity, doctor login/auth, the `consultation_id`↔`visit_id` relationship, "nearby" pharmacy distance logic, the rules-table condition-language spec, voicebot language/locale, and the visual-symptom-capture trigger. One item was deliberately left unresolved and surfaced instead of silently fixed — see "Honest Scope Flag" at the end of this document.*

## How to Read This Document
Sections 1–5 are unchanged in *intent* from v4 (behavior/UX), with open items resolved inline and cross-references added to the new spec sections (6–10). Sections 6–10 are new: they give concrete shapes (entities, APIs, state machines, error paths) to what 1–5 describe narratively. An implementing agent should treat 6–10 as the contract and 1–5 as the rationale/UX behind that contract.

---

## Executive Summary & Core Objective
An offline-capable AI teleconsultation platform for rural India under low-bandwidth conditions. Rural patients interact directly with an AI voicebot at a local health center (nurse present in the room, but not a separate system user), which conducts intake, builds a diagnostic summary, and connects the patient to a city-based doctor via video, audio, or MQTT-based text — with MQTT-text as the flagship, high-priority mode and the platform's core USP.

The system has three portals: **Patient**, **Doctor**, and **Pharmacist**.

The system's target production topology is **two-tier: village-local edge + regional central server** (see Section 6). For the hackathon build, this is deliberately simplified to a single backend that simulates both roles — see 6.4 for the explicit demo-scope note.

---

## 1. Patient Portal

### 1.1 Login
- Patient authenticates using ABHA ID, phone number, or fingerprint — whichever is most accessible to them.
- **Universal fallback: phone number + OTP.** ABHA ID and fingerprint are faster paths when available, but every patient is guaranteed to be able to log in via phone + OTP — this is the one path the system must never assume is unavailable. See 6.5 for OTP delivery when the edge device itself is offline.
- No separate nurse login. The nurse is physically present with the patient during the session and participates by responding to prompts the voicebot directs at them (e.g., requests to perform a physical test), but does not have their own account or portal.
- See 7.1 for the `Patient` entity and 9.1 for the login state machine.

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
- **Language (resolved, demo scope):** the voicebot operates in **one configurable language for the demo build** — Hindi or English, selectable at build time via a config value, not a runtime per-patient picker. STT/TTS provider is an implementation choice (left to the build agent per this doc's stack-agnostic scope), but the provider chosen must support whichever language is configured. Multi-language runtime selection (matching the patient's actual regional language) is real production-scope but explicitly out of scope for the 20-hour build — noted as a future item in Open Items below.

**On-Demand Extensions (dynamic, mid-conversation):**
- If the conversation surfaces a need that couldn't have been anticipated at Pass One (e.g., patient reports stomach pain), the voicebot dynamically requests the nurse perform a specific, relevant physical exam finding (e.g., abdominal palpation) in the moment.
- The nurse's input is captured into the same session state as soon as entered, and the voicebot incorporates it into the ongoing conversation (e.g., adjusting its next question based on the finding).
- **Timeout behavior (new in v5):** if the nurse does not enter the requested finding within 90 seconds, the voicebot verbally re-prompts once ("Nurse, were you able to check that?"). If still unanswered after a second 90-second window, the bot marks that finding as `not_obtained` in session state, tells the patient it will proceed without it, and continues the conversation thread using only the patient's verbal report. This prevents the intake session from stalling indefinitely on a single unavailable exam finding. See 9.2 for the full intake state machine.

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

Both categories share one nurse-facing input mechanism in the portal — vitals and exam findings are entered through the same interface, distinguished by when they're triggered (upfront baseline vs. on-demand request). See 7.3 for the `VitalsReading` and `ExamFinding` entities.

#### 1.2.2 Vitals-Driven Branching Logic (Voicebot Question Tree)

The voicebot uses Pass One vitals to prioritize, skip, or deepen specific question branches before the conversation even starts. This logic is implemented as a **rules table** (see 7.6 for the concrete schema — not hardcoded conditionals), so it's easy to extend with more vitals-to-branch mappings later. Example rules:

- **Low SpO2 (below normal range):** Prioritize respiratory questions early — ask about breathlessness, onset, triggers (exertion vs. at rest), chest pain, cough, in more depth than default. Flag as higher-urgency in the diagnostic summary.
- **Normal SpO2:** Deprioritize/skip deep respiratory branching unless the patient's stated complaint independently points that way.
- **Fever (elevated temperature):** Immediately branch into fever-pattern questions — duration, pattern (continuous vs. intermittent), associated chills/sweating, recent travel or exposure — before general complaint questions.
- **Elevated blood pressure:** Add branch for headache, vision changes, chest pain, known hypertension history/medication adherence.
- **Abnormal pulse (high/low):** Branch into palpitations, dizziness, fainting history.
- **Low weight relative to history (if prior visit data exists):** Branch into appetite, weight loss duration, associated GI symptoms.
- **On-demand exam findings (e.g., palpation result = tenderness in lower right abdomen):** Immediately re-prioritize toward appendicitis-relevant questions (nausea, vomiting, pain migration pattern) rather than continuing the original question order.

These rules determine question *priority and depth*, not hard gating — the voicebot still lets the patient's stated complaint drive the primary thread; vitals reorder and weight the branches around it.

### 1.3 Diagnostic Summary Generation
Once the conversation is complete, the system automatically compiles a single diagnostic report combining:
- Previous medical reports and visit history (if available locally — see 6.3 for the offline/unreconciled case)
- Current prescriptions / medications in progress
- The full transcript of the current voicebot conversation
- Any nurse-entered test results from this visit

This becomes the structured diagnostic summary sent to the doctor. See 7.4 for the `DiagnosticReport` entity schema.

### 1.7 Urgency Indicator (Lightweight Severity Signal) — RESOLVED
- **Purpose:** Surface a simple, visible urgency signal on the diagnostic summary so a doctor scanning the waiting-room queue (2.1) can see at a glance which patients may need faster attention — without building a full emergency-severity scoring engine.
- **Not an ESI clone.** This is a lightweight extension of logic Vaidhya already has, not a new triage subsystem. It reuses the same vitals-driven branching rules from 1.2.2 that already flag "higher-urgency" during question branching — this section just makes that internal signal visible as output.
- **Mechanism — count-based tiering (finalized):** Each rule in the 1.2.2 / 7.6 rules table that fires produces one "flag." The urgency tier is a pure function of flag count, independent of which specific vital triggered it:
  - **0 flags → Routine**
  - **1 flag → Elevated**
  - **2+ flags → Urgent**
  - This is deliberately simple (no per-vital severity weighting) so it stays a transparent, auditable presentation-layer read of existing branching flags — not a scoring model. A clinician can review/adjust the flag-count thresholds later without needing to touch branching logic.
- **Where it shows:**
  - On the diagnostic summary itself, as a short label with the flags that drove it (e.g., "Elevated — low SpO2 (91%)").
  - On the doctor's waiting-room queue (2.1), as a visual tag next to each waiting patient. Doctor-initiated pickup is unchanged — this only informs the choice, it doesn't auto-assign or reorder the queue.
- **Explicit scope boundary:** Does not replace clinical judgment, does not auto-triage, does not gate doctor access to any patient.
- See 7.5 for the `UrgencyTier` computation as part of `DiagnosticReport`.

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

**MQTT dropout mid-consult (resolved):** if the patient side loses connection during an active MQTT-text session, the edge-side client queues any in-flight doctor question locally (not lost) and the session auto-resumes on reconnect using the same `consultation_id` — no restart, no requeue. See 8.3 for the MQTT topic/payload schema and 9.3 for the full connection state machine, including the reconnect window and eventual timeout-to-requeue fallback if reconnection doesn't happen within a bounded time.

### 1.5 Prescription Delivery
- The doctor reviews the diagnostic report (and any follow-up answers) and issues a prescription.
- The final prescription is sent back to the patient as text, viewable and printable in the patient portal.
- See 7.7 for the `Prescription` entity and 1.6 below for pharmacy routing.

### 1.6 Additional Patient Portal Pages
- **Medical Summary & History:** Calendar/timeline-based view of past visits. Each visit shows the summary of what happened and what medications were prescribed at that time.
- **Account Settings:** Manage/update patient account details.
- **Nearby Medicine Lookup (pharmacy routing, resolved):** Once a prescription is issued, the patient portal shows nearby pharmacies with stock status per prescribed medicine (full list, not single best-match — see 3.6). **The patient selects a pharmacy from this list**, and that selection is the action that routes the prescription into that specific pharmacy's incoming queue (3.3). There is no broadcast-to-all-pharmacies behavior — exactly one pharmacy receives the prescription, chosen by patient action. See 8.2 for the routing API call and 7.7 for how `Prescription.pharmacy_id` is set.

---

## 2. Doctor Portal

### 2.0 Login (new in v5 — gap closed)
- Doctors are registered/onboarded accounts (unlike patients, doctors are known system users, not walk-ins) — standard credential login: **phone number + password**, with password reset via OTP to that phone number (reuses the same OTP mechanism as 1.1, no separate SMS integration needed).
- Each doctor account has one or more `serves_jurisdiction_ids` (7.12) — the village jurisdictions they're eligible to receive patients from. A city-based doctor is not tied to a single village; they can be assigned multiple rural jurisdictions.
- **Queue scope (resolved):** the waiting-room queue (2.1) a doctor sees is filtered to visits whose `Visit.edge_jurisdiction_id` is in that doctor's `serves_jurisdiction_ids` — not a single global queue across all doctors/jurisdictions. This matches the platform's model of doctors being assigned to (rather than randomly matched with) specific rural catchments. For the hackathon demo, seed data can simply assign every demo doctor to every demo jurisdiction if a single unified queue is more convenient to showcase — that's a seed-data choice, not a schema change.

### 2.1 Waiting Room / Queue
- Once a patient finishes their AI voicebot conversation and the diagnostic summary is generated, the patient is placed into a doctor's waiting room/queue.
- Doctors see a list of all available/waiting patients, each tagged with its urgency indicator (1.7).
- A doctor can view any patient's diagnostic report before deciding, and selects which patient to connect to next (doctor-initiated pickup, not automatic assignment).

**Concurrent pickup (resolved):** if two doctors attempt to pick up the same waiting patient at nearly the same moment, this is handled as **optimistic locking, first-click-wins**: the first pickup request to reach the backend atomically claims the patient (queue entry transitions `waiting → claimed`); any subsequent pickup attempt for that same patient fails with a non-destructive "already picked up by another doctor" response, and that doctor's queue view refreshes to remove the entry. No queue reordering or silent failure — the second doctor gets explicit, immediate feedback. See 9.4 for the full state machine and 8.1 for the API contract (conditional update / compare-and-swap semantics).

### 2.2 Connection Establishment
- On selecting a patient, the doctor is connected via whichever mode is available: video, audio, or MQTT-text (same cascading logic as the patient side).

### 2.3 Consultation
- Doctor reviews the diagnostic summary alongside the patient's past records.
- In video/audio mode: doctor asks follow-up questions directly to the patient.
- In MQTT-text mode: doctor submits follow-up info requests through the portal; these route through the patient's AI voicebot (see 1.4) and return as text.
- Doctor tracks currently active medications and any new prescription given during the visit.

### 2.4 Prescription
- Doctor issues final prescription/instructions, sent back to the patient as text.
- Before finalizing, the doctor may consult the "check nearby stock" panel (3.5) — informational only; it does not block or gate prescription issuance even if stock shows unavailable everywhere.

---

## 3. Pharmacist Portal

A standalone portal for local pharmacy staff, distinct from the Patient and Doctor portals. Its core purpose is to let a pharmacy maintain its own stock and billing records — which in turn feeds two other flows: the patient's "find nearby medicine" lookup (1.6) and the doctor's pre-prescription stock check (2.4/3.5). The pharmacy's own stock/billing tools are the primary function; visibility into that data elsewhere in the system is a byproduct of keeping it current.

### 3.1 Login
- Local pharmacy staff authenticate via phone number, consistent with the patient portal's lightweight auth pattern (including OTP fallback per 1.1).
- Each pharmacy is its own account/tenant — this is not a centralized back-office model. See 7.8 for the `Pharmacy` entity.

### 3.2 Stock Management
- Pharmacist adds, updates, or removes medicines and on-hand quantities.
- Items can be flagged low-stock or out-of-stock.
- This is the data source that both the patient-side nearby-medicine lookup and the doctor-side stock-check panel read from. See 7.9 for the `StockItem` entity.

### 3.3 Incoming Prescription Queue
- Prescriptions routed to this pharmacy (via the patient's pharmacy selection, per 1.6) appear in a queue.
- Pharmacist marks each as pending or fulfilled as patients come to collect medicine.

### 3.4 Billing
- When a patient collects a prescribed medicine, the pharmacist generates a bill/invoice.
- Basic sales record, tied to the fulfilled prescription. See 7.10 for the `Bill` entity.

### 3.5 Feed Into Doctor Portal — "Check Nearby Stock" Panel
- Before finalizing a prescription (2.4), the doctor can open a separate "check nearby stock" panel.
- The doctor searches a medicine and sees nearby pharmacies with their stock status, pulled from pharmacist-maintained data.
- This is a distinct panel/modal, not inline in the prescription form itself.

### 3.6 Feed Into Patient Portal — Nearby Medicine Lookup
- Once a patient has a prescription, the patient portal shows a list of nearby pharmacies with stock status (in stock / low / out) for each prescribed medicine.
- Not a single best-match recommendation — the patient sees the full list and status per pharmacy, and **selecting one routes the prescription to that pharmacy's queue** (see 1.6, resolved).
- Includes a mock "request delivery" action per pharmacy — simulates coordination for the demo; no real courier/logistics integration.

### 3.7 Demo Scope
- For the hackathon, pharmacy stock is **seeded/mock inventory** — a small seeded dataset of local pharmacies with mock stock levels, consistent with the seeded-data approach used for the public health analytics dashboard (5.2). No real pharmacy integration.
- The portal itself (login, stock CRUD, prescription queue, billing) should still be built and functional against that seeded/session data — it's the surrounding pharmacy-integration network (real partner pharmacies, real-time sync) that's mocked, not the portal UI/logic.

---

## 4. Cross-Cutting System Notes

### Unified Patient History / Data Security
- Encrypted data storage linked to the central ABHA ID database.
- History displayed in calendar-like or infinite-scroll format, grouped by visit.
- See Section 6 for how history availability differs for local-village patients vs. visiting/out-of-jurisdiction patients.

### Nurse-Assisted Diagnostics
- Nurse performs basic, locally feasible physical assessments at the voicebot's request during the patient's session (no advanced scans like MRI/X-ray, which the system explicitly avoids ordering).
- See 1.2 for the full two-pass vitals/exam-findings model and 1.2.2 for how vitals drive the voicebot's question branching.

### Visual Symptom Capture
- For visual conditions (e.g., skin rashes), the AI captures a still image via webcam and generates a medical text description to append to the diagnostic report, since live video streaming for this purpose isn't reliable.
- **Trigger mechanism (resolved):** voicebot-initiated, same pattern as an on-demand exam finding (1.2). When the patient's stated complaint matches a visual-symptom category (e.g., rash, swelling, visible discoloration — matched via the same rules-table mechanism as 7.6, using a `trigger_vital_or_finding` value like `complaint_category:visual`), the voicebot verbally asks the nurse to position the affected area in front of the shared webcam and prompts a **portal-side "Capture" button** (part of the same nurse-facing input mechanism referenced in 1.2.1) — the nurse clicks it once framed. This follows the same 90s/90s timeout-and-proceed pattern as other on-demand findings (1.2, 9.2) if the nurse doesn't act.

### Secondary / Advanced Modules

All three secondary modules below are in scope to fully build for the demo (not mocked).

#### 5.1 Agentic AI Decision Support (Virtual Sub-Specialists)
- **Purpose:** Assist general MBBS doctors in the doctor portal with expert-level input on complex/emergency cases across Cardiology, Thoracic Medicine, Neurology, and Ophthalmology.
- **Interaction model: doctor-triggered advisory panel.** The doctor stays in control — on any patient case, the doctor can click "Consult Specialist AI," select the relevant specialty, and receive an advisory opinion/diagnostic insight injected into their portal view. This is not automatic/proactive flagging.
- **Backend approach (Phase 1, hackathon-scoped):** A single underlying LLM (cloud-hosted) with a distinct system prompt and specialty-specific context/knowledge per sub-specialist. Each "specialist" is a prompt configuration, not a separate agent.
- **Upgrade path (Phase 2, time permitting):** Migrate to a true multi-agent framework (LangGraph or CrewAI), where each specialist becomes a distinct agent node with its own tools/retrieval. Stretch goal, not required for demo readiness.
- **Case data passed to the advisory call:** the full diagnostic report (history, transcript, vitals) is sent as-is — no doctor-curated excerpt step.
- **Prompt/context design per specialty (resolved):** each specialty prompt configuration follows one shared template with specialty-specific slots filled in, so all four are structurally consistent and any future specialty is just a new config, not new code:
  - **Role framing:** "You are a virtual [specialty] sub-specialist advising a general MBBS doctor in a rural Indian telemedicine setting. You do not have direct patient contact."
  - **Specialty focus lens:** a short bullet list of what this specialty should weight most heavily from the report (e.g., Cardiology → BP/pulse trends, chest pain descriptors, exertional patterns; Neurology → headache character, vision/motor/sensory complaints, consciousness/orientation cues; Thoracic Medicine → SpO2, respiratory rate, cough/breathlessness pattern; Ophthalmology → visual symptom capture description, eye-specific complaints).
  - **Input:** the full `DiagnosticReport` object (7.4), passed verbatim.
  - **Required output schema:** see 5.5 below — confidence, evidence trace, decision trace, plain-language opinion, all as structured fields (see 8.4 for the exact JSON schema).
  - **Explicit non-goal instruction in every specialty prompt:** "You are advisory only. Do not issue a prescription or final diagnosis — provide an opinion for the treating doctor's judgment."
- **Explainability:** every advisory opinion returned by this module includes a confidence score and evidence trace — see 5.5 for the full mechanism.

#### 5.2 Regional Predictive Public Health Analytics
- **Purpose:** Aggregate anonymized patient data across villages/cities/states to identify potential pandemic/endemic patterns early.
- **Demo approach: live dashboard from seeded data.** Real dashboard (charts/maps) rendering simulated aggregated case data across multiple villages/regions, with at least one anomaly/spike deliberately seeded and visually highlighted.
- **Seed dataset scope:** 10+ regions, 3-4 disease categories, several months of data, with at least one clear anomaly/spike seeded in.
- **Visualization approach: both.** A map view for regional overview (color-coded intensity, spike region highlighted geographically) plus chart views (time-series trends) for drill-down per region/disease.
- **Anomaly definition (resolved):** deterministic threshold rule — for each region/disease combination, compute a rolling baseline (e.g., trailing 4-week average case count). Any data point where **case count exceeds 2x that rolling baseline** is flagged as an anomaly and visually highlighted (distinct color/marker on both map and chart views). This is computed once against the seed dataset ahead of the demo (not live ML inference), but the *rule* itself is real and reproducible — see 7.11 for the `RegionalCaseCount` entity and the anomaly-flag computation.
- **Longer-term note:** a real ML pipeline (anomaly detection/clustering on live data) remains the eventual production goal; the seeded dashboard with a deterministic threshold rule is the hackathon-appropriate stand-in.

#### 5.3 Patient Engagement & Outreach (IVR/SMS)
- **Purpose:** Automated medication reminders and doctor-requested follow-up reminders reaching patients who may not have smartphone/data access.
- **Demo approach: real integration**, so the demo can trigger an actual SMS or IVR call to a real phone live during the presentation.
- **Provider: Twilio.**
- **Architectural placement (resolved, ties to Section 6):** Twilio calls are made **only by the central server**, never by the village-edge device. This follows directly from the two-tier topology (6.1): the edge device serves one village's local patients and may be offline for extended periods; the central server holds the full regional patient database and is the only component with reliable, continuous connectivity suited to a third-party API dependency like Twilio. Concretely: the edge device syncs prescription/follow-up-flag data up to the central server whenever connectivity allows (6.2); the central server is what actually evaluates trigger conditions and calls Twilio.
- **Trigger conditions (resolved):**
  1. **On prescription sync to central:** once a new `Prescription` record reaches the central server (via edge→central sync, 6.2), the central server sends an immediate SMS medication summary to the patient's phone number.
  2. **Scheduled follow-up:** if the doctor flagged a follow-up need on the prescription (`Prescription.follow_up_requested = true`, 7.7), the central server schedules a follow-up SMS/IVR call for a configurable interval later (default 48h) and fires it independently of the edge device's connectivity state at that later time.
  - Both triggers live entirely in central-server logic — the edge device has no Twilio dependency and does not need connectivity at reminder-send time, only at the earlier sync-up moment. See 8.5 for the trigger/schedule API shape.

#### 5.4 Integrated Pharmacy & Inventory Management
- Superseded by the full **Pharmacist Portal** (Section 3).

#### 5.5 Explainability Layer (Specialist Consult & Diagnostic Summary) — RESOLVED
- **Purpose:** Give the doctor a visible reason to trust (or question) an AI-generated opinion, rather than a bare recommendation.
- **Scope decision:** text-based confidence + evidence trace, not a visual saliency/attention-heatmap stack — Vaidhya's inputs are conversational/vitals-based, not deep-imaging-based.
- **What's returned alongside every specialist advisory opinion:**
  - **Confidence score:** self-reported High / Medium / Low from the specialist LLM call.
  - **Evidence trace:** short list of which specific inputs (symptoms, vitals, transcript excerpts, exam findings) the opinion was primarily based on, as plain-language bullet points.
  - **Decision trace:** one or two lines on the reasoning path.
- **Mechanism:** achieved through prompt design on the existing specialist LLM call from 5.1 — no separate explainability model or pipeline.
- **Applied to 1.7:** the urgency indicator's driving flags are themselves a minimal evidence trace.
- **Structured-output schema (resolved):** JSON, not formatted free text — machine-parseable so the doctor portal can render each field distinctly rather than parsing prose. See 8.4 for the exact schema (`confidence`, `evidence_trace[]`, `decision_trace`, `opinion_text` fields), used identically by all four specialty prompt configs from 5.1.

---

## 6. Data Topology (New in v5)

### 6.1 Target Production Architecture: Two-Tier Edge + Central
Vaidhya's real-world deployment target is a **two-tier system**, not a single centralized backend:

- **Village Edge Server:** deployed locally at (or near) each village health center. Holds the full patient record set for patients local to that jurisdiction — vitals, visit history, transcripts, prescriptions — available with zero dependency on internet connectivity. This is what makes the platform genuinely offline-capable rather than "offline-tolerant."
- **Central Regional Server:** cloud-hosted, holds the aggregate patient database for the entire geographical region (all villages). Responsible for: cross-village patient record availability (a patient traveling outside their home village), regional public health analytics (5.2), and all outbound Twilio IVR/SMS (5.3).
- **Sync relationship:** the edge server pushes newly-created/updated records (visits, vitals, prescriptions) to the central server whenever a connection is available; the central server pushes relevant record updates back down to edge servers (e.g., a traveling patient's record download, pharmacy network updates). This is **two-way sync** (6.2), not one-way telemetry.

### 6.2 Sync Behavior
- **Direction:** two-way. Edge → central: visit records, vitals, diagnostic reports, prescriptions, as they're created. Central → edge: patient record downloads for visiting/traveling patients (6.3), pharmacy network stock updates, any centrally-issued account changes.
- **Frequency/trigger:** opportunistic — sync attempts whenever the edge device detects a usable connection; no fixed schedule requirement for the hackathon build. Failed sync attempts are queued and retried on next connectivity check.
- **Conflict handling (target architecture, not required for demo):** last-write-wins at the field level for non-clinical fields (e.g., account settings); clinical records (visits, prescriptions) are treated as append-only/immutable once created, so conflicts are structurally avoided — a visit record created at the edge is a new record on sync, never a merge/overwrite of an existing one.

### 6.3 Out-of-Jurisdiction Patient, Offline at Point of Care (resolved)
When a patient visits a village health center outside their home jurisdiction and the edge device has no connectivity at that moment (record can't be downloaded from central):
- The intake proceeds as a **new local record** — the voicebot/nurse are informed history is unavailable for this session, and intake proceeds without prior-visit context (1.2.2 branching still applies using this visit's own vitals).
- The visit record is tagged `unreconciled: true` and stamped with the patient's identity as captured at login (ABHA ID / phone, per 1.1).
- Once the edge device regains connectivity and syncs with central, the central server reconciles the `unreconciled` record against the patient's real central record (matched by ABHA ID or phone number), merging it into their full history. This reconciliation is append-only — the local visit record itself is never discarded or altered, only linked.
- See 7.2 for the `unreconciled` field on `Visit`.

### 6.4 Hackathon Demo Scope (explicit simplification)
Building and demoing real two-node sync within a 20-hour hackathon window is not a good time investment — it would consume most of the build budget for a mechanism that's invisible in a live demo (sync happening in the background isn't a compelling visual). **Decision:**
- The demo build uses **one backend/database**, not two physical nodes.
- That single backend **simulates the edge/central distinction with a scope flag** on relevant queries/records (e.g., a `jurisdiction_id` or `is_local_to_current_edge` marker) rather than a real separate deployment — this is enough to demonstrate the *behavior* (e.g., "this patient's record wasn't available locally, here's the unreconciled-then-merged flow") without building actual distributed infra.
- Section 5.3 (IVR/SMS)'s "central server only" framing still holds logically in the demo build — it just means the single backend's Twilio-calling code path is conceptually the "central" responsibility, even though it's the same process as everything else.
- This section (6) documents the *target* architecture so the design reads as intentional and production-minded; 6.4 is the one explicit place where the demo build is allowed to diverge from it, and it should be called out as such in any README/build notes so nobody mistakes the demo simplification for the final design.

### 6.5 OTP Delivery When Edge Device Is Offline
Phone + OTP is the universal login fallback (1.1), but OTP delivery itself typically requires connectivity (SMS gateway call). For the offline case:
- If the edge device has connectivity, OTP is sent via the same Twilio integration used for 5.3 (though triggered locally in the demo's single-backend build, per 6.4 — in the target architecture this would also route through central).
- If the edge device is fully offline at login time, fall back to **nurse-assisted manual verification**: the nurse confirms patient identity by locally-held ID/knowledge and manually authorizes session start; the session is flagged `identity_unverified_offline: true` for later reconciliation, same mechanism as 6.3. This prevents total login failure from blocking care in a fully offline scenario, which would otherwise defeat the platform's core purpose.

---

## 7. Data Model (New in v5)

Field types are given generically (string / number / enum / boolean / timestamp / reference / array / object) — an implementing agent should map these to whatever DB/ORM the chosen stack uses. `ref → X` means a foreign-key-style reference to entity X.

### 7.0 Jurisdiction
Referenced by `Patient.home_jurisdiction_id`, `Visit.edge_jurisdiction_id`, `Pharmacy.jurisdiction_id`, and `Doctor.serves_jurisdiction_ids` below — defined here explicitly since multiple entities FK into it.
| Field | Type | Notes |
|---|---|---|
| `jurisdiction_id` | string (PK) | represents one village/edge-server catchment area |
| `name` | string | e.g. village/block name |
| `latitude` / `longitude` | number | centroid — used as the basis for "nearby" calculations (7.8) |
| `edge_server_id` | string, nullable | which physical/logical edge deployment serves this jurisdiction (6.1); null in the single-backend demo build (6.4), where this is just a scope-tag, not a real deployment pointer |

**"Nearby" definition (resolved):** for both 1.6 (patient's nearby-pharmacy lookup) and 3.5 (doctor's stock-check panel), "nearby" means **pharmacies whose `Pharmacy.jurisdiction_id` matches the patient's `home_jurisdiction_id`, or is within a configurable straight-line radius (default 15km) of that jurisdiction's lat/long**, computed via haversine distance on `Jurisdiction.latitude/longitude`. This is a deliberately simple radius check, not a routing-distance/maps-API call — sufficient for demo-scale seeded pharmacy data (3.7).

### 7.1 Patient
| Field | Type | Notes |
|---|---|---|
| `patient_id` | string (PK) | |
| `abha_id` | string, nullable | |
| `phone_number` | string | required, used for OTP fallback |
| `fingerprint_hash` | string, nullable | |
| `name` | string | |
| `dob` / `age` | date or number | |
| `sex` | enum | |
| `home_jurisdiction_id` | ref → Jurisdiction | which village/edge this patient is "local" to |
| `created_at` | timestamp | |

### 7.2 Visit
| Field | Type | Notes |
|---|---|---|
| `visit_id` | string (PK) | |
| `patient_id` | ref → Patient | |
| `edge_jurisdiction_id` | ref → Jurisdiction | where this visit physically happened |
| `status` | enum | `intake_in_progress`, `awaiting_doctor`, `in_consult`, `completed`, `cancelled` |
| `unreconciled` | boolean | true if created offline for an out-of-jurisdiction patient (6.3) |
| `consultation_id` | string | **equal to `visit_id`** once a doctor connection is established — no separate ID space. The MQTT topic namespace (8.3) and 9.3's state machine both key off this same value. Set at the moment `Visit.status` transitions to `in_consult` (8.1). |
| `created_at` / `completed_at` | timestamp | |

### 7.3 VitalsReading / ExamFinding
| Field | Type | Notes |
|---|---|---|
| `reading_id` | string (PK) | |
| `visit_id` | ref → Visit | |
| `type` | enum | `temperature`, `bp_systolic`, `bp_diastolic`, `pulse`, `spo2`, `respiratory_rate`, `weight`, or exam-finding types (`palpation`, `visual_observation`, `other`) |
| `phase` | enum | `pass_one_baseline`, `on_demand` |
| `value_numeric` | number, nullable | for structured vitals |
| `value_text` | string, nullable | for free-text exam findings |
| `requested_at` / `entered_at` | timestamp | used for the 90s/90s timeout logic (1.2) |
| `status` | enum | `entered`, `not_obtained` (timed out per 1.2) |

### 7.4 DiagnosticReport
| Field | Type | Notes |
|---|---|---|
| `report_id` | string (PK) | |
| `visit_id` | ref → Visit | |
| `transcript` | array of `{speaker, text, timestamp}` | full Pass Two conversation |
| `vitals_snapshot` | array of ref → VitalsReading | **all** readings for this visit, including any with `status: not_obtained` (7.3) — included so the doctor can see what was attempted-but-unavailable, not just successful readings. `not_obtained` readings are excluded from urgency-flag eligibility (7.6 rules can't fire on a null value), but they remain visible on the report. |
| `prior_history_summary` | object, nullable | null either because this is genuinely the patient's first-ever visit, or because it's an `unreconciled` visit (6.3) with no local history at intake time — the two cases are **not** distinguished on the report itself; use `Visit.unreconciled` as the disambiguating signal when rendering ("history unavailable at time of visit" vs. "no prior visits on record"). **Note:** if a visit is later reconciled (6.3), past `DiagnosticReport` records are not retroactively rewritten — reconciliation only links/merges the `Visit` and `Patient` records; historical reports remain a frozen snapshot of what was known at the time, by design (append-only, per 6.2). |
| `visual_symptom_description` | string, nullable | generated text from webcam still (Section 4) |
| `urgency_tier` | ref → 7.5 | |
| `generated_at` | timestamp | |

### 7.5 UrgencyTier (computed, embedded in DiagnosticReport)
| Field | Type | Notes |
|---|---|---|
| `tier` | enum | `routine`, `elevated`, `urgent` — per count-based rule in 1.7 |
| `flags` | array of `{rule_id, description}` | which 7.6 rules fired; `description` is the human-readable driver shown on the summary (e.g. "low SpO2 (91%)") |
| `flag_count` | number | drives the tier per 1.7's thresholds |

### 7.6 BranchingRule (the "rules table" referenced in 1.2.2 / 1.7)
| Field | Type | Notes |
|---|---|---|
| `rule_id` | string (PK) | |
| `trigger_vital_or_finding` | string | e.g. `spo2`, `bp_systolic`, `exam:palpation.rlq_tenderness` |
| `condition` | string | a **comparison-operator + value pair only** (e.g. `<90`, `>=180`, `==true` for boolean exam findings) — deliberately not a general expression language. Parse with a fixed set of operators (`<`, `<=`, `>`, `>=`, `==`, `!=`) against `value_numeric` or `value_text`/boolean equivalents on the matching `VitalsReading`/`ExamFinding`. No eval(), no embedded scripting — this keeps the rules table safely data-editable (e.g. by a clinician via a future admin UI) without code execution risk. |
| `question_branch_tags` | array of string | which question-tree branches this activates/deepens |
| `urgency_flag` | boolean | whether this rule contributes to 1.7's flag count |
| `active` | boolean | allows disabling a rule without deleting it |

### 7.7 Prescription
| Field | Type | Notes |
|---|---|---|
| `prescription_id` | string (PK) | |
| `visit_id` | ref → Visit | |
| `doctor_id` | ref → Doctor | |
| `medications` | array of `{name, dosage, duration, instructions}` | |
| `follow_up_requested` | boolean | drives 5.3 scheduled reminder trigger |
| `pharmacy_id` | ref → Pharmacy, nullable | set when patient selects a pharmacy (1.6); null until then |
| `issued_at` | timestamp | |

### 7.8 Pharmacy
| Field | Type | Notes |
|---|---|---|
| `pharmacy_id` | string (PK) | |
| `name`, `location` | string | |
| `phone_number` | string | login credential (3.1) |
| `jurisdiction_id` | ref → Jurisdiction | for "nearby" filtering |

### 7.9 StockItem
| Field | Type | Notes |
|---|---|---|
| `stock_item_id` | string (PK) | |
| `pharmacy_id` | ref → Pharmacy | |
| `medicine_name` | string | |
| `quantity` | number | |
| `status` | enum | `in_stock`, `low`, `out_of_stock` — derived from quantity thresholds or manually set |

### 7.10 Bill
| Field | Type | Notes |
|---|---|---|
| `bill_id` | string (PK) | |
| `prescription_id` | ref → Prescription | |
| `pharmacy_id` | ref → Pharmacy | |
| `line_items` | array of `{medicine_name, quantity, unit_price}` | |
| `total` | number | |
| `created_at` | timestamp | |

### 7.11 RegionalCaseCount (for 5.2)
| Field | Type | Notes |
|---|---|---|
| `region_id` | string | |
| `disease_category` | enum | 3-4 seeded categories |
| `week_start_date` | date | |
| `case_count` | number | |
| `rolling_baseline` | number | trailing 4-week avg, precomputed for seed data |
| `is_anomaly` | boolean | `case_count > 2 * rolling_baseline` (5.2, resolved) |

### 7.12 Doctor
| Field | Type | Notes |
|---|---|---|
| `doctor_id` | string (PK) | |
| `name`, `specialty_general` | string | general MBBS, not the 5.1 sub-specialties |
| `phone_number` | string | login credential (2.0) |
| `password_hash` | string | |
| `serves_jurisdiction_ids` | array of ref → Jurisdiction | which village catchments this doctor's queue includes (2.0) |

---

## 8. Cross-Portal API & Event Contracts (New in v5)

Transport-agnostic (REST/GraphQL/RPC — implementer's choice), but the shape and semantics below are fixed.

### 8.1 Doctor Queue Pickup (concurrency-safe)
`POST /queue/{visit_id}/claim`
- Request: `{doctor_id}`
- Server behavior: **conditional update** — succeeds only if `Visit.status == 'awaiting_doctor'`; atomically transitions to `in_consult` and sets `Visit.claimed_by_doctor_id`. This is the compare-and-swap semantics referenced in 2.1.
- Response (success): `200 {visit_id, status: 'in_consult'}`
- Response (already claimed): `409 {error: 'already_claimed', claimed_by: <doctor_id>}` — client shows "already picked up by another doctor" and refreshes queue.

### 8.2 Pharmacy Routing
`POST /prescriptions/{prescription_id}/route`
- Request: `{pharmacy_id}` (chosen by patient from the nearby-stock list, 1.6)
- Server behavior: sets `Prescription.pharmacy_id`, creates the corresponding entry in that pharmacy's incoming queue (3.3).
- Constraint: fails with `409` if `pharmacy_id` is already set (a prescription routes to exactly one pharmacy, no re-routing in v1 — a cancel/re-route flow is out of scope for the demo).

### 8.3 MQTT Topic & Payload Schema (flagship mode, 1.4)
Topic structure, namespaced per consultation session:
- `vaidhya/consult/{consultation_id}/doctor_to_patient` — doctor's follow-up info requests
- `vaidhya/consult/{consultation_id}/patient_to_doctor` — voicebot-relayed patient answers
- `vaidhya/consult/{consultation_id}/status` — connection status heartbeat (`connected`, `patient_disconnected`, `reconnected`)

Payload (both directions):
```
{
  "consultation_id": "string",
  "message_id": "string (uuid, for de-dup on reconnect)",
  "sender": "doctor" | "patient_voicebot",
  "text": "string",
  "timestamp": "ISO8601"
}
```
- **QoS:** at-least-once delivery (MQTT QoS 1) — `message_id` is used client-side to de-duplicate on redelivery after reconnect.
- **Dropout handling (resolved, ties to 1.4/9.3):** on `patient_disconnected`, the doctor-side client keeps any unsent/unacknowledged `doctor_to_patient` message queued locally, retrying publish on an interval. On the patient/edge side, the voicebot queues any received-but-unprocessed doctor question in local session state and resumes processing once the local MQTT client reconnects and publishes `status: reconnected`. If no reconnect occurs within **10 minutes**, the session times out: `Visit.status` reverts to `awaiting_doctor` (requeued, per the 9.3 state machine) and the doctor is notified the session ended.

### 8.4 Specialist Advisory Response Schema (5.1 / 5.5, resolved)
Every specialist LLM call (all four specialties, same schema) returns:
```
{
  "specialty": "cardiology" | "thoracic_medicine" | "neurology" | "ophthalmology",
  "confidence": "high" | "medium" | "low",
  "evidence_trace": ["string", "string", ...],
  "decision_trace": "string (1-2 sentences)",
  "opinion_text": "string (the advisory opinion itself)"
}
```
This is enforced via structured output / JSON mode on the LLM call (implementer's choice of function-calling, JSON-mode, or strict prompt + validation, depending on chosen LLM provider). The doctor portal renders each field as a distinct UI element, not parsed prose.

### 8.5 IVR/SMS Trigger (5.3, resolved — central-server-only)
Internal (server-side) triggers, not patient/doctor-facing API, but specified for implementation clarity:
- `on_prescription_synced(prescription)` → fires immediate SMS using `medications` summary from 7.7.
- `schedule_follow_up(prescription, delay_hours=48)` → if `follow_up_requested == true`, enqueues a delayed job; on firing, sends SMS/IVR call regardless of edge device connectivity state at that time (central server only depends on its own uptime, not the edge's).
- Both call into the same Twilio client; in the demo's single-backend build (6.4) this is just a code-path distinction, not a separate service.

---

## 9. Key State Machines (New in v5)

### 9.1 Patient Login
`unauthenticated → [ABHA lookup | fingerprint match | phone+OTP] → authenticated → session_active`
- Any path failure falls through to the next available method; phone+OTP is the guaranteed-available terminal fallback (1.1).
- If edge device is offline and OTP can't be delivered: `authenticated_offline_unverified` (6.5) — session proceeds, flagged for later reconciliation.

### 9.2 Intake Session (Two-Pass + On-Demand, 1.2)
`created → pass_one_baseline_pending → pass_one_complete → pass_two_conversation_active → [on_demand_request_pending ⇄ pass_two_conversation_active]* → intake_complete → report_generated`
- `on_demand_request_pending` sub-states: `requested (t=0) → reminder_sent (t=90s) → [entered → back to pass_two_conversation_active] | [not_obtained (t=180s) → back to pass_two_conversation_active with finding marked not_obtained]` — this is the timeout logic specified in 1.2.

### 9.3 MQTT-Text Consultation Session (1.4 / 8.3)
`connected → [patient_disconnected → reconnect_window_active → reconnected (resume, same consultation_id)] | [patient_disconnected → reconnect_window_expired (10min) → session_timed_out → visit requeued to awaiting_doctor]`

### 9.4 Doctor Queue Pickup (2.1 / 8.1)
`awaiting_doctor → [doctor A claims: succeeds] → in_consult (claimed_by=A)`
`awaiting_doctor → [doctor B claims concurrently: fails 409] → remains awaiting_doctor, doctor B notified already_claimed`

---

## 10. Error Handling & Offline Behavior Summary (New in v5)

A consolidated view — each row references the section where it's specified in full:

| Scenario | Behavior | Spec ref |
|---|---|---|
| Nurse doesn't enter requested on-demand finding | Two 90s reminder cycles, then proceed with `not_obtained` | 1.2, 9.2 |
| Two doctors claim same patient | First-click-wins, compare-and-swap, loser gets explicit error | 2.1, 8.1, 9.4 |
| MQTT session drops mid-consult | Local queuing both sides, auto-resume on reconnect, 10-min timeout → requeue | 1.4, 8.3, 9.3 |
| Out-of-jurisdiction patient, edge offline | Proceed as new local record, tag `unreconciled`, merge on later sync | 6.3, 7.2 |
| Patient has no ABHA ID / fingerprint fails | Phone + OTP universal fallback | 1.1, 9.1 |
| Edge device fully offline at login (OTP undeliverable) | Nurse-assisted manual verification, flagged `identity_unverified_offline` | 6.5, 9.1 |
| Prescription needs pharmacy routing | Patient selects one pharmacy from nearby-stock list; routes to exactly that pharmacy's queue | 1.6, 8.2 |
| Doctor checks stock, all pharmacies out | Informational only — does not block prescription issuance | 2.4 |

---

## Open Items / To Reconcile

**All items from v4 are now resolved** (urgency tier thresholds, IVR trigger conditions and architectural placement, anomaly definition, explainability schema, network-mode-cascade demo scope). All net-new gaps identified during the v5 pass — including a self-review specifically checking whether this doc is complete enough for a coding agent to build from without inventing product decisions — are also resolved above: the missing `Jurisdiction` entity (7.0), doctor login/auth (2.0), the `consultation_id`↔`visit_id` link (7.2), "nearby" pharmacy radius logic (7.0), the rules-table condition-language spec (7.6), voicebot language/locale (1.2), and the visual-symptom-capture trigger mechanism (Section 4) have all been closed.

Remaining true open items — narrow, and appropriately deferred to build time or post-hackathon:
- **Real network-quality detection** for the video → audio → MQTT-text cascade (demo uses a manual toggle; real WebRTC-stats-based detection is future scope — unchanged from v4).
- **Real multi-node edge/central sync** (6.4) — deliberately deferred past the hackathon; demo simulates the distinction within a single backend.
- **Multi-language runtime voicebot support** — demo build is single-language (config-time choice, 1.2); matching each patient's actual regional language at runtime is real production scope, not built for the demo.
- **Tech stack selection** (framework, DB, MQTT broker, LLM provider/SDK, STT/TTS provider) — intentionally left to the implementing agent/team, per this session's scope decision; nothing above should block on that choice since all contracts (Section 8) are transport-agnostic.
- **Exact OTP delivery provider config and rolling-baseline window tuning for 5.2** (currently specified as "4-week trailing average" as a reasonable default) — safe to leave as a tunable constant rather than a blocking decision.

### Honest Scope Flag (new in v5 — not resolved, deliberately surfaced instead)
A self-review pass (having a fresh reviewer read this doc cold, as a coding agent would) flagged that the declared in-scope build list is large for a 20-hour window: three full portals (Patient/Doctor/Pharmacist), a voicebot with STT/TTS + dynamic branching engine + rules table, MQTT pub/sub with reconnect/dedup logic, four LLM specialist prompts with structured JSON output, a seeded public-health dashboard with map + chart views and anomaly computation, and live Twilio SMS/IVR — with Section 4's preamble explicitly stating all three secondary modules are "in scope to fully build for the demo (not mocked)." This is realistically closer to a multi-week build than a 20-hour one if every surface is built to the depth this doc specifies (e.g., full reconnect/dedup MQTT logic, all four specialty prompts, live IVR). This isn't a doc-completeness problem — the doc is unambiguous about what's wanted — but it's worth a deliberate go/no-go conversation before build time: either accept that some surfaces will be thinner than spec'd on the night, or explicitly re-cut scope now (e.g., 1-2 specialties instead of 4, MQTT without full reconnect/dedup, dashboard without live anomaly computation) so the build agent isn't the one silently deciding what gets cut under time pressure.
