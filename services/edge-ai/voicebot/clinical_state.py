"""Deterministic, allowlisted state used for the patient intake interview.

The transcript remains the legal/audit record and is used in the doctor report.
It is intentionally not the primary LLM context for each turn: compact state is
smaller, repeatable and prevents a model from reinterpreting old answers.
"""
from __future__ import annotations

import re
import time
from typing import Any

CORE_SLOTS: dict[str, dict[str, Any]] = {
    "complaint": {"label": "main health concern", "required": True},
    "onset": {"label": "when the problem started", "required": True},
    "severity": {"label": "severity (for example, 1 to 10)", "required": True},
    "history": {"label": "relevant medical history", "required": True},
    "location": {"label": "symptom location", "required": False},
    "duration": {"label": "symptom duration", "required": False},
    "associated_symptoms": {"label": "associated symptoms", "required": False},
    "relevant_negatives": {"label": "important symptoms denied", "required": False},
    "allergies": {"label": "allergies", "required": False},
    "medications": {"label": "current medicines", "required": False},
}


def empty_state() -> dict[str, Any]:
    return {
        "schema_version": 1,
        "slots": {name: {"value": None, "status": "missing", "source": None, "updated_at": None}
                  for name in CORE_SLOTS},
        "vitals": [],
        "findings": [],
        "escalation": None,
    }


def ensure_state(state: dict[str, Any] | None) -> dict[str, Any]:
    result = state or empty_state()
    result.setdefault("schema_version", 1)
    slots = result.setdefault("slots", {})
    for name in CORE_SLOTS:
        slots.setdefault(name, {"value": None, "status": "missing", "source": None, "updated_at": None})
    result.setdefault("vitals", [])
    result.setdefault("findings", [])
    result.setdefault("escalation", None)
    return result


def merge_slot_updates(state: dict[str, Any], updates: Any, source: str = "patient", target_slot: str | None = None) -> dict[str, Any]:
    state = ensure_state(state)
    if not isinstance(updates, list):
        return state
    for update in updates:
        if not isinstance(update, dict):
            continue
        slot, value = update.get("slot"), update.get("value")
        if slot not in CORE_SLOTS or not isinstance(value, str):
            continue
        value = re.sub(r"\s+", " ", value).strip()
        if value:
            # 7B models frequently hallucinate negative/unknown states for slots they were NOT asked about.
            # E.g. when asked about complaint, they guess history="none stated". 
            # We ignore these obvious placeholders unless this was the specific slot being asked about.
            is_placeholder = value.lower() in {"unknown", "none stated", "none", "not stated", "n/a", "not provided", "not mentioned", "unspecified"}
            
            # The 'complaint' is the chief reason for the visit. It is strictly required. 
            # Even if the bot is targeting 'complaint' and the user says "I don't know",
            # we reject it so the bot keeps asking.
            if is_placeholder:
                if slot != target_slot or slot == "complaint":
                    continue
                
            state["slots"][slot] = {"value": value[:500], "status": "captured", "source": source, "updated_at": time.time()}
    return state


def next_required_slot(state: dict[str, Any]) -> str | None:
    state = ensure_state(state)
    for name, definition in CORE_SLOTS.items():
        if definition["required"] and state["slots"][name].get("status") != "captured":
            return name
    return None


def compact_context(state: dict[str, Any]) -> dict[str, Any]:
    state = ensure_state(state)
    return {
        "slots": {key: value.get("value") for key, value in state["slots"].items() if value.get("value")},
        "vitals": state["vitals"],
        "findings": state["findings"],
        "escalation": state["escalation"],
    }
