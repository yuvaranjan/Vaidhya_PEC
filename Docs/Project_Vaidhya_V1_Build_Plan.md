# Project Vaidhya — V1 Build Plan (the spine)

> Build this first, end to end, before anything else. Everything in `Project_Vaidhya_Technical_Architecture_v1.md` that isn't listed here is **phase 2** — it hangs off this spine once the spine works.
>
> Architecture reference: `Project_Vaidhya_Technical_Architecture_v1.md`. Lane/schedule reference: `Project_Vaidhya_Implementation_Plan_v1.md`.

---

## 1. V1 Scope — the eleven steps

1. Patient login (phone + OTP `123456`). Doctor login (phone + password).
2. **No nurse account** — the nurse is present and uses the patient's session. Enters 5 vitals on a dashboard.
3. On submit, auto-navigates to the AI assistant page.
4. AI converses with the patient in their local language, gathering complaints.
5. Mid-conversation, the AI may pause and ask the nurse to perform a physical check, then resume with that finding.
6. AI generates a full diagnostic summary.
7. Summary reaches the doctor's queue (Supabase write + MQTT live notify). Patient waits.
8. Doctor accepts → MQTT consult channel opens on that visit.
9. Doctor types a question → AI voices it to the patient in local language → answer relayed back as English text.
10. Doctor issues a prescription. Patient views/downloads it and sees nearby pharmacies with per-medicine stock.
11. Doctor can click **Specialist AI** → structured clinical opinion (confidence, evidence trace, reasoning).

**Deferred to phase 2:** pharmacist portal internals (stock CRUD, billing), analytics dashboard, Twilio SMS/IVR, offline SQLite + outbox sync, photo/visual symptom capture, multiple specialties, video/audio modes.

> ⚠️ Two deferred items — **offline local-first storage** and **SMS to real phones** — are explicit Core Requirements in `Problem_Statement.md`. Deferring them is correct sequencing; forgetting them is a lost judging criterion. They come back immediately after V1.

---

## 2. How T1 and T2 integrate

**There is no merge.** T1 and T2 never edit the same file. Two processes, two directories, two languages:

| | T1 | T2 |
|---|---|---|
| Directory | `services/edge-ai/` | `apps/web/` |
| Language | Python only | TypeScript only |
| Runs as | `uvicorn` on `:8000` | `next dev` on `:3000` |
| Opens the other's files | Never | Never |

They agree on exactly two contracts, frozen in hour 1. Nothing else.

### 2.1 Seam A — HTTP (patient browser → edge-ai, same laptop)

```
POST /session/start
  {visit_id, patient_id, language}          // language: "ml"|"ta"|"hi"|"en"
  → {session_id, greeting_text_en, greeting_text_native, greeting_audio_url}

POST /vitals
  {visit_id, phase, readings:[{type, value_numeric?, value_text?}]}
                                            // phase: "pass_one_baseline"|"on_demand"
  → {ok, fired_flags:[{rule_id, description}]}

POST /voice/turn                            // multipart: audio(webm), visit_id
  → TurnResponse                            // see 2.3

GET  /session/{visit_id}/state
  → SessionState                            // see 2.3 — poll every 2s

POST /intake/complete
  {visit_id}
  → {report_id, chief_complaint, summary_text, urgency_tier:{tier, flags[], flag_count}}

POST /consult/ask                           // TEST CONVENIENCE ONLY
  {visit_id, question_en}                   // real path is MQTT (2.2); this lets T1
  → {ok}                                    // test the flow without a broker

GET  /health
  → {llm, stt, tts, translate, mqtt}        // each "ok" | "down"
```

### 2.2 Seam B — MQTT (doctor browser ↔ edge-ai, across laptops)

The doctor is on a different machine, so HTTP to `localhost:8000` is unreachable. **Every doctor↔edge interaction is MQTT.** That constraint is what makes MQTT genuinely load-bearing rather than decorative.

| Topic | Publisher | Subscriber | Payload |
|---|---|---|---|
| `vaidhya/queue/new` | edge-ai | doctor browser | `{visit_id, patient_name, chief_complaint, urgency_tier, generated_at}` — **retained** |
| `vaidhya/consult/{visit_id}/doctor_to_patient` | doctor browser | edge-ai | `{message_id, sender:"doctor", text, timestamp}` |
| `vaidhya/consult/{visit_id}/patient_to_doctor` | edge-ai | doctor browser | `{message_id, sender:"patient_voicebot", text, timestamp}` |
| `vaidhya/consult/{visit_id}/status` | edge-ai | doctor browser | `{state:"connected"\|"patient_disconnected"\|"reconnected"}` |

QoS 1, `clean_session=false`, stable `client_id` per role. De-dup on `message_id` with a capped in-memory set.

**On step 7, do both:** write the report to Supabase *and* publish to `vaidhya/queue/new`. The DB is the durable record (queue survives a refresh, or a doctor who logs in late); MQTT makes the queue update live without polling. ~30 lines for both.

### 2.3 Shared response shapes

```jsonc
// TurnResponse
{
  "transcript_native": "വയറുവേദന രണ്ട് ദിവസമായി",
  "transcript_en":     "stomach pain for two days",
  "bot_text_en":       "Has the pain moved to the lower right side?",
  "bot_text_native":   "വേദന വലതു വശത്തേക്ക് മാറിയോ?",
  "bot_audio_url":     "/audio/8f3a....mp3",
  "next_action":       "ask_question",   // ask_question | request_nurse_finding | complete_intake
  "pending_finding":   null,             // or {reading_id, type, instruction_en}
  "intake_done":       false
}

// SessionState  (GET /session/{visit_id}/state — poll every 2s)
{
  "visit_id": "...",
  "phase": "conversation",               // pass_one | conversation | awaiting_finding | complete
  "pending_finding": null,               // or {reading_id, type, instruction_en,
                                         //     elapsed_s, status:"requested"|"reminded"}
  "turn_count": 3
}
```

### 2.4 The mock layer — how nobody blocks

T2 sets `NEXT_PUBLIC_USE_MOCK_AI=true` and gets canned responses in exactly the shapes above: a fake transcript, a fake bot reply, a fake summary, a fake pending finding on turn 3. **T2 can build and fully style the entire patient flow before T1's model has finished downloading.**

Write `apps/web/lib/mockAi.ts` **during the hour-1 contract freeze, with T1 and T2 both at the same screen, once.** It's ~40 lines and it is the highest-value file T2 writes all night. When T1 is ready, flip the flag to `false`; if the contract held, it just works.

T1 tests with `curl` and a `.http` file. T1 never opens a browser.

### 2.5 Database write ownership

No two lanes write the same rows.

| Table | Writer |
|---|---|
| `visits` (create → `awaiting_doctor`) | T1 |
| `visits` (`awaiting_doctor` → `in_consult` → `completed`) | T2 |
| `vitals_readings`, `diagnostic_reports` | T1 |
| `prescriptions` | T2 |
| `pharmacies`, `stock_items`, `pharmacy_queue` | T3 |
| `patients`, `doctors`, `jurisdictions`, `branching_rules`, `question_bank` | T4 (seed) |

`visits` is the one shared table, and the handoff is a clean state boundary: T1 owns it until `awaiting_doctor`, T2 owns it after. Never simultaneous.

---

## 3. Theme (all four lanes, frozen hour 1)

Four people vibe-coding UI without shared tokens produces four different-looking apps. Paste into `tailwind.config.ts` before anyone builds a screen.

```js
colors: {
  bg:      '#F7FBF8',   // page background — barely-green white
  surface: '#FFFFFF',   // cards
  border:  '#E3EDE7',
  primary: { 50:'#F1F8F4', 100:'#DCEFE3', 200:'#BFE0CC', 300:'#9BCEAF',
             400:'#6FB78C', 500:'#4A9E6E', 600:'#3A8058', 700:'#2E6545' },
  text:    '#1F2A24',   // dark slate — never pure black
  muted:   '#5C6B62',
  warn:    '#E8A33D',   // urgency: elevated
  danger:  '#D9534F',   // urgency: urgent
}
```

**Rules, non-negotiable across lanes:**
- **Light mode only.** No `dark:` variants anywhere. Do not add a theme toggle.
- **Flat 2D.** No gradients, no glassmorphism, no blur. `shadow-sm` is the maximum; prefer `border border-border` instead of shadow.
- `rounded-xl` cards, `rounded-lg` inputs and buttons.
- Generous whitespace — `p-6` on cards, `gap-4` minimum between form fields.
- Green is for **primary actions and accents only**. The canvas stays white so clinical text reads cleanly.
- Amber and red appear **only** on urgency indicators. Never decorative.
- Body text `text-text`, secondary `text-muted`. Minimum 15px in clinical content.

---

## 4. T1 — AI Lane (~13.5h)

`services/edge-ai/`

| # | Task | Est | Notes |
|---|---|---|---|
| 1 | FastAPI scaffold, CORS for `:3000`, `/health` | 0.5h | Do first — T2 needs the port live |
| 2 | `LLMProvider` → LM Studio + Groq fallback | 1h | `EDGE_LLM_TIMEOUT_MS` then fall back |
| 3 | `STTProvider` → Groq Whisper turbo | 1h | Returns native + English |
| 4 | `TTSProvider` → edge-tts + serve `/audio/*.mp3` | 1h | Write to temp dir, serve statically |
| 5 | `TranslateProvider` → IndicTrans2 + cache lookup | 1.5h | Cache miss is normal, not an error |
| 6 | Session store (dict + SQLite persist) | 1h | Keyed by `visit_id` |
| 7 | **Voicebot turn loop** + JSON schema + retry/fallback | 2.5h | The core. See arch Sec 5.2 |
| 8 | **Nurse-finding state machine** (lazy, see 4.1) | 1.5h | Fiddliest part — no background timers |
| 9 | Rules engine + urgency tiering | 1h | Paste arch Sec 6, it's near-code |
| 10 | Report builder + Supabase write | 1h | One LLM call for summary |
| 11 | MQTT client (publish queue/new, consult both ways) | 1.5h | QoS 1, stable client_id |

**Also owned by T1:** the Specialist AI slice — `/api/specialist` route in Next.js (Groq call, structured JSON) plus the panel that renders it. ~1h. One general button, no specialty picker.

### 4.1 Nurse-finding state machine — build it lazily

**Do not use `asyncio` timers or background tasks.** Compute state from timestamps on every poll. It cannot race, it survives a restart, and it cannot hang.

```python
REQUEST_TIMEOUT_S = 20   # demo value; production 90 (arch Sec 5.4)

def resolve_pending(session):
    f = session.pending_finding
    if f is None:
        return None
    elapsed = now() - f.requested_at

    if f.entered_at:                      # nurse answered
        session.pending_finding = None
        return "resume"
    if elapsed > 2 * REQUEST_TIMEOUT_S:   # gave up
        mark_reading(f.reading_id, status="not_obtained")
        session.pending_finding = None
        return "resume_without"
    if elapsed > REQUEST_TIMEOUT_S and f.status == "requested":
        f.status = "reminded"
        return "remind"                   # re-voice the request once
    return "waiting"
```

Called at the top of `GET /session/{visit_id}/state` and `POST /voice/turn`. That's the whole mechanism.

**Definition of done:** `curl` a Malayalam audio file to `/voice/turn` and get back Malayalam bot audio plus an English transcript; `/intake/complete` writes a report to Supabase and publishes to `vaidhya/queue/new`.

---

## 5. T2 — Portal Lane (~13h)

`apps/web/`

| # | Task | Est | Notes |
|---|---|---|---|
| 1 | Next.js scaffold, theme tokens, layout shell | 1h | Sec 3 tokens first |
| 2 | **`lib/mockAi.ts`** — with T1, same screen | 0.5h | Unblocks everything below |
| 3 | Patient login (phone + OTP `123456`) | 1h | `iron-session` cookie |
| 4 | Doctor login (phone + password) | 1h | bcrypt against seed |
| 5 | Vitals dashboard — 5 fields → POST → auto-navigate | 1.5h | Temp, BP, pulse, SpO2, resp rate |
| 6 | **AI assistant page** — mic, playback, dual transcript | 2.5h | English always shown beside native |
| 7 | Nurse-finding panel (from poll, input, submit) | 1h | Appears inline, doesn't navigate away |
| 8 | Doctor queue — MQTT live + claim CAS + 409 toast | 2h | Arch Sec 9 |
| 9 | Doctor consult — report view + MQTT chat | 2h | Ask question → publish → await reply |
| 10 | Doctor prescription form | 1h | Patient-side view is T3's |

**Critical UI rule for step 6:** the bot's **English text is always on screen** next to the native-language audio, and the transcript shows both languages. This is the mitigation for risk R3b (an LLM-authored, machine-translated clinical question nobody proofread) and it makes the demo legible to judges who don't speak Malayalam. ~15 minutes. Not optional.

**Definition of done:** with `USE_MOCK_AI=true`, the full patient flow runs start to finish in the browser; with it `false`, the same flow runs against T1's service.

---

## 6. T3 — Prescription Delivery + Pharmacy Data (~6h for V1)

| # | Task | Est | Notes |
|---|---|---|---|
| 1 | Seed pharmacies + stock | 1h | **One pharmacy out-of-stock on one prescribed medicine** |
| 2 | `GET /api/pharmacies/nearby` + haversine | 1h | Arch Sec 11 |
| 3 | Patient prescription view + print/download | 1.5h | This is how the Rx is delivered — not SMS |
| 4 | Nearby list with per-medicine status + selection | 1.5h | `in stock` / `low` / `out of stock` |
| 5 | Routing → `pharmacy_queue` insert | 1h | Arch Sec 8.2, unique constraint |

After V1: the full pharmacist portal (stock CRUD, incoming queue, billing).

**Definition of done:** doctor issues a prescription → patient sees it, downloads it, sees which nearby pharmacy has all the medicines, selects one, it lands in that pharmacy's queue.

---

## 7. T4 — Unblocking work during V1 (~3h)

| # | Task | Est | Why it's first |
|---|---|---|---|
| 1 | **3 fake `diagnostic_reports` rows** | 1h | Unblocks T2 steps 8–9 immediately |
| 2 | Seed jurisdictions, patients, doctors | 1h | Everyone needs login accounts |
| 3 | Translation cache — ~20 phrasings × 4 languages | 1h | Optional; system works empty |

After V1: Twilio, analytics dashboard.

---

## 8. Build Order & Checkpoints

| When | Gate |
|---|---|
| **Hour 1** | Contract freeze: schema applied, `mockAi.ts` written together, theme tokens in, `.env.example` |
| **Hour 2.5** | Risk spikes proven: LM Studio JSON, Groq Whisper on Malayalam, edge-tts on Malayalam, MQTT tab-to-tab |
| **Hour 6** | T2's full patient flow runs on mocks. T1's `/voice/turn` returns real audio via curl |
| **Hour 8** | **Flip `USE_MOCK_AI=false`.** First real integration. Steps 1–6 work |
| **Hour 11** | Steps 7–9: summary reaches doctor queue, claim works, MQTT consult round-trips |
| **Hour 13** | Steps 10–11: prescription + pharmacy + specialist opinion. **V1 complete** |
| **Hour 13+** | Phase 2 from the cut ladder: offline sync, Twilio, pharmacist portal, analytics |

The hour-8 flag flip is the moment of truth. If the contract was frozen properly in hour 1, it's a ten-minute integration. If it wasn't, it's four hours — which is precisely why hour 1 is spent on `mockAi.ts` and not on features.
