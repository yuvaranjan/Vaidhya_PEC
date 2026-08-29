# Project Vaidhya — Technical Architecture v1 (Hackathon Build)

> Companion to `Project_Vaidhya_Architecture_v5.md`. That document is the **product contract** (what the system does and why). This document is the **technical contract** (what we build, with what, in what order, on which machine). Where v5 says "implementer's choice," this document makes the choice.
>
> Build window: **20 hours**. Team: **4**. Every decision below was made against one criterion: *does this survive a live demo?*

---

## 0. Decision Log (locked — do not re-litigate during the build)

| # | Decision area | Locked choice | v5 ref |
|---|---|---|---|
| D1 | Frontend + backend | **Next.js 15 (App Router, TypeScript)** for all portals and central APIs | §539 |
| D2 | AI service | **Python FastAPI** (`edge-ai`), runs on the village-edge node only | §539 |
| D3 | Database | **Supabase Postgres** (shared, central-of-record) + **SQLite** on the edge node | §6.1 |
| D4 | MQTT broker | **HiveMQ Cloud** free tier, WSS/TLS | §8.3 |
| D5 | Edge reasoning LLM | **LM Studio** serving `Qwen2.5-7B-Instruct` Q4_K_M, OpenAI-compatible on `:8080` | §5.1 |
| D6 | Central reasoning LLM | **Groq `llama-3.3-70b-versatile`** | §5.1 |
| D7 | STT | **Groq `whisper-large-v3-turbo`** (Phase 1) → `faster-whisper` local (Phase 2) | §1.2 |
| D8 | TTS | **`edge-tts`** Python package (Phase 1) → Meta MMS-TTS local (Phase 2) | §1.2 |
| D9 | Vision | **Groq vision model** for visual symptom capture (Phase 1) | §4 |
| D10 | Voicebot input languages | **Tamil, Malayalam, Hindi, English** — nurse selects at session start | §40 (overridden: v5 said single-language) |
| D11 | Clinical record language | **English always** — doctor-facing artefacts are English regardless of spoken language | §40 |
| D12 | EN→native speech | **LLM authors questions freely**; local IndicTrans2 translates; question bank is a translation *cache* only | §1.2.2 |
| D13 | Provider swapping | **Every voice/LLM component behind an interface**, selected by env var | new |
| D14 | Video / audio consult | **Simulated** (real webcam preview, no WebRTC). MQTT-text is genuinely wired ⚠️ *see §0.2* | §114 |
| D15 | Auth | 3 login paths visible; ABHA + fingerprint resolve against seeded data; **OTP hardcoded `123456`** | §1.1 |
| D16 | Topology | **Two physical laptops.** RTX 5060 = Village Edge, RTX 4050 = City Central | §6.4 (upgraded) |
| D17 | Scope | All four flagship modules genuinely working: MQTT consult, Specialist AI, Analytics, Twilio | §543 |

### 0.1 The one thing this changes about your pitch

v5 §6.4 concedes the demo would *simulate* the edge/central split inside one backend. **You no longer need that concession.** With two laptops you have a real two-node deployment: separate machines, separate processes, separate model tiers, talking over a real broker. That is a materially stronger claim, and §6.4's apologetic framing should be removed from your pitch deck.

What remains simplified, and must be stated honestly (see §16): the **data tier is shared** (one Supabase instance), STT/TTS/vision are cloud calls in Phase 1, and video/audio modes are simulated.

### 0.2 Traceability against `Problem_Statement.md`

Every Core Requirement and Target Deliverable, mapped to where it's built. **Two rows are amber and need a decision from you** — everything else is covered.

| Requirement (problem statement) | Covered by | Status |
|---|---|---|
| "AI voicebot that chats in **local languages**" | D10 — ta/ml/hi/en, nurse-selected | ✅ *(this requirement is why D10 correctly overrides v5 §40's single-language scope)* |
| "asks smart follow-up questions based on patient answers" | §5.2 orchestrator + §6 rules engine | ✅ |
| "pulls out key symptoms" | `extracted_facts` in the turn contract, §5.2 | ✅ |
| "flags urgent cases" | §6 urgency tiering, v5 §1.7 | ✅ |
| "nurses… log body signs like blood pressure" | §5.4 nurse vitals panel | ✅ |
| "**upload photos** of visible symptoms" | §4 capture — **webcam + file upload**, see below | ✅ |
| "text, **audio, or video**" consultations | MQTT-text real; audio/video **simulated** (D14) | ⚠️ **A** |
| "chats must pause during internet drops and **resume automatically without losing messages**" | §8.3 QoS 1 + persistent session + dedup + doctor outbox | ✅ *(this is the single most precisely-worded requirement in the brief, and §8.3 answers it exactly)* |
| "AI second opinions… **confidence levels and reasonings**" | §10 + v5 §8.4 schema | ✅ |
| "human doctor stays completely in control" | Doctor-triggered only; advisory-only instruction in every prompt | ✅ |
| "**save all clinic data locally first** so it works with zero internet" | §3.3 edge SQLite | ✅ **never-cut** |
| "sync to central servers once online" | §3.3 outbox worker | ✅ **never-cut** |
| "send prescriptions to local pharmacy queues" | §11 routing + `pharmacy_queue` | ✅ |
| "fire off automated text messages to patient phones" | §13 Twilio | ✅ |
| "track regional health patterns to spot outbreaks early" | §12 dashboard + anomaly rule | ✅ |
| "**smart timers** to prevent two doctors picking up the same patient" | §9 compare-and-swap + §8.4 heartbeat timeout | ⚠️ **B** |
| Portals for Patients, Doctors, Pharmacists | §2 route groups | ✅ |
| "live SMS alerts sent to **real mobile devices**" | §13, proven in hour 1.5 | ✅ |

**⚠️ A — audio/video modes.** The brief lists audio and video as supported modes, and D14 simulates both. Defensible, because the brief also calls text "a first-class path, not a fallback" — but it is a stated capability you'd be showing as a mock. The cheap hedge: **real audio only, no video** via a plain WebRTC audio-only peer connection (~1h, far more forgiving than video since there's no bandwidth/NAT pressure from a video track). That converts one amber row to green for an hour of work. Video stays simulated, which is easy to justify — it's the *high*-bandwidth case, and the brief's whole thesis is the low-bandwidth one. **Recommend taking this if you're on schedule at H14.**

**⚠️ B — "smart timers".** The brief specifies timers; §9 uses a database compare-and-swap, which is strictly stronger (a timer can still race, a CAS cannot). §8.4's heartbeat timeout is the timer half. This is a case where you exceed the requirement — but say so explicitly in the pitch, because a judge scanning for "timer" will otherwise mark it missing. Phrase it as: *"the brief asks for timers; we used an atomic database claim, which cannot race at all, plus a heartbeat timer for the abandoned-session case."*

---

## 1. System Topology

```
╔══════════════════ NODE A — "VILLAGE EDGE" (RTX 5060, 8GB VRAM, 32GB RAM) ═══════════════╗
║                                                                                          ║
║   Browser ── Patient Portal (Next.js, NODE_ROLE=edge)                                    ║
║      │         login · nurse vitals panel · voicebot UI · consult · prescription          ║
║      │                                                                                    ║
║      ├──HTTP──► edge-ai  (FastAPI, :8000)                                                ║
║      │            ├─ STTProvider    ──► Groq Whisper  [Phase1] / faster-whisper [Phase2]  ║
║      │            ├─ TTSProvider    ──► edge-tts      [Phase1] / MMS-TTS       [Phase2]  ║
║      │            ├─ TranslateProvider ─► cache hit? → else IndicTrans2 (LOCAL)           ║
║      │            ├─ LLMProvider    ──► LM Studio :8080  (Qwen2.5-7B, LOCAL)              ║
║      │            ├─ RulesEngine    ──► §7.6 branching + urgency flags                    ║
║      │            ├─ ReportBuilder  ──► DiagnosticReport (English)                        ║
║      │            ├─ SQLite (edge.db) + outbox                                            ║
║      │            └─ MQTT client (paho) ─────────────┐                                    ║
╚══════════════════════════════════════════════════════│════════════════════════════════════╝
                                                       │
                        ┌──────────────────────────────┴─────────────────────────┐
                        │              HiveMQ Cloud  (WSS/TLS 8884)              │
                        │   vaidhya/consult/{consultation_id}/{direction}        │
                        └──────────────────────────────┬─────────────────────────┘
                                                       │
╔══════════════════ NODE B — "CITY CENTRAL" (RTX 4050) ═│════════════════════════════════════╗
║                                                       │                                    ║
║   Browser ── Doctor · Pharmacist · Analytics (Next.js, NODE_ROLE=central)                  ║
║      │         queue · report viewer · specialist panel · Rx · stock · dashboard            ║
║      │                                                                                      ║
║      └──► Next.js Route Handlers (central API)                                              ║
║              ├─ /api/queue/[visitId]/claim   (compare-and-swap)                             ║
║              ├─ /api/specialist              ──► Groq llama-3.3-70b (ONLINE)                ║
║              ├─ /api/prescriptions/*                                                        ║
║              ├─ /api/pharmacy/*                                                             ║
║              ├─ /api/analytics/*                                                            ║
║              └─ reminder-worker (node-cron)  ──► Twilio SMS/IVR (ONLINE)                    ║
╚═════════════════════════════════════════════╤═══════════════════════════════════════════════╝
                                              │
                        ┌─────────────────────┴──────────────────────┐
                        │   Supabase Postgres  (central record)      │
                        └────────────────────────────────────────────┘
```

### 1.1 Why the boundary sits exactly here

| Runs at the edge | Runs at central | Reason |
|---|---|---|
| Voicebot reasoning (local 7B) | Specialist advisors (Groq 70B) | A village has no fibre; a hospital does. This is the real-world constraint, not a demo shortcut. |
| Intake, vitals, transcript, report | Doctor queue, prescriptions, pharmacy, analytics | Matches v5 §6.2's edge→central sync direction exactly. |
| SQLite write-of-record for the visit | Postgres system-of-record for everything | Lets the edge complete a full intake with the network unplugged. |
| — | Twilio | v5 §241 mandates this. No change. |

---

## 2. Repository Structure

**One Next.js app, not two.** Both laptops run the same codebase; `NEXT_PUBLIC_NODE_ROLE` decides which portals render. This halves your dependency management and eliminates an entire class of "it works on the other laptop" bugs.

```
vaidhya/
├─ apps/web/                        # Next.js 15 · TypeScript · Tailwind · shadcn/ui
│  ├─ app/
│  │  ├─ (patient)/                 # NODE_ROLE=edge
│  │  │  ├─ login/ · intake/ · consult/ · prescription/ · history/ · pharmacies/
│  │  ├─ (doctor)/                  # NODE_ROLE=central
│  │  │  ├─ login/ · queue/ · consult/[visitId]/ · prescribe/[visitId]/
│  │  ├─ (pharmacy)/                # NODE_ROLE=central
│  │  │  ├─ login/ · stock/ · queue/ · billing/
│  │  ├─ (analytics)/dashboard/     # NODE_ROLE=central
│  │  └─ api/                       # central route handlers
│  ├─ lib/
│  │  ├─ db.ts                      # Supabase client (server-side, service role)
│  │  ├─ mqtt.ts                    # browser MQTT client + topic builders
│  │  ├─ auth.ts                    # signed cookie session
│  │  └─ groq.ts                    # specialist + vision calls
│  └─ components/
├─ services/edge-ai/                # FastAPI (Node A only)
│  ├─ main.py
│  ├─ providers/                    # stt.py · tts.py · translate.py · llm.py
│  ├─ voicebot/                     # orchestrator.py · session.py · prompts.py
│  ├─ rules/engine.py               # §7.6 condition parser + urgency tiering
│  ├─ report/builder.py
│  ├─ sync/outbox.py                # edge → Supabase sync worker
│  └─ mqtt_client.py
├─ packages/shared/                 # TS types + zod schemas + MQTT topic constants
├─ db/
│  ├─ 001_schema.sql                # Supabase — THE hour-0 contract
│  ├─ 002_seed.sql
│  ├─ edge_schema.sql               # SQLite mirror
│  └─ seed/
│     ├─ question_bank.json         # ~40 questions × 4 languages
│     ├─ branching_rules.json       # §7.6 rules table
│     ├─ pharmacies.json · stock.json
│     └─ regional_cases.json        # §5.2, anomaly precomputed
└─ docs/
```

---

## 3. Data Tier

### 3.1 Ownership split

| Entity | Written by | Lives in | Syncs |
|---|---|---|---|
| `Visit`, `VitalsReading`, `ExamFinding`, `DiagnosticReport`, transcript | **Edge** | SQLite → Supabase | edge→central via outbox |
| `Patient` | Either | Supabase (cached read-only copy on edge) | central→edge on login |
| `Doctor`, `Prescription`, `Pharmacy`, `StockItem`, `Bill` | **Central** | Supabase | — |
| `BranchingRule`, `QuestionBank`, `Jurisdiction` | Seed | both (static) | — |
| `RegionalCaseCount` | Seed | Supabase | — |

This ownership table is the single most important thing to get right in hour 0. It means **no entity is written from two places**, which structurally eliminates the conflict-resolution problem v5 §6.2 defers.

### 3.2 Supabase schema (`db/001_schema.sql`)

```sql
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
  dob date, age int, sex text,
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

create type visit_status as enum
  ('intake_in_progress','awaiting_doctor','in_consult','completed','cancelled');

create table visits (
  visit_id text primary key,
  patient_id text references patients,
  edge_jurisdiction_id text references jurisdictions,
  status visit_status not null default 'intake_in_progress',
  unreconciled boolean default false,
  identity_unverified_offline boolean default false,
  consultation_id text,                       -- == visit_id once in_consult (§7.2)
  claimed_by_doctor_id text references doctors,
  language text not null default 'en',        -- ta | ml | hi | en  (D10)
  last_heartbeat_at timestamptz,              -- drives §8.3 10-min timeout
  created_at timestamptz default now(),
  completed_at timestamptz
);
create index on visits (status, edge_jurisdiction_id);

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

create table diagnostic_reports (
  report_id text primary key,
  visit_id text references visits on delete cascade,
  transcript jsonb not null default '[]',     -- [{speaker,text,text_native,timestamp}]
  vitals_snapshot jsonb not null default '[]',
  prior_history_summary jsonb,
  visual_symptom_description text,
  visual_symptom_image_url text,
  urgency_tier jsonb not null,                -- {tier, flags[], flag_count}  §7.5
  chief_complaint text,
  summary_text text,
  generated_at timestamptz default now()
);

create table branching_rules (
  rule_id text primary key,
  trigger_vital_or_finding text not null,
  condition text not null,                    -- "<90"  ">=180"  "==true"   §7.6
  question_branch_tags text[] not null default '{}',
  urgency_flag boolean not null default false,
  description_template text,                  -- "low SpO2 ({value}%)"
  active boolean not null default true
);

-- Translation CACHE (D12), not a question source. The LLM authors questions freely;
-- this table only lets common phrasings skip the IndicTrans2 call. Safe to leave empty.
create table question_bank (
  cache_key text primary key,                 -- normalize(text_en): lowercased, punctuation stripped
  text_en text not null,
  text_hi text, text_ta text, text_ml text,
  branch_tag text                             -- optional: surfaces preferred phrasings in the prompt
);

create table prescriptions (
  prescription_id text primary key,
  visit_id text references visits,
  doctor_id text references doctors,
  medications jsonb not null default '[]',    -- [{name,dosage,duration,instructions}]
  follow_up_requested boolean default false,
  pharmacy_id text references pharmacies,
  issued_at timestamptz default now()
);

create table pharmacies (
  pharmacy_id text primary key,
  name text not null, location text,
  phone_number text unique not null,
  jurisdiction_id text references jurisdictions
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

create table regional_case_counts (
  region_id text, disease_category text, week_start_date date,
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
```

**Additions beyond v5's §7 model, and why each is needed:**
- `visits.language` — D10 requires per-session language; v5 assumed a global build-time constant.
- `visits.last_heartbeat_at` — makes §8.3's 10-minute timeout computable *lazily* (see §8.4) instead of requiring a background timer.
- `question_bank` — new table, used purely as a **translation cache** (D12). It has no home in v5's model because v5 didn't anticipate runtime translation. Seed it with ~20 common phrasings; the system runs correctly with it empty, so this is an optimisation you can defer.
- `branching_rules.description_template` — §7.5 requires human-readable flag text ("low SpO2 (91%)"); v5 specifies the output but not where the string comes from.
- `scheduled_reminders` — §8.5 describes "enqueues a delayed job" without a durable store. An in-memory timer dies on restart; a table survives.
- `stock_items.status` as a **generated column** — v5 §7.9 says "derived from quantity thresholds *or* manually set". Deriving it in the DB removes an entire category of stale-status bug for free.

### 3.3 Edge SQLite + outbox (the offline story)

`edge.db` holds `visits`, `vitals_readings`, `diagnostic_reports` with identical columns, plus:

```sql
create table outbox (
  id integer primary key autoincrement,
  entity text not null,          -- visits | vitals_readings | diagnostic_reports
  entity_id text not null,
  payload text not null,         -- JSON
  created_at text not null,
  synced_at text
);
```

Sync worker (`sync/outbox.py`), every 5s:
1. `SELECT * FROM outbox WHERE synced_at IS NULL ORDER BY id`
2. Upsert each into Supabase (idempotent on PK — this is why sync is safe to retry).
3. Stamp `synced_at`. On network error: leave it, retry next tick.

Because clinical records are **append-only** (v5 §6.2), retrying an upsert can never corrupt data. That property is what makes this ~90 minutes of work instead of a distributed-systems project.

**This buys you the single best moment in your demo** — see §17.

---

## 4. Provider Abstraction (D13)

Every external-capability call goes through an interface with two implementations, chosen by env var. Nothing else in the codebase knows whether it's talking to a cloud API or a local model.

```python
# services/edge-ai/providers/stt.py
class STTProvider(Protocol):
    async def transcribe(self, audio: bytes, language: str) -> Transcript: ...
    # Transcript = {text_native: str, text_en: str, detected_language: str}

class GroqWhisperSTT(STTProvider):   # Phase 1 — whisper-large-v3-turbo
class LocalFasterWhisperSTT(STTProvider):  # Phase 2 — faster-whisper, task="translate"

def get_stt() -> STTProvider:
    return {"groq": GroqWhisperSTT, "local": LocalFasterWhisperSTT}[settings.STT_PROVIDER]()
```

Same shape for `TTSProvider` (`edge-tts` | `MMSTTS`) and `LLMProvider` (`lmstudio` | `groq`).

`TranslateProvider` has only one real implementation — **local IndicTrans2** — because D12 makes runtime translation core rather than optional. The ~20-entry cache in front of it is not a provider; it's a dictionary lookup that runs before any provider is called.

| Env var | Phase 1 value | Phase 2 value |
|---|---|---|
| `STT_PROVIDER` | `groq` | `local` |
| `TTS_PROVIDER` | `edge_tts` | `mms` |
| `TRANSLATE_PROVIDER` | `bank` | `indictrans2` |
| `EDGE_LLM_PROVIDER` | `lmstudio` | `lmstudio` |
| `EDGE_LLM_FALLBACK` | `groq` | `groq` |

`EDGE_LLM_FALLBACK` is your insurance policy: if LM Studio doesn't answer within `EDGE_LLM_TIMEOUT_MS` (default 20000), the call transparently retries against Groq and logs a visible `[FALLBACK]` warning. **If the 5060 dies at hour 18, the demo does not.**

> Estimated cost of this whole layer: **~30 minutes.** It is the highest-leverage 30 minutes in the plan.

---

## 5. Voicebot Pipeline

### 5.1 One conversational turn

```
[patient speaks]
  │
  1. Browser MediaRecorder → webm blob → POST /voice/turn  (multipart)
  │
  2. STTProvider.transcribe(audio, lang)
  │      → text_native ("வயிறு வலிக்கிறது")   [stored in transcript for authenticity]
  │      → text_en     ("my stomach hurts")   [everything downstream uses this]
  │
  3. Orchestrator: build LLM input =
  │      session_state (facts already known, vitals, fired rules,
  │                     branch priority order, questions already asked)
  │      + preferred phrasings for the active branches  (soft hint, NOT a constraint)
  │      + patient's latest utterance (English)
  │
  4. LLMProvider.complete(..., response_format=json_schema)  → LM Studio, LOCAL
  │      → VoicebotTurn JSON (see 5.2).  The LLM AUTHORS the question.
  │
  5. Speak it in the patient's language:
  │      TranslateProvider.to_patient_language(next_question, lang)
  │        ├─ cache hit  → pre-translated string   [~0 ms]
  │        └─ cache miss → IndicTrans2, local      [~300–600 ms]
  │
  6. TTSProvider.speak(text, lang) → audio stream → browser plays
  │      (English text is ALSO shown on screen — see 5.2)
  │
  7. Persist turn to SQLite; enqueue in outbox
```

### 5.2 The LLM's contract — it authors the questions

**The LLM is the product.** It composes each question freely from the session state; nothing constrains it to a fixed list. The question bank is a **translation cache underneath it**, not a source of questions — the system is fully correct with an empty bank, just ~400 ms slower per turn.

```jsonc
{
  "extracted_facts": {                 // merged into session state, never re-asked  (§1.2)
    "complaint": "stomach pain",
    "duration_days": 2
  },
  "fired_branch_tags": ["gi", "fever"],
  "next_action": "ask_question",       // ask_question | request_nurse_finding
                                       // | request_visual_capture | complete_intake
  "next_question": "Has the pain moved from around your navel to the lower right side?",
                                       // free-form English, LLM-authored — the intelligence
  "nurse_finding_request": null,       // {type:"palpation", instruction:"Check RLQ tenderness"}
  "reasoning": "Duration captured; migration pattern is the key appendicitis discriminator."
}
```

**The cache, in full:**

```python
def to_patient_language(text_en: str, lang: str) -> str:
    if hit := bank.get((normalize(text_en), lang)):   # ~20 seeded common phrasings
        return hit                                     # 0 ms
    return translate.translate(text_en, lang)          # IndicTrans2, local, ~400 ms
```

Cache hit-rate is raised — never enforced — by listing canonical phrasings in the prompt as *preferred wording when it fits*. The model stays free to ignore them, and ignoring them costs 400 ms, not correctness.

Why this shape is right:
- **The LLM's clinical reasoning is the feature**, and it's unconstrained. A fixed question list would cap the system's intelligence at whatever we thought of in advance — the opposite of the point.
- **Fully dynamic follow-ups**, which is what v5 §1.2's on-demand extension model actually describes.
- **Auditable.** `reasoning` + `fired_branch_tags` are a free evidence trail, feeding §5.5's explainability requirement at no extra cost.
- **It degrades gracefully.** Garbage JSON → one retry → then fall back to a generic prompt ("Can you tell me more about that?") and continue. The conversation never freezes on stage.

Enforce with LM Studio's `response_format: {"type":"json_schema", ...}`, validate with Pydantic, **one** retry, then the fallback. Never a third attempt — that's how you get a 40-second silence in front of judges.

> ⚠️ **The cost of LLM-primary, stated plainly.** The bot can now speak a machine-translated, LLM-authored clinical question in Malayalam that no one on your team has read. That is the real trade for unconstrained intelligence.
> **Required mitigation:** the patient screen always shows the English text alongside the spoken output, and the transcript panel shows both languages. This is ~15 minutes of UI, it makes the demo legible to judges who don't speak the language, and it means a bad question is visible rather than invisible. Do not skip it.

### 5.3 Latency budget (RTX 5060, Phase 1)

| Step | Budget | Notes |
|---|---|---|
| Audio upload | 100 ms | localhost |
| Groq Whisper turbo | 600–1200 ms | ~5s of speech |
| LM Studio 7B Q4 (~120 tok out) | 2500–4000 ms | dominant cost |
| Translate (cache miss) | 300–600 ms | ~0 ms on the seeded common questions |
| edge-tts | 700–1200 ms | |
| **Total** | **~4.5–7 s** | |

Design the UI to absorb this: waveform while listening → "Analysing…" pulse with the model name visible → speak. **Show the transcript token-by-token as it arrives** so the screen is never static. Perceived latency is what judges score, not measured latency.

### 5.4 Two-pass intake and the 90s/90s timeout (§1.2, §9.2)

Pass One and Pass Two are already fully specified in v5. The only implementation notes:
- The 90s/90s timer runs **server-side in the FastAPI session object**, not in the browser — a page refresh must not reset it.
- On the second expiry, write the `VitalsReading` row with `status='not_obtained'` and continue. The row still appears in the report (§7.4 requires this) but is excluded from rule evaluation.
- For the demo, expose `ON_DEMAND_TIMEOUT_SECONDS` as env. **Set it to 20 for the demo** — nobody will stand on stage for three minutes to watch a timeout. Say so openly; a configurable timeout is not a cheat.

---

## 6. Rules Engine (§7.6)

```python
OPS = {"<":lt, "<=":le, ">":gt, ">=":ge, "==":eq, "!=":ne}
COND = re.compile(r"^(<=|>=|==|!=|<|>)\s*(.+)$")

def evaluate(rule, readings) -> Flag | None:
    r = find_reading(readings, rule.trigger_vital_or_finding)
    if r is None or r.status == "not_obtained":
        return None                                   # §7.4: cannot fire on a null
    op, raw = COND.match(rule.condition).groups()
    val = r.value_numeric if r.value_numeric is not None else coerce(r.value_text)
    if not OPS[op](val, coerce(raw)):
        return None
    return Flag(rule_id=rule.rule_id,
                description=rule.description_template.format(value=val),
                branch_tags=rule.question_branch_tags,
                urgency=rule.urgency_flag)
```

No `eval()`, no expression language — exactly as §7.6 mandates, so the rules table stays safely editable as data.

**Urgency tiering (§1.7)** is then trivially:
```python
n = len([f for f in flags if f.urgency])
tier = "routine" if n == 0 else "elevated" if n == 1 else "urgent"
```

**Branch priority** = the order in which `question_branch_tags` accumulate from fired rules, with the patient's stated complaint category always prepended (v5 §76: vitals reorder branches, they don't override the complaint).

Ship ~12 seeded rules covering: SpO2, temperature, BP systolic, pulse (high and low), respiratory rate, RLQ tenderness, and `complaint_category:visual` (which triggers the symptom capture per §4).

**Symptom capture — support both webcam *and* file upload.** v5 §209 specifies only a webcam "Capture" button, but `Problem_Statement.md` says nurses must be able to "**upload** photos of visible symptoms." Both write to `diagnostic_reports.visual_symptom_image_url`, so this is one extra `<input type="file">` on the same nurse panel — roughly 10 minutes, and it closes a stated requirement that a webcam-only implementation would leave open. It's also the more realistic path: a nurse is far likelier to have taken the photo on a phone than to position a patient in front of a laptop.

---

## 7. Diagnostic Report Generation

At `intake_complete`, `ReportBuilder`:
1. Assembles transcript (both native and English), all vitals including `not_obtained`, prior history (from SQLite if local, else `null` + `unreconciled=true` per §6.3).
2. Runs the rules engine → `urgency_tier` object.
3. Makes **one** LM Studio call to produce `chief_complaint` + `summary_text` (English, D11) — a structured clinical précis, not a diagnosis.
4. Attaches `visual_symptom_description` if a capture happened.
5. Writes the row, sets `Visit.status='awaiting_doctor'`, enqueues to outbox.

The moment that row syncs, the patient appears in the doctor's queue on the other laptop. **That transition is your first big demo beat.**

---

## 8. MQTT Layer (§8.3 — the flagship)

### 8.1 Topics

```
vaidhya/consult/{consultation_id}/doctor_to_patient
vaidhya/consult/{consultation_id}/patient_to_doctor
vaidhya/consult/{consultation_id}/status
```
`consultation_id == visit_id` (§7.2). Payload exactly as §8.3 specifies.

### 8.2 Clients

| Side | Library | Transport |
|---|---|---|
| Doctor browser | `mqtt.js` | WSS :8884 |
| Edge `edge-ai` | `paho-mqtt` (or `aiomqtt`) | WSS :8884 |

The **edge service**, not the patient browser, holds the MQTT connection — because an incoming doctor question must drive the voicebot (STT/TTS/LLM), all of which live in FastAPI. The patient browser gets updates over SSE from `edge-ai`.

### 8.3 Delivery guarantees, cheaply

- **QoS 1** + `clean_session=False` + a **stable `client_id`** per role (`vaidhya-edge-{jurisdiction}`, `vaidhya-doctor-{doctor_id}`). HiveMQ then queues undelivered QoS-1 messages broker-side across a disconnect — you get most of §8.3's "queued locally, not lost" behaviour for free, from configuration rather than code.
- **De-dup**: an in-process `set[message_id]` capped at the last 200 ids, on both sides.
- **Doctor-side outbox**: unacknowledged publishes mirrored into `localStorage`, retried on reconnect. ~20 lines, and it covers the case where the doctor's own browser is what dropped.

### 8.4 The 10-minute timeout — evaluate it lazily

Do not run a background sweeper. The edge publishes a heartbeat to `.../status` every 15s; the doctor client's handler updates `visits.last_heartbeat_at`. Then:

```sql
-- runs inside GET /api/queue, no scheduler needed
update visits set status='awaiting_doctor', claimed_by_doctor_id=null
where status='in_consult' and last_heartbeat_at < now() - interval '10 minutes';
```

Same observable behaviour as §9.3, one less moving part. For the demo, set the interval to **45 seconds** so a requeue can actually be shown live.

---

## 9. Doctor Queue & Concurrency (§8.1, §9.4)

```sql
update visits
   set status = 'in_consult',
       claimed_by_doctor_id = $doctor_id,
       consultation_id = visit_id,
       last_heartbeat_at = now()
 where visit_id = $visit_id
   and status  = 'awaiting_doctor'      -- ← the compare-and-swap
returning *;
```

Zero rows returned → `409 {error:'already_claimed', claimed_by: <id>}`. Postgres guarantees the atomicity; no application locking, no transaction ceremony.

Queue read is filtered by `edge_jurisdiction_id = any(doctor.serves_jurisdiction_ids)` per §2.0. **Seed every demo doctor into every jurisdiction** — §135 explicitly permits this, and it saves you from an empty-queue moment on stage.

> Demoing this convincingly takes 30 seconds: open the doctor portal in two browser windows side by side, click Claim in both. One enters the consult, the other shows the 409 toast and its row vanishes. Rehearse it — it's a strong answer to "how do you handle race conditions?"

---

## 10. Specialist AI (§5.1, §5.5, §8.4)

One template, four configs, one Groq call. `lib/groq.ts`:

```ts
const SPECIALTIES = {
  cardiology:        { lens: "BP and pulse trends, chest pain descriptors, exertional patterns" },
  thoracic_medicine: { lens: "SpO2, respiratory rate, cough and breathlessness pattern" },
  neurology:         { lens: "headache character, vision/motor/sensory complaints, orientation cues" },
  ophthalmology:     { lens: "visual symptom capture description, eye-specific complaints" },
};

const systemPrompt = (s: Specialty) => `
You are a virtual ${s} sub-specialist advising a general MBBS doctor in a rural Indian
telemedicine setting. You do not have direct patient contact.
Weight these most heavily: ${SPECIALTIES[s].lens}.
You are advisory only. Do not issue a prescription or final diagnosis —
provide an opinion for the treating doctor's judgment.
Return ONLY JSON matching the provided schema.`;
```

Response schema is §8.4 verbatim (`specialty`, `confidence`, `evidence_trace[]`, `decision_trace`, `opinion_text`), enforced via Groq's JSON-schema structured output. The full `DiagnosticReport` goes in as-is (§220).

Render each field as a distinct UI element — a confidence chip, evidence as a bulleted list, decision trace in a muted callout. **Never render it as a paragraph.** The visible structure *is* the explainability claim (§5.5); prose would throw away the entire point.

> Build cost for all four specialties: **~1 hour.** Four strings and one shared call path. This is the best demo-impact-per-hour item in the entire project.

---

## 11. Pharmacist Portal & "Nearby" (§3, §7.0)

Straight CRUD — the lowest-risk work in the build. **Owner: T3**, who also owns the patient-facing screen this data feeds, so all pharmacy logic stays in one head. *(The doctor's stock-check modal from v5 §3.5 was cut — see plan §3.2.)*

### 11.1 Prescription delivery — the patient portal *is* the delivery channel

This is how a prescription reaches a patient. **SMS is a reminder, never the delivery mechanism** (§13). One page, `(patient)/prescription/[id]`, shows:

1. **The prescription itself** — medications, dosage, duration, instructions, prescribing doctor, date. Viewable and printable (v5 §1.5). A patient with no phone still gets it, because it's on screen at the health center and the nurse can print it.
2. **Nearby pharmacies, with per-medicine stock status** — for each pharmacy in range, every prescribed medicine tagged `in stock` / `low` / `out of stock`, read live from `stock_items` (v5 §3.6). The full list, not a single best-match recommendation.
3. **Select a pharmacy** → routes the prescription to exactly that pharmacy's queue. The patient then walks to that shop, where the pharmacist already has it waiting.
4. A mock **"request delivery"** action per pharmacy (v5 §188) — simulated coordination, no courier integration.

```
GET /api/pharmacies/nearby?prescription_id=...
  → [{ pharmacy_id, name, location, distance_km,
       medicines: [{ name, status: 'in_stock'|'low'|'out_of_stock' }] }]
```

`nearby(patient)` = pharmacies where `jurisdiction_id == patient.home_jurisdiction_id` **OR** haversine(jurisdiction centroids) ≤ `NEARBY_RADIUS_KM` (default 15). Compute in the route handler; at seeded scale (≈10 pharmacies) this is microseconds and needs no PostGIS.

Routing (§8.2): `POST /api/prescriptions/[id]/route` sets `pharmacy_id` **and** inserts into `pharmacy_queue` in one transaction; the `unique` constraint on `pharmacy_queue.prescription_id` enforces §8.2's "exactly one pharmacy, no re-routing" rule at the database level rather than in application code.

> **Seed one pharmacy as out-of-stock on one prescribed medicine.** A list where everything is green proves nothing; a list where the patient can see *which* shop actually has all three medicines is the whole point of the feature, and it takes one seed row to demonstrate.

---

## 12. Public Health Analytics (§5.2)

Entirely read-only over seed data — **zero dependency on any other lane**. **Owner: T4**, alongside the reminder module and the seed data it reads. Because it can be built in complete isolation, it's also the safest thing to hand to whoever has slack late in the build.

- Seed: 10 regions × 4 disease categories × 26 weeks. Compute `rolling_baseline` (trailing 4-week mean) and `is_anomaly = case_count > 2 × baseline` **in the seed script**, per §234.
- Deliberately plant one unmistakable spike (e.g. a 3.5× dengue jump in one region at week 19).
- Map: `react-simple-maps` + an India TopoJSON, circle markers scaled and colour-coded by intensity, anomaly regions ringed and pulsing.
- Charts: Recharts time-series per region/disease, anomaly weeks marked with a `ReferenceDot`.

> Judges photograph dashboards. Spend the last 20 minutes of this lane on visual polish, not on more data.

---

## 13. Twilio Module (§5.3, §8.5)

> **SMS is a reminder channel, never a delivery channel.** The prescription is delivered **in the patient portal** — viewable and printable, with the nearby-pharmacy list and stock status directly beneath it (v5 §1.5, §1.6). Twilio only sends *reminders about* a prescription that already exists in the system.
>
> This matters for two reasons. First, it's the correct product behaviour: a patient without a smartphone still gets their prescription, because the nurse has it on screen at the health center. Second, it means **the SMS path is not on the critical path for prescription delivery** — if Twilio is blocked at the venue (R1, the highest external risk in the build), the prescription → pharmacy → fulfilment flow still works end to end and the demo is unaffected.

Central only (§241). `node-cron` every 30s scans `scheduled_reminders where status='pending' and due_at <= now()`.

| Trigger | Row created when | `due_at` | Message content |
|---|---|---|---|
| `immediate_rx` | Prescription synced/created | `now()` | Medication *summary* — a reminder of what was prescribed and the chosen pharmacy. The authoritative copy stays in the portal. |
| `follow_up` | `follow_up_requested = true` | `now() + FOLLOW_UP_DELAY` | "Your doctor asked to check on you — how are you feeling?" |

**Set `FOLLOW_UP_DELAY_SECONDS=90` for the demo.** The 48-hour default is correct for production and useless on stage; a table-driven delay lets you show the *scheduled* reminder actually firing during your pitch, roughly one minute after you issue the prescription. Mention the real default out loud — it's a better story than pretending 90 seconds is the product.

⚠️ **Highest external risk in the project.** Indian DLT registration and Twilio trial restrictions can block SMS to Indian numbers in ways that have nothing to do with your code. This must be proven end-to-end in **hour 1**, not hour 15. If it can't be, fall back to WhatsApp sandbox (far fewer restrictions) or Twilio Voice/IVR, and cut it from the critical demo path.

---

## 14. Auth (§1.1, §2.0, §6.5)

Signed httpOnly cookie via `iron-session`. No NextAuth — the callback/adapter surface is larger than what you need.

| Path | Behaviour |
|---|---|
| ABHA ID | Real lookup against seeded `patients.abha_id` |
| Fingerprint | Scanner animation → resolves to a seeded patient after ~1.5s |
| Phone + OTP | Real phone lookup; OTP accepts `123456`, shown on screen as "Demo OTP" |
| Doctor / Pharmacist | Phone + password (bcrypt), seeded |
| **Offline override (§6.5)** | If `edge-ai` reports no connectivity, show "Nurse-verified entry" → sets `identity_unverified_offline=true` |

That last row is 15 minutes of work and it demonstrates a genuinely thoughtful piece of the design. Do not skip it.

---

## 15. Configuration Matrix

**Node A — Village Edge (RTX 5060)**
```ini
NEXT_PUBLIC_NODE_ROLE=edge
NEXT_PUBLIC_JURISDICTION_ID=jur_thrissur_01
NEXT_PUBLIC_EDGE_AI_URL=http://localhost:8000
# edge-ai/.env
STT_PROVIDER=groq
TTS_PROVIDER=edge_tts
TRANSLATE_PROVIDER=bank
EDGE_LLM_PROVIDER=lmstudio
EDGE_LLM_URL=http://127.0.0.1:8080/v1
EDGE_LLM_MODEL=qwen2.5-7b-instruct
EDGE_LLM_FALLBACK=groq
EDGE_LLM_TIMEOUT_MS=20000
ON_DEMAND_TIMEOUT_SECONDS=20
GROQ_API_KEY=...
SUPABASE_URL=...  SUPABASE_SERVICE_KEY=...
MQTT_URL=wss://xxx.hivemq.cloud:8884/mqtt
```

**Node B — City Central (RTX 4050)**
```ini
NEXT_PUBLIC_NODE_ROLE=central
GROQ_API_KEY=...
GROQ_SPECIALIST_MODEL=llama-3.3-70b-versatile
GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
TWILIO_ACCOUNT_SID=...  TWILIO_AUTH_TOKEN=...  TWILIO_FROM=...
FOLLOW_UP_DELAY_SECONDS=90
CONSULT_TIMEOUT_SECONDS=45
NEARBY_RADIUS_KM=15
SUPABASE_URL=...  SUPABASE_SERVICE_KEY=...
NEXT_PUBLIC_MQTT_URL=wss://xxx.hivemq.cloud:8884/mqtt
```

> Commit a `.env.example` in hour 0. Four people, two machines, ~25 variables — this is where hackathon nights die.

---

## 16. Real vs Simulated — the honesty table

Put a version of this in your README **and** on a slide. Judges reward teams who volunteer their boundaries; they punish teams caught at them.

| Capability | Status | If asked |
|---|---|---|
| Edge/central two-node split | ✅ **Real** — two machines, two model tiers, real broker | Genuinely deployed as designed |
| Local LLM reasoning at the edge | ✅ **Real** — Qwen2.5-7B in LM Studio, no internet | The core offline claim, and it's true |
| Offline intake + sync-on-reconnect | ✅ **Real** — SQLite + outbox | Demonstrable live (§17) |
| MQTT-text consultation | ✅ **Real** — QoS 1, dedup, reconnect | The flagship USP |
| Queue claim race handling | ✅ **Real** — Postgres compare-and-swap | Show it live |
| Specialist AI, structured output | ✅ **Real** — Groq 70B, JSON schema | 4 prompt configs, 1 code path |
| Visual symptom description | ⚠️ **Real AI, cloud call** | Edge-captured, central-analysed; queued when offline |
| STT / TTS | ⚠️ **Cloud in Phase 1** | Behind a provider interface; local swap is one env var |
| Video / audio consult modes | ⛔ **Simulated** *(unless you take the §0.2-A audio hedge)* | Deliberate — MQTT-text is the innovation; video is the easy case |
| Network-quality cascade | ⛔ **Manual toggle** | v5 §114 already scoped this |
| Pharmacy inventory | ⛔ **Seeded** | v5 §3.7 already scoped this |
| Public health data | ⛔ **Seeded, deterministic anomaly rule** | v5 §234 — the *rule* is real and reproducible |
| ABHA integration | ⛔ **Seeded lookup** | No sandbox access in 20h |

**Do not say "fully offline"** while STT is a Groq call. Say: *"The clinical reasoning runs entirely on the edge device with no internet. Speech recognition is currently a cloud call, behind an interface we swap to local Whisper with one config change."* That sentence is accurate, and it demonstrates architectural maturity rather than conceding a weakness.

---

## 17. The Demo Set-Piece You Should Build Toward

Everything above exists to make this seven-minute sequence possible:

1. **Unplug Node A's wifi, on camera.**
2. Patient logs in via phone + OTP. Nurse enters vitals: SpO2 91, temp 38.9. *(Two urgency flags now armed.)*
3. Voicebot greets the patient **in Malayalam**. Patient answers in Malayalam. Transcript panel shows Malayalam **and** its English clinical translation side by side.
4. Because SpO2 is 91, the bot goes straight to respiratory questions — point at the on-screen "fired rule: SpO2 < 92" badge. *This is your rules engine visibly working, not a black box.*
5. Bot asks the nurse for an on-demand finding; nurse doesn't respond; after 20s it re-prompts, then proceeds with `not_obtained`. *Say out loud: "the session never stalls on a missing test."*
6. Report generates. Urgency: **Urgent (2 flags)**. All of this happened **with no internet.**
7. **Plug the wifi back in.** Outbox flushes. Walk to Node B — the patient has appeared in the doctor's queue, tagged Urgent.
8. Doctor opens the report, clicks **Consult Specialist AI → Thoracic Medicine**. Structured opinion returns with confidence and evidence trace.
9. Doctor switches to **MQTT-text mode**, types a follow-up question. Back at Node A, the voicebot *speaks that question in Malayalam*, patient answers, the English answer appears on the doctor's screen.
10. Doctor issues a prescription with follow-up flagged. **It appears immediately in the patient portal** — full medication list, viewable and printable (v5 §1.5). *This is how the prescription is delivered. Nothing about the prescription depends on SMS.*
11. Below the prescription, the patient portal lists **nearby pharmacies with per-medicine stock status** (in stock / low / out). The patient picks one → the prescription routes into exactly that pharmacy's queue → walk to Node B and show it waiting on the pharmacist portal → pharmacist marks it fulfilled and bills it. The patient can now simply walk to that shop.
12. **Separately**, Twilio fires a medication-reminder SMS to a real phone, and ~90 seconds later the scheduled follow-up reminder fires too. These are *reminders about* the prescription, not the prescription itself.
12. Close on the analytics dashboard: the anomaly spike, highlighted.

Steps 1, 6 and 7 are the ones that will actually win it. A working offline flow that syncs on reconnect is a claim almost no hackathon team can back up live — and yours can, because of §3.3.

---

*Implementation strategy, lane assignments and the hour-by-hour plan: see `Project_Vaidhya_Implementation_Plan_v1.md`.*
