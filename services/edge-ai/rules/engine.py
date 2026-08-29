"""
Rules engine + urgency tiering (T1 task 9, ~1h).

A rule is a vital or finding, a condition string ("<90", ">=180", "==true"), and
whether firing it raises an urgency flag. Conditions are parsed, not eval'd.

Tiering:
    0 flags            → routine
    1 flag             → elevated
    2 or more flags    → urgent

Reference: architecture §6
"""

import re

from contracts import UrgencyFlag, UrgencyTier

_CONDITION = re.compile(r"^(<=|>=|==|<|>)\s*(.+)$")


def evaluate_condition(condition: str, value: float | bool | str) -> bool:
    """Parse "<90" / ">=180" / "==true" and apply it. Never eval()."""
    m = _CONDITION.match(condition.strip())
    if not m:
        return False
    op, raw = m.group(1), m.group(2).strip()

    if raw.lower() in ("true", "false"):
        return (op == "==") and (bool(value) is (raw.lower() == "true"))

    try:
        threshold = float(raw)
        v = float(value)
    except (TypeError, ValueError):
        return op == "==" and str(value) == raw

    return {
        "<": v < threshold,
        "<=": v <= threshold,
        ">": v > threshold,
        ">=": v >= threshold,
        "==": v == threshold,
    }[op]


def fire_rules(readings: list[dict], rules: list[dict]) -> list[UrgencyFlag]:
    """Return the flags raised by these readings. Rules come from branching_rules."""
    fired: list[UrgencyFlag] = []
    for rule in rules:
        if not rule.get("active", True):
            continue
        for r in readings:
            if r.get("type") != rule["trigger_vital_or_finding"]:
                continue
            value = r.get("value_numeric", r.get("value_text"))
            if value is None or not evaluate_condition(rule["condition"], value):
                continue
            if rule.get("urgency_flag"):
                template = rule.get("description_template") or rule["rule_id"]
                fired.append(
                    UrgencyFlag(
                        rule_id=rule["rule_id"],
                        description=template.replace("{value}", str(value)),
                    )
                )
    return fired


def tier_for(flags: list[UrgencyFlag]) -> UrgencyTier:
    n = len(flags)
    tier = "urgent" if n >= 2 else "elevated" if n == 1 else "routine"
    return UrgencyTier(tier=tier, flags=flags, flag_count=n)
