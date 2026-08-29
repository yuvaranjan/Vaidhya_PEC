# Setup

Two commands, one of them optional. If anything here is wrong or out of date, fix it —
`npm run check` fails the pre-commit hook when this file drifts from reality.

---

## One-click start

**Windows** — double-click **`start.bat`**. That is the whole thing.

Or from a terminal:

```bash
./start.bat
```

**macOS / Linux:**

```bash
./start.sh
```

The script is safe to run repeatedly. On the first run it will:

1. check Node 20+ and Python are installed
2. create `apps/web/.env.local` and `services/edge-ai/.env` from the examples, and
   generate a `SESSION_SECRET`
3. `npm install` at the root (workspaces: `apps/web`, `packages/shared`)
4. create `services/edge-ai/.venv` and install `requirements.txt`
5. regenerate `PROGRESS.md`
6. start both servers in their own windows and open the browser

On later runs it skips everything already present and goes straight to step 6.

| Flag | Effect |
|---|---|
| `-Check` / `--check` | verify the machine is ready, start nothing |
| `-WebOnly` / `--web-only` | portal only, no Python service — mock AI mode |

**Stop:** close the two server windows (Windows), or Ctrl-C (macOS/Linux).

---

## What ends up running

| | URL | Serves |
|---|---|---|
| Portal (`apps/web`) | http://localhost:3000 | patient, nurse, doctor, pharmacy screens |
| Edge AI (`services/edge-ai`) | http://localhost:8000/health | voicebot, rules engine, report builder |

`/health` returns one status per provider. `down` on a provider you have not built or
keyed yet is expected, not a failure.

---

## The database — do this once, as a team

The one step no script can do for you: someone has to create the Supabase project.

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run **`db/001_schema.sql`**, then **`db/002_seed.sql`**.
   Both are idempotent — safe to re-run.
3. From Project Settings → API, copy the URL and the **service role** key into
   `apps/web/.env.local` and `services/edge-ai/.env`.

The seed creates the demo logins, the branching rules, three pharmacies (one
deliberately out of stock), and three visits already waiting in the doctor's queue —
so the doctor screens are buildable before the AI pipeline exists.

Until this is done, `NEXT_PUBLIC_USE_MOCK_AI=true` still gives you the entire patient
flow with no database and no Python at all.

---

## Demo logins

| Who | Login |
|---|---|
| Patient | `9000000001` (Anjali Menon) · OTP **123456** |
| Patient | `9000000002` · `9000000003` · `9000000004` |
| Doctor | `9100000001` (Dr. Priya Varghese) · password **vaidhya123** |
| Doctor | `9100000002` (Dr. Arun Krishnan) · password **vaidhya123** |

No nurse account exists. The nurse is physically present and works inside the patient's
session.

---

## Environment variables

Copy from the `.example` files — the start script does this for you. Every key below
must appear here, or `npm run check` fails.

### `apps/web/.env.local`

| Key | What it does |
|---|---|
| `NEXT_PUBLIC_NODE_ROLE` | `edge` (village laptop: patient + nurse) or `central` (city laptop: doctor + pharmacy) |
| `NEXT_PUBLIC_JURISDICTION_ID` | which PHC this node belongs to |
| `NEXT_PUBLIC_USE_MOCK_AI` | `true` → canned responses from `lib/mockAi.ts`, no Python needed. The hour-8 switch. |
| `NEXT_PUBLIC_EDGE_AI_URL` | where the edge service lives, default `http://localhost:8000` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | database. The service key bypasses RLS — server-side only, never in a `NEXT_PUBLIC_` var. |
| `SESSION_SECRET` | signs the iron-session cookie. 32+ chars; the start script generates one. |
| `NEXT_PUBLIC_MQTT_URL` | HiveMQ Cloud over WSS, port 8884 |
| `NEXT_PUBLIC_MQTT_USERNAME` / `NEXT_PUBLIC_MQTT_PASSWORD` | broker credentials |
| `GROQ_API_KEY` | Specialist AI |
| `GROQ_SPECIALIST_MODEL` | default `llama-3.3-70b-versatile` |
| `NEARBY_RADIUS_KM` | pharmacy search radius |
| `CONSULT_TIMEOUT_SECONDS` | how long before an abandoned consult requeues |

### `services/edge-ai/.env`

| Key | What it does |
|---|---|
| `JURISDICTION_ID` | identity of this edge node; also its MQTT client id |
| `WEB_ORIGIN` | CORS origin for the portal, default `http://localhost:3000` |
| `STT_PROVIDER` / `TTS_PROVIDER` / `TRANSLATE_PROVIDER` / `EDGE_LLM_PROVIDER` | which implementation each abstraction resolves to |
| `EDGE_LLM_URL` / `EDGE_LLM_MODEL` | LM Studio's OpenAI-compatible endpoint and model |
| `EDGE_LLM_FALLBACK` / `EDGE_LLM_TIMEOUT_MS` | fall back to Groq if the local model is slow |
| `GROQ_API_KEY` / `GROQ_STT_MODEL` / `GROQ_FALLBACK_MODEL` | Whisper turbo + the cloud fallback |
| `ON_DEMAND_TIMEOUT_SECONDS` | nurse-finding timeout. 20 for the demo, 90 in production. |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | report writes |
| `EDGE_DB_PATH` / `AUDIO_DIR` | local SQLite and the generated mp3s |
| `MQTT_URL` / `MQTT_USERNAME` / `MQTT_PASSWORD` | broker |

---

## Local AI model (T1 only, optional)

The offline claim needs a local LLM. Install [LM Studio](https://lmstudio.ai), download
`qwen2.5-7b-instruct`, and start its server on `:8080`. Without it, `EDGE_LLM_FALLBACK=groq`
keeps everything working over the network — you just lose the "no internet" demo.

---

## Manual setup, if you would rather not use the script

```bash
npm install
cp apps/web/.env.local.example apps/web/.env.local
npm run dev
```

```bash
cd services/edge-ai
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

---

## Starting a coding session

Open Claude Code in the repo root and type your lane's command — `/t1`, `/t2`, `/t3` or
`/t4`. It loads your status file, your lane brief, the contract you code against and the
team board, tells you which architecture sections your next task maps to, and picks up
where you left off. Add an argument to aim it: `/t1 task 7`.

The commands are committed in `.claude/commands/`, so they arrive with a fresh clone. If
they do not appear in a session that was already open, restart Claude Code.

## Everyday commands

| Command | What it does |
|---|---|
| `npm start` | one-click start (same as `start.bat`) |
| `npm run setup` | install everything, start nothing |
| `npm run dev` | portal only |
| `npm run build` | production build of the portal |
| `npm run progress` | regenerate `PROGRESS.md` from `agents/status/*.md` |
| `npm run check` | verify this guide and the board are in sync with the code |

---

## When something is wrong

| Symptom | Cause |
|---|---|
| `SUPABASE_URL / SUPABASE_SERVICE_KEY missing` | the database step above has not been done |
| `SESSION_SECRET missing` | `.env.local` was created by hand; needs 32+ chars |
| Portal loads, AI does nothing | `NEXT_PUBLIC_USE_MOCK_AI=false` but nothing is listening on `:8000` |
| `501 not_implemented` from the edge service | that endpoint is still a stub; the JSON says which lane and task owns it |
| `/health` shows `down` everywhere | expected until T1 builds the providers |
| Doctor queue is empty | run `db/002_seed.sql`; it puts three visits there |
| `start.ps1` will not run | use `start.bat`, which bypasses the execution policy |

---

Who is building what, and how close the demo is: **[PROGRESS.md](PROGRESS.md)**.
How the team works in parallel: **[agents/README.md](agents/README.md)**.
