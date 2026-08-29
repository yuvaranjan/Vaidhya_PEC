# Project Vaidhya — Implementation Strategy (20-Hour Build)

> Companion to `Project_Vaidhya_Technical_Architecture_v1.md`. That document says *what* to build. This one says *who builds it, in what order, and what gets cut when you fall behind* — because you will fall behind, and the only question is whether that decision gets made deliberately at hour 12 or in a panic at hour 18.

---

## 1. Lane Assignment

**Assignment principle (as decided):** T1 and T2 are the strongest vibe-coders and carry the bulk of the build. T3 owns the Pharmacist Portal. T4 owns automated call/SMS reminders. Those ownerships are fixed.

T3 and T4's primary scopes are ~3h and ~2.5h of a 20-hour window, so each has additional work drawn from **their own domain** — pharmacy-facing surfaces for T3, outbound-comms and read-only data surfaces for T4. Nothing in those additions changes what they own; it fills hours that would otherwise be idle while T1 and T2 are saturated.

| Lane | Primary ownership | Load |
|---|---|---|
| T1 | **All AI** — edge service, voicebot, specialist advisors | ~15h |
| T2 | **All portal UI** — patient + doctor, auth, realtime | ~13h |
| T3 | **Pharmacist Portal** + pharmacy-facing surfaces elsewhere | ~9h |
| T4 | **Auto call/SMS reminders** + analytics dashboard + seed data | ~11h |

---

### T1 — AI Lane *(the critical path; strongest builder)*
`services/edge-ai/**`, `app/api/specialist/**`, `app/api/vision/**`, `app/(doctor)/consult/_components/SpecialistPanel.tsx`

**Edge AI service (Python/FastAPI):**
- FastAPI scaffold + LM Studio integration + model download/tuning
- Provider abstraction: `STTProvider` / `TTSProvider` / `TranslateProvider` / `LLMProvider` (arch §4)
- Voicebot orchestrator, session state, the `VoicebotTurn` JSON contract (arch §5.2)
- 90s/90s on-demand timeout logic, server-side (arch §5.4)
- Rules engine + urgency tiering (arch §6)
- Diagnostic report builder (arch §7)
- SQLite + outbox sync worker (arch §3.3)
- Edge-side MQTT client (paho)

**Specialist AI vertical slice (owned end to end, API *and* panel UI):**
- Four specialty prompt configs, one shared template (arch §10)
- Groq structured-JSON call + validation
- Panel rendering: confidence chip, evidence bullets, decision trace callout
- Vision endpoint for visual symptom capture

> Owning the specialist panel's UI as well as its API keeps a self-contained vertical slice in one head, and takes ~1.5h off T2's plate. It's ~1h of work for the best demo-impact-per-hour in the project.

**Definition of done:** `POST /voice/turn` with a Malayalam audio blob returns bot audio + updated session state using local inference for reasoning; `POST /intake/complete` writes a `DiagnosticReport` that reaches Supabase; the doctor's specialist panel returns a schema-valid opinion.

---

### T2 — Portal Lane *(highest volume; strongest vibe-coder)*
`apps/web/app/(patient)/**`, `apps/web/app/(doctor)/**`, `lib/auth.ts`, `lib/mqtt.ts`, `packages/shared/mqtt.ts`

- **All auth** (arch §14): patient 3-path login + offline nurse-override, doctor phone+password, shared `lib/auth.ts` that T3/T4 reuse for pharmacy login
- Nurse vitals panel — one interface serving Pass One baseline *and* on-demand requests (v5 §1.2.1)
- Voice UI: MediaRecorder capture, playback, live transcript panel (native + English side by side), "Analysing…" states, typed-answer fallback
- SSE channel from `edge-ai` → patient browser
- Consult screen: mode toggle (video/audio simulated, MQTT-text real), webcam capture button
- Doctor queue: urgency tags, jurisdiction filter, **compare-and-swap claim** + 409 handling (arch §9)
- Diagnostic report viewer (transcript, vitals incl. `not_obtained`, urgency flags, visual capture)
- Prescription form + follow-up flag
- **Owns the MQTT contract** in `packages/shared` (topics, payload types, dedup helper); wires the doctor-side browser client and pairs with T1 on the edge client

**Definition of done:** a full intake runs end to end from the browser; a doctor claims a patient, reads the report, exchanges MQTT messages, issues a prescription.

> This is a lot of surface area, which is deliberate — UI is the most vibe-codeable layer in the stack, so volume here converts to output faster than anywhere else. Generate page-by-page, never portal-by-portal.

---

### T3 — Pharmacist Portal + pharmacy-facing surfaces
`apps/web/app/(pharmacy)/**`, `app/api/pharmacy/**`, `app/(patient)/pharmacies/**`, `app/(patient)/history/**`, `app/(patient)/prescription/**`, `db/seed/pharmacies.json`, `db/seed/stock.json`

**Primary — Pharmacist Portal (§3):**
- Phone login (reusing T2's `lib/auth.ts`)
- Stock CRUD with the generated `status` column
- Incoming prescription queue, pending → fulfilled
- Billing / invoice generation (§3.4)

**Prescription delivery screen (arch §11.1) — this is where the patient actually receives their prescription, so it belongs to whoever owns the stock data:**
- Prescription view: medications, dosage, instructions, printable (§1.5)
- Nearby pharmacies listed beneath it with **per-medicine stock status** (§1.6, §3.6)
- Pharmacy selection → routes into that pharmacy's queue
- Mock "request delivery" action per pharmacy (v5 §188)
- `GET /api/pharmacies/nearby`, haversine helper, `POST /api/prescriptions/[id]/route`
- Pharmacy + stock seed data — **seed one pharmacy out-of-stock on one prescribed medicine**, or the feature demos as a wall of green ticks

**One more self-contained patient page** *(read-only, relieves T2):*
- Medical history — flat list of past visits (calendar view cut, §3.2)

**Definition of done:** the doctor issues a prescription, it appears in the patient portal with a nearby-pharmacy list showing real stock status, the patient selects one, it lands in that pharmacy's queue, gets marked fulfilled, and produces a bill. **No step in that chain depends on SMS.**

---

### T4 — Auto Call/SMS Reminders + data surfaces
`app/api/reminders/**`, reminder worker, `app/(analytics)/**`, `app/api/analytics/**`, `db/seed/**`

**Primary — automated reminders (§5.3, arch §13):**
- Twilio client, central-node only
- `scheduled_reminders` table + `node-cron` worker (30s tick)
- `immediate_rx` trigger on prescription creation
- `follow_up` scheduled trigger, `FOLLOW_UP_DELAY_SECONDS=90` for demo
- **IVR voice call** in addition to SMS — this is the harder and more impressive half of §5.3, and it's where the extra hours in this lane should go first
- OTP delivery path (§6.5) reuses the same Twilio client

**Seed data (the whole team depends on this):**
- ⚠️ **Hour 2.5–3, before anything else: three complete fake `DiagnosticReport` rows.** This unblocks T2's doctor portal roughly six hours before T1 can produce a real report. It is the single highest-leverage task in this lane.
- Translation cache: ~20 common phrasings × 4 languages (arch §5.2, D12). **This is a cache, not a question source** — the LLM authors questions freely, so an empty table still works, just ~400 ms slower per turn. Seed it late, and have a native Malayalam/Tamil speaker check what you do seed.
- Branching rules (~12), jurisdictions, patients, doctors
- One-command seed script that rebuilds the entire demo dataset

**Analytics dashboard (§5.2, arch §12)** — read-only over seed data, zero dependencies on any other lane:
- 10 regions × 4 diseases × 26 weeks, anomaly precomputed in the seed script
- Map (react-simple-maps + India TopoJSON) + Recharts time-series
- One unmistakable planted spike

**Demo owner from H15:** stops feature work, owns the script, seed state, rehearsals, slides, README honesty table.

**Definition of done:** a real SMS and a real IVR call reach a real phone; the seed script rebuilds everything in one command; the dashboard is screenshot-worthy.

> If you'd rather T4 stayed narrowly on reminders only, the analytics dashboard is the clean thing to move — it's fully self-contained and could go to T3 instead. The seed-data work should **not** move; it has to sit with whoever has slack in hours 2–4, and that's T4.

---

### 1.1 Coordination rules

- **Push directly to `main`.** With disjoint directory ownership, branch-and-merge costs more than it saves at this timescale. The only shared files are `db/001_schema.sql`, `packages/shared/**`, `lib/auth.ts` and `.env.example` — all frozen by hour 1.5.
- Commit every ~30 minutes. A hackathon repo with 6 commits is a repo you cannot roll back.
- Schema change after freeze? Say it out loud in the room, edit together, everyone re-runs the migration. Never silently.
- **T1 and T2 are now single points of failure.** That's the cost of concentrating the build in your strongest two, and it's a reasonable trade — but it means if either gets stuck for more than 45 minutes, they escalate to the room immediately rather than grinding. Make that an explicit rule, not a hope.

---

## 2. Hour-by-Hour

### H0.0 – H0.5 · Accounts and downloads *(all four, in parallel)*
Start the LM Studio model download **first** — `Qwen2.5-7B-Instruct-Q4_K_M` is ~4.7 GB and downloads while you do everything else. Losing it at hour 3 to a slow connection is an avoidable disaster.

Also: Supabase project + connection string · HiveMQ Cloud instance + credentials · Groq API key · Twilio account, phone number, verified test number.

### H0.5 – H1.5 · Contract freeze *(all four, together, one screen)*
Scaffold the monorepo. Apply `001_schema.sql` to Supabase. Write `packages/shared` types and `lib/auth.ts`. Write `.env.example`. **Every person runs `npm run dev` successfully and sees their portal render before this hour ends.** Do not let anyone start feature work on a broken local setup — they will lose three hours to it later.

### H1.5 – H2.5 · Risk spikes *(hard gate — nothing else gets built this hour)*
Each person proves their single riskiest external dependency in isolation. No UI, no polish, no integration. Just: *does this work on this machine at all?*

| Lane | The one thing to prove |
|---|---|
| T1 | LM Studio returns valid JSON via `response_format`, **and** Groq Whisper transcribes a Malayalam clip, **and** `edge-tts` speaks Tamil |
| T2 | Two browser tabs exchange a message over HiveMQ Cloud WSS |
| T3 | Supabase read/write from a route handler with the service key |
| T4 | **A real SMS and a real IVR call reach a real Indian phone number** |

**At H2.5, hold a 5-minute standup.** Anything unproven gets its fallback activated *now*, not later:
- LM Studio failing → set `EDGE_LLM_PROVIDER=groq`, keep local as a stretch goal, adjust the pitch wording
- edge-tts failing → browser `speechSynthesis` for Hindi/English, Tamil/Malayalam degrade to on-screen text
- Twilio blocked → WhatsApp sandbox, or voice-only; if both fail, cut §5.3 from the critical demo path and put it on the honesty slide
- HiveMQ failing → local Mosquitto over LAN (both laptops on the same wifi)

This hour feels like a detour. It is the highest-return hour of the twenty.

### H2.5 – H8.0 · Build sprint 1
| Lane | Work |
|---|---|
| T1 | providers → orchestrator skeleton → rules engine |
| T2 | auth (all roles) → nurse vitals panel → voice capture UI |
| T3 | pharmacist auth → stock CRUD → prescription queue |
| T4 | **fake reports first (H2.5–3)**, then rules seed + patients/doctors/jurisdictions, then Twilio SMS |

### H8.0 – H9.0 · Integration checkpoint 1 — *"intake reaches the queue"*
All four stop and connect: patient completes an intake on Node A → report generates → appears in the doctor's queue on Node B. **This is the spine of the demo.** If it isn't working by H9, activate cut-ladder tier 1 (§3) immediately.

### H9.0 – H14.0 · Build sprint 2
| Lane | Work |
|---|---|
| T1 | report builder → SQLite outbox → edge MQTT client → specialist panel |
| T2 | doctor queue + claim CAS → report viewer → consult screen → MQTT wiring → SSE |
| T3 | billing → prescription delivery screen + nearby stock list → routing |
| T4 | IVR call + follow-up scheduler → analytics dashboard |

### H14.0 – H15.0 · Integration checkpoint 2 — *"the MQTT consult works"*
Doctor question → voicebot speaks it in Malayalam → patient answers → English text on the doctor's screen. Plus the full fulfilment chain: prescription appears in the patient portal → patient picks a pharmacy from the nearby stock list → it lands in that pharmacy's queue. Reminder SMS is verified separately, because nothing in that chain depends on it.

### H15.0 – H17.0 · Completion and seed polish
T4 becomes demo owner and takes over seed state. T3 finishes the history page. T1 and T2 close gaps in their own lanes. **No new features start after H17.**

### H17.0 – H18.0 · Rehearsal 1
Run the full demo script (arch §17) end to end, timed, out loud. Write down every bug and every awkward pause. Fix nothing during the run.

### H18.0 – H19.0 · Fix only what rehearsal 1 surfaced
Nothing else. Not "while I'm in here." **Code freeze at H19.00.**

### H19.0 – H20.0 · Rehearsals 2 and 3, slides, README
The third run should be boring. Boring is the goal.

---

## 3. Cut Ladder

Pre-agreed, in order. When you hit a checkpoint behind schedule, cut from the top — no debate, no re-litigating.

> **Everything on this ladder was checked against `Problem_Statement.md` first.** Nothing here is a stated Core Requirement or Target Deliverable. That constraint is what moved the SQLite outbox off the ladder entirely — see the never-cut list.

**Tier 1 — cut if behind at H9**
1. Translation cache seeding → run with an empty cache *(~30m; every turn just pays IndicTrans2's ~400 ms. Pure optimisation, zero capability lost)*
2. Specialists 4 → 2 (Cardiology + Thoracic) *(~30m)*
3. Rules table 12 → 6 *(~30m; keep SpO2, temperature, BP, pulse, RLQ tenderness, visual-complaint)*

**Tier 2 — cut if behind at H14**
4. Billing (§3.4) → pharmacist marks fulfilled, no invoice *(~1h — **you elected to keep this**; cut only under real pressure)*
5. Map view → charts only *(~1.5h — **you elected to keep this**; "track regional health patterns" is satisfied by charts alone)*
6. IVR call → SMS only *(~1h — **you elected to keep this**; the deliverable specifies "live SMS alerts", so SMS is the required half)*

**Tier 3 — cut if behind at H17**
7. Scheduled follow-up → immediate SMS only *(~30m)*
8. Concurrent-claim demo → keep the code, drop it from the script *(~0m, saves rehearsal time)*

**Already cut from scope before the build starts** *(§3.2)* — do not build these at all.

**Never cut — every item here is a stated requirement in `Problem_Statement.md`:**

| Must survive | Required by |
|---|---|
| Voicebot conversational loop, multilingual | "AI voicebot that chats in local languages" |
| Rules engine + urgency tiering | "flags urgent cases" |
| Nurse vitals + symptom photo capture | "log body signs… upload photos of visible symptoms" |
| Diagnostic report | "clear diagnostic traces for doctors" |
| **MQTT-text consult with reconnect + dedup** | "chats must pause during internet drops and resume automatically without losing messages" |
| **Edge SQLite + outbox sync** | "save all clinic data locally first so it works with zero internet, sync… once online" |
| **Local IndicTrans2 translation** | required by D12 — a freely-composing LLM produces novel questions every turn |
| Doctor queue + claim | "prevent two doctors from picking up the same patient" |
| ≥1 specialist advisor with confidence + reasoning | "AI second opinions that clearly show confidence levels and reasonings" |
| Prescription → pharmacy queue | "send prescriptions to local pharmacy queues" |
| Real SMS to a real phone | "live SMS alerts sent to real mobile devices" |
| Analytics dashboard | "track regional health patterns to spot disease outbreaks early" |

⚠️ **The edge SQLite + outbox was previously listed as a Tier-1 cut. That was wrong.** "Save all clinic data locally first so it works with zero internet" is a Core Requirement, not a nice-to-have — cutting it would mean failing an explicit judging criterion while the demo still appeared to work. It is now never-cut. If you are behind at H9, cut deeper into Tier 2 instead.

### 3.2 Scope reduction taken before the build *(the "tone it down" pass)*

Each item below was checked against `Problem_Statement.md` and appears in **none** of its Core Requirements or Target Deliverables. Cutting them costs zero scored weight. **Do not build these.**

| Removed | Saves | Why it costs nothing |
|---|---|---|
| Vision AI description of symptom photos | 45m | Brief requires nurses can *upload* photos into the record — not that AI describes them. Photo still captured, stored and shown to the doctor. |
| Doctor's "check nearby stock" panel (v5 §3.5) | 1h | v5 invention. Patient-side pharmacy selection stays, because that's what routes prescriptions to queues. |
| History calendar/timeline → flat list | 45m | Not in the brief. |
| ABHA + fingerprint login paths | 30m | Brief specifies no auth at all. Ship phone+OTP (`123456`) plus a demo role-switcher. |
| Out-of-jurisdiction / `unreconciled` flow (v5 §6.3) | 1h | Keep the DB column so the schema still tells the story; skip the UI and reconciliation logic. |
| Offline nurse-override login (v5 §6.5) | 15m | Not in the brief. |
| Question bank 40 → ~20 entries, now optional | 1h | It's a cache now (D12), not a question source. |

**Net: ~5.5h removed, ~48h → ~42.5h.**

**Kept by your decision:** map view (1.5h), IVR call (1h), billing (1h). All three sit in T3 and T4's lanes — **none of them touch T1 or T2's critical path**, so keeping them costs nothing on the bottleneck. That's why they were the right three to keep.

### 3.1 Stretch ladder — if you are *ahead* at H14

Add from the top. Each closes a real gap rather than adding polish.

1. **Real audio-only consultation** *(~1h, T2)* — a WebRTC audio-only peer connection. `Problem_Statement.md` lists audio and video as supported modes and D14 simulates both; audio-only is far more forgiving than video (no NAT/bandwidth pressure from a video track) and converts a stated capability from mocked to real. See arch §0.2-A. **Take this one first.**
2. **Local `faster-whisper`** *(~1.5h, T1)* — flip `STT_PROVIDER=local`. Makes the offline claim fully true for speech, not just reasoning. High pitch value, and the provider abstraction means it's genuinely a config change if the install cooperates.
3. **Second doctor account + live concurrent-claim demo** *(~15m, T2)* — the code already exists; this is purely seed data and rehearsal.
4. **Local MMS-TTS** *(~1.5h, T1)* — completes the fully-offline voice path.
5. **Deploy central to Vercel** *(~1h, T4)* — a live URL judges can open on their own phones. Only if everything else is done and rehearsed.

---

## 4. Risk Register

| # | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R1 | Twilio blocked to Indian numbers (DLT/trial) | **High** | Medium | Prove in H1.5–2.5; WhatsApp sandbox fallback | T4 |
| R2 | 7B model returns malformed JSON | Medium | High | `json_schema` mode + Pydantic + 1 retry + deterministic fallback question (arch §5.2) | T1 |
| R3 | Turn latency feels broken on stage | **High** | High | Translation cache on common questions; streaming transcript; visible "Analysing" state; `EDGE_LLM_FALLBACK=groq` | T1/T2 |
| R3b | **LLM speaks an unverified machine-translated clinical question** | **Medium** | Medium | Direct cost of LLM-primary (D12). English text always displayed alongside the spoken output, both languages in the transcript panel — a bad question becomes visible, not invisible (arch §5.2) | T1/T2 |
| R4 | Venue wifi kills Supabase/HiveMQ | Medium | **Critical** | Phone hotspot as backup; rehearse on hotspot; local Mosquitto ready | T4 (demo owner) |
| R5 | 8 GB VRAM exhausted | Medium | High | Only the LLM on GPU; translate/TTS on CPU; Q4_K_M not Q6 | T1 |
| R6 | Schema drift across 4 devs | Medium | High | Frozen at H1.5; changes announced aloud; single `001_schema.sql` | All |
| R7 | Whisper mishears Tamil/Malayalam live | Medium | Medium | Nurse-selected language pins Whisper's `language` param; typed-answer fallback always visible | T2 |
| R8 | Both laptops can't reach each other | Low | **Critical** | Everything routes via cloud broker + cloud DB, never LAN — no NAT to fight | T2 |
| R9 | Integration debt discovered at H17 | Medium | **Critical** | Two mandatory checkpoints (H8, H14) with the whole team stopped | All |
| R10 | **T1 or T2 gets stuck** — the build is concentrated in two people | **Medium** | **Critical** | 45-minute escalation rule; T3/T4 finish their lanes by H15 and become floaters | All |
| R11 | Nobody has rehearsed the pitch | Medium | High | Three rehearsals scheduled; T4 is demo owner from H15 | T4 |

**R10 is the direct cost of this lane structure** and is worth naming out loud at kickoff. The mitigation is cheap: a hard 45-minute stuck-rule, and T3/T4 explicitly on call as floaters once their own lanes close around H15.

**R4 deserves special attention.** Rehearse at least once fully on a phone hotspot with venue wifi disabled. Conference networks block non-standard ports, and HiveMQ's 8884 is exactly the kind of port that gets blocked.

---

## 5. Vibe-Coding Playbook

### Highest yield — generate almost whole, review lightly
- Pharmacist portal CRUD, billing, stock table *(T3)*
- Analytics dashboard: Recharts + react-simple-maps *(T4)*
- Seed scripts and the translation cache *(T4)*
- Auth flows, forms, layouts, all Tailwind/shadcn UI *(T2 — this is where T2's volume becomes tractable)*
- The four specialist prompt configs *(T1)*
- Twilio send + cron worker *(T4)*

### Medium — generate in pieces, verify each
- FastAPI provider classes — give it the `Protocol`, ask for one implementation at a time *(T1)*
- MQTT clients — specify QoS 1, `clean_session=False` and a stable `client_id` **explicitly**; models default to sloppy settings here *(T2)*
- Rules engine — paste arch §6 verbatim, it's already near-code *(T1)*
- Outbox sync worker *(T1)*

### Low — think first, generate second
- **The voicebot orchestrator.** State management, timeouts and the turn loop are where correctness actually lives. Write the state shape by hand, then generate the functions around it.
- The 90s/90s timeout logic
- Anything touching demo-critical timing

### Do not vibe-code
- `db/001_schema.sql` — already written in arch §3.2, use it verbatim
- Env/secret wiring — type it yourself, once, carefully
- The demo script

### Prompting rules that measurably help here
1. **Paste the relevant arch section into the prompt.** "Implement arch §5.2's `VoicebotTurn` contract" beats "make a voicebot" by an enormous margin.
2. **One file per request.** Multi-file generations drift from the schema, and reconciling takes longer than writing.
3. **Types and contracts first, implementation second.** Generate the Pydantic model / TS interface, eyeball it, *then* ask for the body.
4. **Paste real error text, never paraphrase.** Stack traces contain the answer.
5. **State the constraint that makes it hard.** "8 GB VRAM, model must stay loaded" changes the answer entirely versus omitting it.
6. When a generation is 80% right, **edit it yourself.** Re-prompting a near-miss is usually slower and often regresses the part that worked.
7. **T2 specifically:** generate page-by-page against the seeded fake reports, never "build the doctor portal." Volume is only an advantage if each request stays small.

---

## 6. Deviations from v5 you should consciously accept

| v5 said | We're doing | Why |
|---|---|---|
| §40: one build-time language | Four runtime languages, nurse-selected | You asked for ta/ml/hi/en; Whisper makes it real |
| §6.4: single backend simulating edge/central | **Two real nodes** | You have two laptops — the concession is unnecessary |
| §1.2: voicebot composes questions freely | **Unchanged — voicebot composes freely.** Translation is runtime (local IndicTrans2), with a ~20-entry cache for speed | No deviation. The LLM is the feature; the cache sits underneath it |
| §5.3: 48h follow-up default | 90s, configurable | Must be demonstrable on stage; the real default stays in the code |
| §1.2: 90s/90s timeout | 20s/20s, configurable | Same reason |
| §8.3: 10-min consult timeout | 45s, configurable | Same reason |

All six are defensible out loud. The last three are literally environment variables — say "configurable, set low for the demo" and it reads as thoughtful rather than as a shortcut.

---

## 7. Before You Write Any Code

- [ ] LM Studio model download started
- [ ] Supabase project created, connection string in hand
- [ ] HiveMQ Cloud instance created, credentials in hand
- [ ] Groq API key tested with one `curl`
- [ ] Twilio account + number + verified recipient
- [ ] Both laptops on the same network, both can reach the internet
- [ ] Lane assignments agreed and written down
- [ ] Cut ladder (§3) read aloud by all four, so nobody argues about it at hour 14
- [ ] 45-minute stuck-escalation rule agreed (R10)
- [ ] T4 confirmed as demo owner from H15

---

*Architecture: `Project_Vaidhya_Technical_Architecture_v1.md` · Product contract: `Project_Vaidhya_Architecture_v5.md`*
