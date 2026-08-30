"""
Session store + the nurse-finding state machine.

THE ONE RULE HERE: no asyncio timers, no background tasks. Pending-finding state
is computed from timestamps every time it is read. It cannot race, it survives a
uvicorn restart, and it cannot hang.

Reference: Docs/Project_Vaidhya_V1_Build_Plan.md §4.1
"""

from __future__ import annotations

import json
import sqlite3
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Literal

from config import get_settings
from contracts import PendingFinding, SessionPhase

Resolution = Literal["resume", "resume_without", "remind", "waiting"]


@dataclass
class Finding:
    reading_id: str
    type: str
    instruction_en: str
    requested_at: float
    entered_at: float | None = None
    value_text: str | None = None
    status: Literal["requested", "reminded"] = "requested"


@dataclass
class Turn:
    speaker: str  # patient | bot | doctor
    text_en: str
    text_native: str = ""
    timestamp: float = field(default_factory=time.time)


@dataclass
class Session:
    visit_id: str
    patient_id: str
    language: str
    phase: SessionPhase = "pass_one"
    turns: list[Turn] = field(default_factory=list)
    vitals: list[dict] = field(default_factory=list)
    pending_finding: Finding | None = None
    fired_flags: list[dict] = field(default_factory=list)
    # Question tags the fired rules steer towards ("respiratory", "cardiac"…).
    # This is what makes the branch visible on stage rather than implicit.
    branch_tags: list[str] = field(default_factory=list)
    # An outstanding doctor question relayed in over MQTT, as a plain dict so
    # the session stays JSON-serialisable for the SQLite mirror.
    doctor_question: dict | None = None
    # Facts confirmed from the patient, separate from the human-readable
    # transcript. This makes the intake resilient to small local models.
    clinical_state: dict = field(default_factory=dict)

    @property
    def turn_count(self) -> int:
        return sum(1 for t in self.turns if t.speaker == "patient")

    def to_json(self) -> str:
        return json.dumps(asdict(self))


def resolve_pending(session: Session) -> Resolution | None:
    """
    Called at the top of GET /session/{visit_id}/state and POST /voice/turn.
    That is the whole mechanism.
    """
    f = session.pending_finding
    if f is None:
        return None

    timeout = get_settings().on_demand_timeout_seconds
    elapsed = time.time() - f.requested_at

    if f.entered_at:  # nurse answered
        session.pending_finding = None
        session.phase = "conversation"
        return "resume"

    if elapsed > 2 * timeout:  # gave up
        _mark_not_obtained(f, session.visit_id)
        session.pending_finding = None
        session.phase = "conversation"
        return "resume_without"

    if elapsed > timeout and f.status == "requested":
        f.status = "reminded"
        return "remind"  # re-voice the request, once

    return "waiting"


def _mark_not_obtained(f: Finding, visit_id: str) -> None:
    """
    The nurse never answered. Record that as a fact rather than as an absence —
    the doctor needs to see "not obtained", not a silently missing row.
    """
    with sqlite3.connect(get_settings().edge_db_path, timeout=5) as conn:
        conn.execute(
            "insert into vitals_readings "
            "(reading_id, visit_id, type, phase, requested_at, status) "
            "values (?,?,?,?,?,'not_obtained') "
            "on conflict(reading_id) do update set status='not_obtained'",
            (f.reading_id, visit_id, f.type, "on_demand", str(f.requested_at)),
        )


def as_contract(f: Finding | None) -> PendingFinding | None:
    if f is None:
        return None
    return PendingFinding(
        reading_id=f.reading_id,
        type=f.type,
        instruction_en=f.instruction_en,
        elapsed_s=int(time.time() - f.requested_at),
        status=f.status,
    )


class SessionStore:
    """In-memory dict, mirrored into SQLite so a restart mid-demo is survivable."""

    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}
        self._db_path = get_settings().edge_db_path
        self._init_db()
        self._load_sessions()

    def _init_db(self) -> None:
        candidates = [
            Path(__file__).resolve().parent.parent.parent / "db" / "edge_schema.sql",
            Path(__file__).resolve().parent.parent / "db" / "edge_schema.sql",
            Path("/app/db/edge_schema.sql"),
            Path("db/edge_schema.sql"),
        ]
        schema = next((p for p in candidates if p.exists()), None)
        with sqlite3.connect(self._db_path, timeout=5) as conn:
            conn.execute('PRAGMA journal_mode=WAL')
            conn.execute('PRAGMA busy_timeout=5000')
            if schema and schema.exists():
                conn.executescript(schema.read_text(encoding="utf-8"))

    def _load_sessions(self) -> None:
        try:
            with sqlite3.connect(self._db_path, timeout=5) as conn:
                for row in conn.execute("SELECT payload FROM sessions"):
                    try:
                        data = json.loads(row[0])
                        turns_data = data.pop('turns', [])
                        pf_data = data.pop('pending_finding', None)
                        
                        session = Session(**data)
                        session.turns = [Turn(**t) for t in turns_data]
                        if pf_data:
                            session.pending_finding = Finding(**pf_data)
                            
                        self._sessions[session.visit_id] = session
                    except Exception:
                        pass
        except sqlite3.OperationalError:
            pass

    def get(self, visit_id: str) -> Session | None:
        session = self._sessions.get(visit_id)
        if session:
            return session
        try:
            with sqlite3.connect(self._db_path) as conn:
                cur = conn.execute("select payload from sessions where visit_id = ?", (visit_id,))
                row = cur.fetchone()
                if row and row[0]:
                    d = json.loads(row[0])
                    turns = [Turn(**t) for t in d.get("turns", [])]
                    pf_dict = d.get("pending_finding")
                    pf = Finding(**pf_dict) if pf_dict else None
                    session = Session(
                        visit_id=d["visit_id"],
                        patient_id=d.get("patient_id", ""),
                        language=d.get("language", "en"),
                        phase=d.get("phase", "pass_one"),
                        turns=turns,
                        vitals=d.get("vitals", []),
                        pending_finding=pf,
                        fired_flags=d.get("fired_flags", []),
                        branch_tags=d.get("branch_tags", []),
                        doctor_question=d.get("doctor_question"),
                        clinical_state=d.get("clinical_state", {}),
                    )
                    self._sessions[visit_id] = session
                    return session
        except Exception:
            pass
        return None

    def put(self, session: Session) -> None:
        self._sessions[session.visit_id] = session
        with sqlite3.connect(self._db_path, timeout=5) as conn:
            conn.execute(
                "insert into sessions (visit_id, payload, updated_at) values (?,?,?) "
                "on conflict(visit_id) do update set payload=excluded.payload, "
                "updated_at=excluded.updated_at",
                (session.visit_id, session.to_json(), str(time.time())),
            )

    def all(self) -> list[Session]:
        return list(self._sessions.values())


store = SessionStore()
