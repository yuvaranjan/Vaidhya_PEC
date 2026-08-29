#!/usr/bin/env node
/**
 * Regenerates PROGRESS.md from agents/status/*.md.
 *
 * PROGRESS.md is generated. Nobody hand-edits it, so nobody merge-conflicts on it.
 * Each lane writes only its own status file; this script is what turns four private
 * files into one shared board.
 *
 *   node scripts/update-progress.mjs              regenerate
 *   node scripts/update-progress.mjs --check      exit 1 if it is out of date (CI / pre-commit)
 *   node scripts/update-progress.mjs --context    print the board summary as JSON for a SessionStart hook
 *   node scripts/update-progress.mjs --stop-hook  regenerate, then nag once per session about a stale lane
 *
 * No dependencies. Node 20+.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATUS_DIR = path.join(ROOT, "agents", "status");
const OUT = path.join(ROOT, "PROGRESS.md");

const LANES = ["T1", "T2", "T3", "T4"];

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function git(args, fallback = "") {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return fallback;
  }
}

/** Minimal YAML frontmatter reader — scalars and flat [1, 2] arrays only. */
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };

  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w]*):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    let raw = kv[2].trim().replace(/^["']|["']$/g, "");
    if (raw.startsWith("[")) {
      meta[key] = raw
        .slice(1, raw.indexOf("]") === -1 ? undefined : raw.indexOf("]"))
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => (/^\d+$/.test(s) ? Number(s) : s.replace(/^["']|["']$/g, "")));
    } else {
      meta[key] = raw;
    }
  }
  return { meta, body: m[2] };
}

/**
 * Pull the bullets under a `## Heading` out of a status file body.
 *
 * Line scanner rather than a regex: people wrap their bullets across lines, and a
 * wrapped continuation must join the bullet above it rather than vanish.
 */
function section(body, heading) {
  const lines = body.split(/\r?\n/);
  const wanted = heading.trim().toLowerCase();

  let i = lines.findIndex(
    (l) => /^##\s+/.test(l) && l.replace(/^##\s+/, "").trim().toLowerCase() === wanted,
  );
  if (i === -1) return [];

  const bullets = [];
  for (i += 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^#{1,6}\s/.test(line)) break; // next heading ends the section
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^[-*]\s+/.test(trimmed)) {
      bullets.push(trimmed.replace(/^[-*]\s+/, ""));
    } else if (bullets.length) {
      bullets[bullets.length - 1] += ` ${trimmed}`; // wrapped continuation
    }
  }
  return bullets;
}

function readLane(lane) {
  const file = path.join(STATUS_DIR, `${lane}.md`);
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, "utf8");
  const { meta, body } = parseFrontmatter(text);
  return {
    lane,
    file: `agents/status/${lane}.md`,
    owner: meta.owner || "unassigned",
    area: meta.area || "",
    state: meta.state || "not_started",
    now: meta.now || "—",
    updated: meta.updated || "",
    demoDone: Array.isArray(meta.demo_steps_done) ? meta.demo_steps_done.map(Number) : [],
    done: section(body, "Done"),
    inProgress: section(body, "In progress"),
    next: section(body, "Next"),
    blocked: section(body, "Blocked / needs from another lane"),
    notes: section(body, "Notes for other lanes"),
  };
}

/**
 * A lane is stale when its code area has a newer commit than its status file.
 * That is the whole freshness check: did you touch the code and not say so?
 */
function staleness(lane) {
  if (!lane.area) return null;
  const codeAt = git(["log", "-1", "--format=%ct", "--", lane.area]);
  const statusAt = git(["log", "-1", "--format=%ct", "--", lane.file]);
  if (!codeAt) return null;
  if (!statusAt) return { stale: true, behind: "never committed" };
  const gap = Number(codeAt) - Number(statusAt);
  if (gap <= 0) return { stale: false };
  const hours = Math.round(gap / 3600);
  return { stale: true, behind: hours >= 1 ? `${hours}h behind` : "behind" };
}

const STATE_ICON = {
  done: "🟢",
  in_progress: "🔵",
  blocked: "🔴",
  not_started: "⚪",
};

/* ------------------------------------------------------------------ */
/* render                                                              */
/* ------------------------------------------------------------------ */

function render() {
  const demo = JSON.parse(
    fs.readFileSync(path.join(ROOT, "agents", "demo-steps.json"), "utf8"),
  );
  const lanes = LANES.map(readLane).filter(Boolean);

  const claimed = new Map();
  for (const l of lanes) for (const n of l.demoDone) claimed.set(n, l.lane);

  const v1 = demo.steps.filter((s) => s.phase === "v1");
  const v1Done = v1.filter((s) => claimed.has(s.n)).length;
  const allDone = demo.steps.filter((s) => claimed.has(s.n)).length;

  const out = [];
  const w = (s = "") => out.push(s);

  w("# Progress board");
  w();
  w("<!-- GENERATED FILE — do not edit by hand.");
  w("     Edit your own agents/status/<lane>.md and run `npm run progress`.");
  w("     Merge conflict here? Take either side and regenerate. -->");
  w();
  w(
    `Generated ${new Date().toISOString().replace(/\.\d+Z$/, "Z")} from \`agents/status/*.md\` · ` +
      `protocol in [agents/README.md](agents/README.md)`,
  );
  w();

  /* --- who is doing what, right now --- */
  w("## Right now");
  w();
  w("| Lane | Owner | State | Working on | Status file |");
  w("|---|---|---|---|---|");
  for (const l of lanes) {
    const s = staleness(l);
    const flag = s?.stale ? ` ⚠️ _${s.behind}_` : "";
    w(
      `| **${l.lane}** | ${l.owner} | ${STATE_ICON[l.state] ?? "⚪"} ${l.state.replace("_", " ")} | ${l.now}${flag} | \`${l.file}\` |`,
    );
  }
  w();
  if (lanes.some((l) => staleness(l)?.stale)) {
    w(
      "> ⚠️ means that lane's code has been committed more recently than its status file — " +
        "the board is behind the work. Whoever owns it: update your file.",
    );
    w();
  }

  /* --- the only measure of progress that matters --- */
  w("## Demo readiness — the §17 set-piece");
  w();
  w(
    `**V1 path: ${v1Done} / ${v1.length} steps demonstrable.** ` +
      `All phases: ${allDone} / ${demo.steps.length}.`,
  );
  w();
  w("A step counts only if it can be performed live, right now, in front of a judge.");
  w();
  w("| # | Step | Owner | Phase | Demonstrable |");
  w("|---|---|---|---|---|");
  for (const s of demo.steps) {
    const by = claimed.get(s.n);
    const mark = by ? `✅ (${by})` : "—";
    const star = s.critical ? " ⭐" : "";
    w(`| ${s.n} | ${s.title}${star} | ${s.owner} | ${s.phase} | ${mark} |`);
  }
  w();
  w(
    "⭐ = one of the three steps that actually wins it: unplug the wifi, generate the " +
      "report offline, plug back in and watch it sync into the doctor's queue.",
  );
  w();

  /* --- cross-lane blockers, hoisted to the top of everyone's attention --- */
  const blockers = lanes.flatMap((l) =>
    l.blocked.filter((b) => b.startsWith("⛔")).map((b) => ({ lane: l.lane, text: b })),
  );
  w("## Blockers");
  w();
  if (blockers.length === 0) {
    w("Nothing blocked. ");
  } else {
    for (const b of blockers) w(`- **${b.lane}** — ${b.text.replace(/^⛔\s*/, "")}`);
  }
  w();

  /* --- notes that change how other people write code --- */
  const notes = lanes.flatMap((l) => l.notes.map((n) => ({ lane: l.lane, text: n })));
  if (notes.length) {
    w("## Notes from other lanes — read before you write code");
    w();
    for (const n of notes) w(`- **${n.lane}** — ${n.text}`);
    w();
  }

  /* --- per-lane detail --- */
  w("## Lane detail");
  w();
  for (const l of lanes) {
    w(`### ${l.lane} · ${l.owner} · \`${l.area}\``);
    w();
    const list = (title, items, empty) => {
      w(`**${title}**`);
      w();
      if (items.length === 0) w(`- _${empty}_`);
      else for (const i of items) w(`- ${i}`);
      w();
    };
    list("Done", l.done, "nothing yet");
    list("In progress", l.inProgress, "nothing");
    list("Next", l.next, "nothing planned — this lane needs a plan");
    w(`Last self-reported update: ${l.updated || "never"}`);
    w();
  }

  /* --- recent activity, so the board is checkable against reality --- */
  const log = git(["log", "-8", "--format=%h · %ad · %s", "--date=format:%d %b %H:%M"]);
  if (log) {
    w("## Recent commits");
    w();
    w("```");
    w(log);
    w("```");
    w();
  }

  w("---");
  w();
  w(
    "Setup and one-click start: [SETUP.md](SETUP.md) · " +
      "What to build: [Docs/Project_Vaidhya_V1_Build_Plan.md](Docs/Project_Vaidhya_V1_Build_Plan.md) · " +
      "How it works: [Docs/Project_Vaidhya_Technical_Architecture_v1.md](Docs/Project_Vaidhya_Technical_Architecture_v1.md)",
  );
  w();

  return out.join("\n");
}

/** The generated timestamp changes every run, so compare everything except it. */
const withoutTimestamp = (s) => s.replace(/^Generated .*$/m, "Generated <ts>");

/* ------------------------------------------------------------------ */
/* modes                                                               */
/* ------------------------------------------------------------------ */

const args = process.argv.slice(2);
const content = render();

if (args.includes("--check")) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (withoutTimestamp(current) !== withoutTimestamp(content)) {
    console.error("PROGRESS.md is out of date. Run: npm run progress");
    process.exit(1);
  }
  const stale = LANES.map(readLane)
    .filter(Boolean)
    .filter((l) => staleness(l)?.stale);
  if (stale.length) {
    console.error(
      `Status files behind their code: ${stale.map((l) => l.lane).join(", ")}. ` +
        `Update agents/status/<lane>.md.`,
    );
    process.exit(1);
  }
  process.exit(0);
}

if (args.includes("--context")) {
  // SessionStart hook: hand the agent the board so it knows what the others are doing
  // without opening a single source file.
  const lanes = LANES.map(readLane).filter(Boolean);
  const demo = JSON.parse(
    fs.readFileSync(path.join(ROOT, "agents", "demo-steps.json"), "utf8"),
  );
  const claimed = new Set(lanes.flatMap((l) => l.demoDone));
  const v1 = demo.steps.filter((s) => s.phase === "v1");

  const lines = [
    "Team board (generated from agents/status/*.md — this is a parallel-build repo).",
    "",
    `Demo readiness: ${v1.filter((s) => claimed.has(s.n)).length}/${v1.length} V1 steps of the §17 set-piece are demonstrable.`,
    "",
    ...lanes.map(
      (l) =>
        `${l.lane} (${l.owner}, ${l.area}): ${l.state} — ${l.now}` +
        (staleness(l)?.stale ? " [status file is behind its code]" : ""),
    ),
  ];

  const blockers = lanes.flatMap((l) =>
    l.blocked.filter((b) => b.startsWith("⛔")).map((b) => `${l.lane}: ${b.replace(/^⛔\s*/, "")}`),
  );
  if (blockers.length) lines.push("", "Blockers:", ...blockers.map((b) => `- ${b}`));

  const notes = lanes.flatMap((l) => l.notes.map((n) => `${l.lane}: ${n}`));
  if (notes.length) lines.push("", "Cross-lane notes:", ...notes.map((n) => `- ${n}`));

  lines.push(
    "",
    "Before you stop working, update your own lane's file in agents/status/. Never edit another lane's.",
    "Protocol: agents/README.md",
  );

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: lines.join("\n"),
      },
    }),
  );
  process.exit(0);
}

// Default and --stop-hook: write the file.
fs.writeFileSync(OUT, content, "utf8");

if (args.includes("--stop-hook")) {
  // Nag at most once per session, so a lane that genuinely has nothing to report can
  // stop working. Sentinel lives in .git/ — never committed, cleared by a fresh clone.
  let sessionId = "unknown";
  try {
    const stdin = fs.readFileSync(0, "utf8");
    sessionId = JSON.parse(stdin).session_id ?? "unknown";
  } catch {
    /* no stdin, or not JSON — fall through with "unknown" */
  }

  const stale = LANES.map(readLane)
    .filter(Boolean)
    .filter((l) => staleness(l)?.stale);

  if (stale.length) {
    const sentinel = path.join(ROOT, ".git", `vaidhya-progress-nag-${sessionId}`);
    if (!fs.existsSync(sentinel)) {
      fs.writeFileSync(sentinel, String(Date.now()));
      process.stdout.write(
        JSON.stringify({
          systemMessage: `Progress board: ${stale.map((l) => l.lane).join(", ")} status file(s) behind the code.`,
          decision: "block",
          reason:
            `PROGRESS.md was regenerated, but these lanes have committed code more recently than they ` +
            `updated their status file: ${stale.map((l) => `${l.lane} (agents/status/${l.lane}.md)`).join(", ")}. ` +
            `If you are working in one of those lanes, update its Done / In progress / Next / Blocked ` +
            `sections and the frontmatter (state, now, demo_steps_done, updated) to match what you just ` +
            `did, then stop. If you are not working in that lane, leave it alone and stop — say so briefly. ` +
            `Protocol: agents/README.md. This runs once per session.`,
        }),
      );
      process.exit(0);
    }
  }
  process.stdout.write(JSON.stringify({ suppressOutput: true }));
  process.exit(0);
}

console.log(`PROGRESS.md updated (${content.split("\n").length} lines)`);
