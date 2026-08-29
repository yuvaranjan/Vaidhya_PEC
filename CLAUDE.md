# Project Vaidhya — working agreement

Edge-AI telemedicine for rural primary care. Four people build this in parallel, each
with an AI agent, none of them reading each other's code.

## Before you write code

**Type your lane's slash command. That is the whole onboarding.**

| You are | Type | It loads |
|---|---|---|
| T1 · Yuvaranjan · edge-AI | `/t1` | status, lane brief, `contracts.py`, board — then picks your next task |
| T2 · Yadav · portal | `/t2` | status, lane brief, the shared contract, `edgeApi.ts`, board |
| T3 · pharmacy | `/t3` | status, lane brief, the pharmacy schema and seed, board |
| T4 · seed data | `/t4` | status, lane brief, the seed, and who is blocked on you |

Each one also tells you which sections of the architecture document your current task
maps to, so you read fifty lines instead of eight hundred. Add an argument to aim it:
`/t1 task 7` or `/t2 build the vitals dashboard`.

If you would rather do it by hand: read [agents/README.md](agents/README.md) for the
protocol, then your lane's brief in `agents/lanes/`, then [PROGRESS.md](PROGRESS.md) for
what everyone else is doing. PROGRESS.md is generated — never edit it by hand.

## The two rules that keep this repo from collapsing

1. **Stay in your lane.** T1 owns `services/edge-ai/`, T2 owns `apps/web/`, T3 owns the
   pharmacy and prescription screens, T4 owns `db/`. Do not edit another lane's files —
   not even to fix an obvious typo. Say it in your status file instead.
2. **`packages/shared/` and `services/edge-ai/contracts.py` are the frozen contract.**
   They mirror each other. Changing one means changing both, together, and announcing it.

## Before you stop working

Update **your own** `agents/status/<lane>.md`:

- move finished things into **Done**, described as behaviour, with how you verified it
- set **In progress** to what you are touching right now
- keep **Next** to the two or three things that come next, in order
- record anything blocking you under **Blocked**, naming the lane
- put anything that changes how someone else writes code under **Notes for other lanes**
- update the frontmatter: `state`, `now`, `demo_steps_done`, `updated`

A Stop hook regenerates `PROGRESS.md` and will nag once per session if your lane's status
file is older than your last commit to your code area.

## What "done" means

The goal is the seven-minute demo in `agents/demo-steps.json` (§17 of the technical
architecture). Only claim a step in `demo_steps_done` if you could perform it **live,
right now, in front of a judge**. "Works except for one thing" is not done.

When choosing what to build next, the tiebreak is always: *which demo step does this
move?* If the answer is none, it is phase 2.

## Practical

- Setup, one-click start, env vars, troubleshooting: [SETUP.md](SETUP.md)
- Start everything: `./start.bat` (Windows) or `./start.sh`
- `npm run progress` regenerates the board · `npm run check` verifies the docs match reality
- The theme is frozen at the top of `apps/web/app/globals.css`. Light mode only, flat 2D,
  green for primary actions, amber and red only for urgency. Do not add a dark variant.
- Deliberate deviations from the architecture doc, both load-bearing: Tailwind v4 is
  CSS-first so theme tokens live in `globals.css`, and doctor routes are nested under
  `/doctor/*` because two route groups resolving to `/login` will not build.
