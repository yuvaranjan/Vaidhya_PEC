# Setup

Two commands, one of them optional. If anything here is wrong or out of date,
fix it: `npm run check` fails the pre-commit hook when this file drifts from
reality.

---

## One-click start

**Windows**: double-click **`start.bat`**.

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
2. create `apps/web/.env.local` and `services/edge-ai/.env` from the examples, and generate a `SESSION_SECRET`
3. `npm install` at the root
4. create `services/edge-ai/.venv` and install `requirements.txt`
5. regenerate `PROGRESS.md`
6. start both servers and open the browser

On later runs it skips everything already present and goes straight to launch.

| Flag | Effect |
|---|---|
| `-Check` / `--check` | verify the machine is ready, start nothing |
| `-WebOnly` / `--web-only` | portal only, no Python service |

**Stop:** close the server windows on Windows, or Ctrl-C on macOS/Linux.

---

## What runs

| | URL | Serves |
|---|---|---|
| Portal (`apps/web`) | http://localhost:3000 | patient, nurse, doctor, pharmacy, analytics screens |
| Edge AI (`services/edge-ai`) | http://localhost:8000/health | voicebot, rules engine, report builder, outbox sync |

`/health` returns one status per provider. `down` on a provider you have not
built or keyed yet is expected, not a failure.

---

## Database

Project Vaidhya uses Actian VectorAI DB for central persistence. Each former
relational table is stored as a VectorAI collection, and row data is kept in the
point payload. Point IDs are deterministic UUIDs derived from each row's domain
primary key, so re-seeding and edge sync are idempotent.

Do this once as a team:

1. Start Actian VectorAI DB locally or point at a reachable VectorAI DB server.
2. Put the REST endpoint and token, if auth is enabled, in `apps/web/.env.local` and `services/edge-ai/.env`.
3. Run `npm run seed:actian` from the repo root.

The seed creates the demo logins, branching rules, three pharmacies, stock
items, analytics rows, and three visits already waiting in the doctor's queue.

Until this is done, `NEXT_PUBLIC_USE_MOCK_AI=true` still gives you the patient
flow with no Python service, but screens that query central data need VectorAI
DB.

The historical SQL files under `db/` remain in the repository as schema
reference material. They are not the active runtime database.

---

## Demo Logins

| Who | Login |
|---|---|
| Patient | `9000000001` (Anjali Menon), OTP **123456** |
| Patient | `9000000002`, `9000000003`, `9000000004` |
| Doctor | `9100000001` (Dr. Priya Varghese), password **vaidhya123** |
| Doctor | `9100000002` (Dr. Arun Krishnan), password **vaidhya123** |

No nurse account exists. The nurse is physically present and works inside the
patient's session.

---

## Environment Variables

Copy from the `.example` files. The start script does this for you. Every key
below must appear here, or `npm run check` fails.

### `apps/web/.env.local`

| Key | What it does |
|---|---|
| `NEXT_PUBLIC_NODE_ROLE` | `edge` for the village laptop, `central` for doctor, pharmacy, analytics |
| `NEXT_PUBLIC_JURISDICTION_ID` | which PHC this node belongs to |
| `NEXT_PUBLIC_USE_MOCK_AI` | `true` uses canned responses from `lib/mockAi.ts` |
| `NEXT_PUBLIC_EDGE_AI_URL` | edge service URL, default `http://localhost:8000` |
| `ACTIAN_VECTORAI_URL` | Actian VectorAI DB REST endpoint, default `http://localhost:6573` |
| `ACTIAN_VECTORAI_TOKEN` | optional bearer token for VectorAI DB; server-side only |
| `ACTIAN_VECTORAI_COLLECTION_PREFIX` | collection namespace prefix, default `vaidhya_` |
| `SESSION_SECRET` | signs the iron-session cookie; 32+ chars |
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
| `STT_PROVIDER` / `TTS_PROVIDER` / `TRANSLATE_PROVIDER` / `EDGE_LLM_PROVIDER` | provider selection |
| `EDGE_LLM_URL` / `EDGE_LLM_MODEL` | LM Studio OpenAI-compatible endpoint and model |
| `EDGE_LLM_FALLBACK` / `EDGE_LLM_TIMEOUT_MS` | cloud fallback if the local model is slow |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | optional Gemini provider |
| `ELEVENLABS_API_KEY` | optional ElevenLabs TTS provider |
| `GROQ_API_KEY` / `GROQ_STT_MODEL` / `GROQ_FALLBACK_MODEL` | Whisper turbo and cloud fallback |
| `ON_DEMAND_TIMEOUT_SECONDS` | nurse-finding timeout |
| `ACTIAN_VECTORAI_URL` | Actian VectorAI DB REST endpoint used by outbox sync |
| `ACTIAN_VECTORAI_TOKEN` | optional bearer token for VectorAI DB |
| `ACTIAN_VECTORAI_COLLECTION_PREFIX` | collection namespace prefix, default `vaidhya_` |
| `ACTIAN_VECTORAI_DIMENSION` | deterministic vector size for row payload storage, default `8` |
| `EDGE_DB_PATH` / `AUDIO_DIR` | local SQLite and generated mp3s |
| `MQTT_URL` / `MQTT_USERNAME` / `MQTT_PASSWORD` | broker |
| `GEMINI_API_KEY` / `ELEVENLABS_API_KEY` | api keys |

---

## Local AI Model

The offline claim needs a local LLM. Install [LM Studio](https://lmstudio.ai),
download `qwen2.5-7b-instruct`, and start its server on `:8080`. Without it,
`EDGE_LLM_FALLBACK=groq` keeps the flow working over the network.

---

## Manual Setup

```bash
npm install
cp apps/web/.env.local.example apps/web/.env.local
npm run seed:actian
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

## Starting a Coding Session

Open Claude Code in the repo root and type your lane's command: `/t1`, `/t2`,
`/t3`, or `/t4`. It loads your status file, lane brief, contract, and team
board, then picks up where you left off.

## Everyday Commands

| Command | What it does |
|---|---|
| `npm start` | one-click start |
| `npm run setup` | install everything, start nothing |
| `npm run dev` | portal only |
| `npm run build` | production build of the portal |
| `npm run seed:actian` | create VectorAI collections and seed demo data |
| `npm run progress` | regenerate `PROGRESS.md` from `agents/status/*.md` |
| `npm run check` | verify this guide and the board are in sync with the code |

---

## When Something Is Wrong

| Symptom | Cause |
|---|---|
| `ACTIAN_VECTORAI_URL missing` | the database step above has not been done |
| `SESSION_SECRET missing` | `.env.local` was created by hand and needs 32+ chars |
| Portal loads, AI does nothing | `NEXT_PUBLIC_USE_MOCK_AI=false` but nothing is listening on `:8000` |
| `501 not_implemented` from the edge service | that endpoint is still a stub; the JSON says which lane and task owns it |
| `/health` shows `down` everywhere | expected until provider keys and local services are configured |
| Doctor queue is empty | run `npm run seed:actian`; it puts three visits there |
| `start.ps1` will not run | use `start.bat`, which bypasses the execution policy |

---

Who is building what, and how close the demo is: **[PROGRESS.md](PROGRESS.md)**.
How the team works in parallel: **[agents/README.md](agents/README.md)**.
