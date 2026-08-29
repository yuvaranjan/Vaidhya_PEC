# Project Vaidhya

Edge-AI telemedicine for rural primary care. A patient walks into a village PHC with
no doctor; a nurse takes five vitals; a voice AI running **on the laptop in that room**
interviews the patient in Malayalam, pauses to ask the nurse for a physical check when
it needs one, and hands a doctor in the city a finished clinical summary. The doctor
consults over MQTT, prescribes, and the patient sees which nearby pharmacy actually has
the medicines in stock.

Hackathon build — IES College, Thrissur.

**Start here:** [SETUP.md](SETUP.md) to install and run · [PROGRESS.md](PROGRESS.md) for
who is building what and how close the demo is · [agents/README.md](agents/README.md) for
how four people build this in parallel without colliding.

```bash
./start.bat
```

That installs everything missing and launches both servers. On macOS or Linux, `./start.sh`.

---

## Repository layout

```
apps/web/              Next.js 15 · TypeScript · Tailwind v4   → T2 (Yadav)
services/edge-ai/      FastAPI · Python                        → T1 (Yuvaranjan)
packages/shared/       The two frozen contracts (HTTP + MQTT)  → both, changed together
db/                    Supabase schema + seed
agents/                Lane briefs + the living status board
scripts/               Progress generator, doc-drift checker, git hooks
Docs/                  Architecture, implementation plan, build plan
```

**T1 and T2 never edit the same file.** Two processes, two directories, two languages.
There is no merge conflict to resolve because there is no shared file to conflict over —
except `packages/shared/`, which is the contract, and which changes only with both people
looking at the same screen.

| | T1 | T2 |
|---|---|---|
| Directory | `services/edge-ai/` | `apps/web/` |
| Language | Python only | TypeScript only |
| Runs as | `uvicorn` on `:8000` | `next dev` on `:3000` |
| Opens the other's files | Never | Never |

The one exception: `apps/web/app/api/specialist/route.ts` is **T1's**. It is the only
TypeScript file T1 touches.

---

## Setup

### 0. Database (once, by whoever gets there first)

In the Supabase SQL editor, run in order:

1. `db/001_schema.sql`
2. `db/002_seed.sql`

The seed creates login accounts, branching rules, three pharmacies (one deliberately
out of stock), and **three ready-made visits sitting in the doctor queue** — so T2 can
build the queue and consult screens before T1's pipeline produces anything real.

### 1. Web portal — T2

```bash
npm install
cp apps/web/.env.local.example apps/web/.env.local
npm run dev
```

→ http://localhost:3000

`NEXT_PUBLIC_USE_MOCK_AI=true` is the default. The entire patient flow runs against
`lib/mockAi.ts` with no Python service, no model, and no GPU. That is the point: **T2 is
never blocked on T1.**

### 2. Edge AI service — T1

```bash
cd services/edge-ai
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

→ http://localhost:8000/health

`/health` works today. Every other endpoint answers `501` with the task number that owns
it, so T2 can point the real client at a live port immediately and see exactly what is
still missing. Smoke tests live in `services/edge-ai/requests.http` — T1 tests with curl
and never opens a browser.

---

## Demo credentials

| Who | Login |
|---|---|
| Patient | phone `9000000001` (Anjali Menon), OTP **123456** |
| Patient | phone `9000000002` (Rajesh Kumar) · `9000000003` (Fathima Beevi) |
| Doctor | phone `9100000001` (Dr. Priya Varghese), password **vaidhya123** |
| Doctor | phone `9100000002` (Dr. Arun Krishnan), password **vaidhya123** |

There is **no nurse account**. The nurse is physically present and works inside the
patient's session.

---

## The two contracts

Everything else is private to a lane. These two are shared, and they were frozen in hour 1:

- **Seam A — HTTP.** `packages/shared/http.ts` ↔ `services/edge-ai/contracts.py`.
  Patient browser → edge-ai, same laptop.
- **Seam B — MQTT.** `packages/shared/mqtt.ts` ↔ same Python file.
  Doctor browser ↔ edge-ai, across laptops. The doctor cannot reach `localhost:8000` on
  another machine, which is what makes MQTT genuinely load-bearing here rather than
  decorative.

If a field in either changes, both sides change in the same five minutes, and it gets
announced. The TypeScript and Python files are mirrors — keep them identical.

---

## Theme

Frozen hour 1, all lanes, in `apps/web/app/globals.css`. Light mode only, flat 2D, green
for primary actions only, amber and red **only** on urgency indicators. Four people
vibe-coding UI without shared tokens produces four different-looking apps; the rules are
in a comment at the top of that file and they are not negotiable.

Note: Tailwind v4 is CSS-first, so the tokens live in `globals.css` under `@theme`, not in
`tailwind.config.ts` as the build plan describes. Same tokens, same utility names.

---

## Real vs simulated — the honesty table

Judges reward teams who volunteer their boundaries and punish teams caught at them.

| Capability | Status |
|---|---|
| Edge/central two-node split | **Real** — two machines, two model tiers, real broker |
| Local LLM reasoning at the edge | **Real** — Qwen2.5-7B in LM Studio, no internet |
| MQTT doctor↔edge consult | **Real** — HiveMQ Cloud, QoS 1 |
| Doctor queue concurrency | **Real** — compare-and-swap in Postgres |
| STT / TTS | **Cloud-assisted** — Groq Whisper + edge-tts |
| Offline intake + sync | **Deferred to phase 2** — schema and outbox table exist |
| SMS / IVR to real phones | **Deferred to phase 2** — the portal is the delivery channel in V1 |
| Fingerprint identification | **Simulated** — animation resolving to a seeded patient |

The last two are explicit Core Requirements in `Docs/Problem_Statement.md`. Deferring them
is correct sequencing; forgetting them is a lost judging criterion. They come back
immediately after V1.

---

## Where to read next

- `SETUP.md` — install, run, env vars, troubleshooting
- `PROGRESS.md` — generated board: who is on what, and how many §17 demo steps are live
- `agents/README.md` — the parallel-build protocol every teammate follows
- `Docs/Project_Vaidhya_V1_Build_Plan.md` — the eleven steps, the lane split, what to build tonight
- `Docs/Project_Vaidhya_Technical_Architecture_v1.md` — schema, pipeline, MQTT, provider abstraction
- `Docs/Project_Vaidhya_Implementation_Plan_v1.md` — schedule and checkpoints
- `Docs/Problem_Statement.md` — the requirements being graded
