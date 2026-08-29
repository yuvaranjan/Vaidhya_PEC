#!/usr/bin/env node
/**
 * Keeps SETUP.md and the one-click start script honest.
 *
 * The failure this prevents: someone adds an env var, or a service, and nobody finds
 * out until a teammate clones the repo at 2am and nothing starts. Documentation drift
 * is invisible until it is expensive, so it gets checked mechanically.
 *
 *   node scripts/check-setup.mjs          report problems, exit 1 if any
 *   node scripts/check-setup.mjs --warn   report problems, always exit 0
 *
 * Run by the pre-commit hook and by `npm run check`.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const exists = (p) => fs.existsSync(path.join(ROOT, p));

const problems = [];
const fail = (msg) => problems.push(msg);

/* 1. Everything the start script and the guide depend on must actually exist. ----- */

const REQUIRED = [
  "SETUP.md",
  "PROGRESS.md",
  "agents/README.md",
  "agents/demo-steps.json",
  "start.ps1",
  "start.sh",
  "start.bat",
  "package.json",
  "apps/web/package.json",
  "apps/web/.env.local.example",
  "services/edge-ai/requirements.txt",
  "services/edge-ai/.env.example",
  "services/edge-ai/main.py",
  "db/001_schema.sql",
  "db/002_seed.sql",
];

for (const f of REQUIRED) {
  if (!exists(f)) fail(`missing: ${f} — SETUP.md and start.ps1 both assume it exists`);
}

/* 2. Every env key in an example file must be documented in SETUP.md. ------------ */

const setup = exists("SETUP.md") ? read("SETUP.md") : "";

const envKeys = (file) =>
  exists(file)
    ? read(file)
        .split(/\r?\n/)
        .map((l) => l.match(/^([A-Z][A-Z0-9_]*)=/))
        .filter(Boolean)
        .map((m) => m[1])
    : [];

const allKeys = [
  ...envKeys("apps/web/.env.local.example"),
  ...envKeys("services/edge-ai/.env.example"),
];

const undocumented = [...new Set(allKeys)].filter((k) => !setup.includes(k));
if (undocumented.length) {
  fail(
    `env vars not mentioned in SETUP.md: ${undocumented.join(", ")}\n` +
      `    Add them to the environment table, or drop them from the .env.example file.`,
  );
}

/* 3. Every workspace and service must have a documented way to run it. ----------- */

const pkg = JSON.parse(read("package.json"));
for (const script of ["setup", "start", "dev", "progress", "check"]) {
  if (!pkg.scripts?.[script]) fail(`package.json is missing the "${script}" script`);
}
for (const area of ["apps/web", "services/edge-ai"]) {
  if (!setup.includes(area)) fail(`SETUP.md never mentions ${area} — how does a new person run it?`);
}

/* 4. The one-click start must cover both halves of the system. ------------------- */

if (exists("start.ps1")) {
  const ps = read("start.ps1");
  for (const needle of ["npm install", "uvicorn", "npm run dev", "venv"]) {
    if (!ps.includes(needle)) fail(`start.ps1 no longer references "${needle}"`);
  }
}

/* 5. Every lane needs a brief, a status file and a session-start command. -------- */

for (const lane of ["T1", "T2", "T3", "T4"]) {
  const brief = fs
    .readdirSync(path.join(ROOT, "agents", "lanes"))
    .find((f) => f.startsWith(`${lane}-`));
  if (!brief) fail(`no lane brief for ${lane} in agents/lanes/`);
  if (!exists(`agents/status/${lane}.md`)) fail(`no status file agents/status/${lane}.md`);

  const cmd = `.claude/commands/${lane.toLowerCase()}.md`;
  if (!exists(cmd)) {
    fail(`no session-start command ${cmd} — ${lane} has no single-prompt entry point`);
  } else {
    // The command is only useful if it actually points at that lane's files.
    const body = read(cmd);
    for (const needle of [`agents/status/${lane}.md`, "agents/lanes/", "PROGRESS.md"]) {
      if (!body.includes(needle)) fail(`${cmd} no longer references ${needle}`);
    }
  }

  // The brief must map tasks to architecture sections — that is the point of it.
  if (brief && !read(`agents/lanes/${brief}`).includes("Arch §")) {
    fail(`agents/lanes/${brief} lost its task → architecture section map`);
  }
}

/* 6. The contract mirrors must stay in step. ------------------------------------- */

if (exists("packages/shared/http.ts") && exists("services/edge-ai/contracts.py")) {
  const ts = read("packages/shared/http.ts");
  const py = read("services/edge-ai/contracts.py");
  const shapes = [
    "SessionStartRequest",
    "SessionStartResponse",
    "VitalsRequest",
    "VitalsResponse",
    "TurnResponse",
    "SessionState",
    "IntakeCompleteResponse",
    "HealthResponse",
  ];
  const drifted = shapes.filter((s) => ts.includes(s) !== py.includes(s));
  if (drifted.length) {
    fail(
      `contract mirrors out of step: ${drifted.join(", ")}\n` +
        `    packages/shared/http.ts and services/edge-ai/contracts.py must define the same shapes.`,
    );
  }
}

/* ------------------------------------------------------------------------------- */

if (problems.length === 0) {
  console.log("setup docs OK");
  process.exit(0);
}

console.error("\nSetup / docs drift:\n");
for (const p of problems) console.error(`  ✗ ${p}`);
console.error("");

process.exit(process.argv.includes("--warn") ? 0 : 1);
