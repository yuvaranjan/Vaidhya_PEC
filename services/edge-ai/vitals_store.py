"""
Vitals persistence + rule firing (T1 task 9).

This is the connector that was missing: `rules/engine.py` knew how to fire rules
and `report/builder.py` knew how to tier them, but nothing ever put a reading in
front of the engine, so every report generated as routine/0 flags.

Everything here is local SQLite. The rules come from `branching_rules` in
edge.db, not from Supabase, because the engine has to fire with the wifi
unplugged — that is demo steps 4 and 6.

Reference: architecture §6
"""

from __future__ import annotations

import sqlite3
import time
import uuid

from clock import now_iso
from config import get_settings
from contracts import UrgencyFlag, VitalsRequest
from rules.engine import fire_rules
from sync.worker import enqueue
from voicebot.session import Session, Turn
from voicebot.clinical_state import ensure_state


def load_rules() -> list[dict]:
    """Active branching rules, shaped the way fire_rules() expects them."""
    with sqlite3.connect(get_settings().edge_db_path) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "select rule_id, trigger_vital_or_finding, condition, "
            "question_branch_tags, urgency_flag, description_template, active "
            "from branching_rules where active = 1"
        ).fetchall()

    return [
        {
            "rule_id": r["rule_id"],
            "trigger_vital_or_finding": r["trigger_vital_or_finding"],
            "condition": r["condition"],
            "question_branch_tags": [
                t for t in (r["question_branch_tags"] or "").split(",") if t
            ],
            "urgency_flag": bool(r["urgency_flag"]),
            "description_template": r["description_template"],
            "active": True,
        }
        for r in rows
    ]


def branch_tags_for(flags: list[UrgencyFlag], rules: list[dict]) -> list[str]:
    """The tags the orchestrator should steer questions towards. Demo step 4."""
    by_id = {r["rule_id"]: r for r in rules}
    tags: list[str] = []
    for f in flags:
        for tag in by_id.get(f.rule_id, {}).get("question_branch_tags", []):
            if tag not in tags:
                tags.append(tag)
    return tags


def record_vitals(session: Session, req: VitalsRequest) -> list[UrgencyFlag]:
    """
    Persist the readings, fire the rules, and — if this is the nurse answering a
    finding the bot paused for — release the pending finding so the next poll
    resumes the conversation.

    Returns only the flags this call raised, not the session's running total.
    """
    settings = get_settings()
    now = now_iso()

    readings = []
    for r in req.readings:
        value_numeric = r.value_numeric
        unit = r.unit
        # The web forms collect Fahrenheit. Keep one canonical unit in the
        # edge database and rules engine so 98.6 F is not treated as 98.6 C.
        if r.type == "temperature" and value_numeric is not None:
            if unit == "fahrenheit" or (unit is None and value_numeric > 45):
                value_numeric = round((value_numeric - 32) * 5 / 9, 1)
            unit = "celsius"

        readings.append(
            {
                "reading_id": uuid.uuid4().hex,
                "type": r.type,
                "value_numeric": value_numeric,
                "value_text": r.value_text,
                "unit": unit,
            }
        )

    pending = session.pending_finding
    if req.phase == "on_demand" and pending is not None:
        # The nurse is answering. Match on type; fall back to the first reading,
        # because a nurse who typed the answer into the wrong row still answered.
        answer = next(
            (r for r in readings if r["type"] == pending.type),
            readings[0] if readings else None,
        )
        if answer is not None:
            pending.entered_at = time.time()
            pending.value_text = (
                answer["value_text"]
                if answer["value_text"] is not None
                else str(answer["value_numeric"])
            )
            answer["reading_id"] = pending.reading_id

            # The LLM only ever sees session.turns — without this, a nurse's
            # answer lands in vitals_readings but is invisible to the model,
            # which then has no way to know an exam was already done and asks
            # for another one. This is what actually lets the conversation
            # move on instead of requesting findings in a loop.
            session.turns.append(
                Turn(
                    speaker="nurse",
                    text_en=(
                        f"Examination finding for '{pending.type}' "
                        f"(requested: {pending.instruction_en}): {pending.value_text}"
                    ),
                )
            )

    with sqlite3.connect(settings.edge_db_path) as conn:
        for r in readings:
            conn.execute(
                "insert or replace into vitals_readings "
                "(reading_id, visit_id, type, phase, value_numeric, value_text, "
                " entered_at, status) values (?,?,?,?,?,?,?,?)",
                (
                    r["reading_id"],
                    req.visit_id,
                    r["type"],
                    req.phase,
                    r["value_numeric"],
                    r["value_text"],
                    now,
                    "entered",
                ),
            )
            enqueue(
                conn,
                "vitals_readings",
                r["reading_id"],
                {
                    **r,
                    "visit_id": req.visit_id,
                    "phase": req.phase,
                    "entered_at": now,
                    "status": "entered",
                },
            )

    session.vitals.extend(readings)
    state = ensure_state(session.clinical_state)
    state["vitals"] = session.vitals.copy()
    if req.phase == "on_demand":
        state["findings"].extend(readings)
    session.clinical_state = state

    rules = load_rules()
    fired = fire_rules(readings, rules)

    # A rule fires once per visit. Re-entering the same vital must not turn one
    # clinical finding into two urgency flags.
    already = {f["rule_id"] for f in session.fired_flags}
    new_flags = [f for f in fired if f.rule_id not in already]
    session.fired_flags.extend(f.model_dump() for f in new_flags)

    if new_flags:
        session.branch_tags = branch_tags_for(new_flags, rules)

    state["escalation"] = [f["description"] for f in session.fired_flags]
    session.clinical_state = state

    return new_flags
