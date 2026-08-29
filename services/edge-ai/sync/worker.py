"""
Outbox → Supabase sync worker (demo step 7 — the one that is hardest to fake).

Every edge write lands in the local `outbox` table and the request returns. This
worker is the only thing that ever talks to Supabase. That ordering is the whole
offline story: the clinic never waits on the network, and reconnecting is a
drain, not a retry-storm.

Upserts, not inserts. A row that was pushed and whose acknowledgement was lost
gets pushed again on the next tick, and merge-duplicates makes that a no-op
rather than a primary-key violation.

Reference: architecture §3.3
"""

from __future__ import annotations

import asyncio
import json
import logging
import sqlite3

import httpx

from clock import now_iso
from config import get_settings
from voicebot.session import Session

logger = logging.getLogger(__name__)

# outbox.entity → the Supabase table it drains into. Order matters on a cold
# flush: a reading cannot land before the visit it references exists.
ENTITY_ORDER = ("visits", "vitals_readings", "diagnostic_reports")

SYNC_INTERVAL_SECONDS = 10

_state: dict[str, object] = {"online": False, "last_flush": None, "pending": 0}


def status() -> dict:
    """What /health and the demo narration read."""
    return {**_state, "pending": pending_count()}


def pending_count() -> int:
    with sqlite3.connect(get_settings().edge_db_path) as conn:
        row = conn.execute(
            "select count(*) from outbox where synced_at is null"
        ).fetchone()
    return int(row[0]) if row else 0


def enqueue(conn: sqlite3.Connection, entity: str, entity_id: str, payload: dict) -> None:
    """Queue one row for sync. Takes an open connection so the caller keeps its
    own transaction — the outbox write must commit with the data write or not
    at all."""
    conn.execute(
        "insert into outbox (entity, entity_id, payload, created_at) values (?,?,?,?)",
        (entity, entity_id, json.dumps(payload), now_iso()),
    )


def record_visit(session: Session) -> None:
    """Write the visit locally and queue it. Called at /session/start."""
    settings = get_settings()
    payload = {
        "visit_id": session.visit_id,
        "patient_id": session.patient_id,
        "edge_jurisdiction_id": settings.jurisdiction_id,
        "status": "intake_in_progress",
        "language": session.language,
        "created_at": now_iso(),
    }
    with sqlite3.connect(settings.edge_db_path) as conn:
        conn.execute(
            "insert into visits (visit_id, patient_id, edge_jurisdiction_id, "
            "status, language, created_at) values (?,?,?,?,?,?) "
            "on conflict(visit_id) do nothing",
            (
                session.visit_id,
                session.patient_id,
                settings.jurisdiction_id,
                "intake_in_progress",
                session.language,
                payload["created_at"],
            ),
        )
        enqueue(conn, "visits", session.visit_id, payload)


async def _push(client: httpx.AsyncClient, table: str, rows: list[dict]) -> bool:
    settings = get_settings()
    try:
        res = await client.post(
            f"{settings.supabase_url}/rest/v1/{table}",
            params={"on_conflict": _PK[table]},
            headers={
                "apikey": settings.supabase_service_key,
                "Authorization": f"Bearer {settings.supabase_service_key}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates,return=minimal",
            },
            json=rows,
        )
    except httpx.HTTPError as exc:
        logger.info("sync: %s unreachable (%s)", table, exc.__class__.__name__)
        return False

    if res.status_code >= 300:
        # A 4xx is our bug, not the network's — log the body or it is invisible.
        logger.error("sync: %s rejected %s %s", table, res.status_code, res.text[:400])
        return False
    return True


_PK = {
    "visits": "visit_id",
    "vitals_readings": "reading_id",
    "diagnostic_reports": "report_id",
}


async def flush_outbox() -> dict:
    """
    Drain everything unsynced. Safe to call concurrently with itself — the worst
    case is one row pushed twice, and the upsert makes that harmless.
    """
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_key:
        _state["online"] = False
        return {"synced": 0, "reason": "supabase not configured"}

    with sqlite3.connect(settings.edge_db_path) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "select id, entity, entity_id, payload from outbox "
            "where synced_at is null order by id"
        ).fetchall()

    if not rows:
        _state["online"] = True
        _state["last_flush"] = now_iso()
        return {"synced": 0}

    batches: dict[str, list[sqlite3.Row]] = {}
    for r in rows:
        batches.setdefault(r["entity"], []).append(r)

    synced_ids: list[int] = []
    async with httpx.AsyncClient(timeout=10.0) as client:
        for entity in ENTITY_ORDER:
            batch = batches.get(entity)
            if not batch:
                continue

            # Postgres's ON CONFLICT DO UPDATE refuses to touch the same row
            # twice inside one statement — a visit that got two enqueues
            # before either flushed (e.g. created, then marked
            # awaiting_doctor) crashed the whole batch, not just that visit.
            # Rows are already selected oldest-first, so the last write per
            # primary key wins here too; every id, including the earlier
            # superseded ones, still gets marked synced below.
            by_pk: dict[str, dict] = {}
            for r in batch:
                pk = r["entity_id"]
                data = json.loads(r["payload"])
                if pk in by_pk:
                    by_pk[pk].update(data)
                else:
                    by_pk[pk] = data

            payloads = [{k: v for k, v in p.items() if v is not None} for p in by_pk.values()]

            if await _push(client, entity, payloads):
                synced_ids.extend(r["id"] for r in batch)
            else:
                # Stop at the first failure: later entities reference earlier
                # ones, so pushing them now would just fail on the foreign key.
                _state["online"] = False
                break
        else:
            _state["online"] = True

    if synced_ids:
        marks = ",".join("?" * len(synced_ids))
        with sqlite3.connect(settings.edge_db_path) as conn:
            conn.execute(
                f"update outbox set synced_at = ? where id in ({marks})",
                [now_iso(), *synced_ids],
            )

    _state["last_flush"] = now_iso()
    logger.info("sync: pushed %d row(s), %d still pending", len(synced_ids), pending_count())
    return {"synced": len(synced_ids), "pending": pending_count()}


async def sync_loop() -> None:
    """
    Ticks forever. When the wifi is out every tick fails cheaply and locally;
    when it comes back, the next tick drains the backlog. That is the entire
    reconnect behaviour — there is no reconnect event to listen for.
    """
    while True:
        try:
            await flush_outbox()
        except Exception:
            logger.exception("sync: tick failed")
        await asyncio.sleep(SYNC_INTERVAL_SECONDS)
