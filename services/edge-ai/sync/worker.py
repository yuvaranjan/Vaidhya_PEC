"""
Outbox -> Actian VectorAI DB sync worker.

Every edge write lands in the local `outbox` table and the request returns. This
worker is the only thing that talks to Actian VectorAI DB. That ordering is the
offline story: the clinic never waits on the network, and reconnecting is a
drain, not a retry storm.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import sqlite3
import uuid

import httpx

from clock import now_iso
from config import get_settings
from voicebot.session import Session

logger = logging.getLogger(__name__)

# Kept ordered for predictable sync and readable demo logs.
ENTITY_ORDER = ("visits", "vitals_readings", "diagnostic_reports")

SYNC_INTERVAL_SECONDS = 10

_state: dict[str, object] = {"online": False, "last_flush": None, "pending": 0}

_PK = {
    "visits": "visit_id",
    "vitals_readings": "reading_id",
    "diagnostic_reports": "report_id",
}


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
    """Queue one row for sync inside the caller's transaction."""
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


def _collection_name(table: str) -> str:
    settings = get_settings()
    return f"{settings.actian_vectorai_collection_prefix}{table}"


def _headers() -> dict[str, str]:
    settings = get_settings()
    headers = {"Content-Type": "application/json"}
    if settings.actian_vectorai_token:
        headers["Authorization"] = f"Bearer {settings.actian_vectorai_token}"
    return headers


def _hash_vector(seed: str) -> list[float]:
    settings = get_settings()
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    return [
        (digest[idx % len(digest)] / 255.0) * 2 - 1
        for idx in range(settings.actian_vectorai_dimension)
    ]


def _point_id(table: str, row_id: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"vaidhya:{table}:{row_id}"))


async def _ensure_collection(client: httpx.AsyncClient, table: str) -> bool:
    settings = get_settings()
    try:
        res = await client.put(
            f"{settings.actian_vectorai_url.rstrip('/')}/collections/{_collection_name(table)}",
            headers=_headers(),
            json={
                "vectors": {
                    "size": settings.actian_vectorai_dimension,
                    "distance": "Cosine",
                }
            },
        )
    except httpx.HTTPError as exc:
        logger.info("sync: Actian unreachable while creating %s (%s)", table, exc.__class__.__name__)
        return False

    if res.status_code in {200, 409}:
        return True

    logger.error("sync: Actian rejected collection %s %s %s", table, res.status_code, res.text[:400])
    return False


async def _push(client: httpx.AsyncClient, table: str, rows: list[dict]) -> bool:
    settings = get_settings()
    if not await _ensure_collection(client, table):
        return False

    pk = _PK[table]
    points = [
        {
            "id": _point_id(table, str(row[pk])),
            "vector": _hash_vector(f"{table}:{row[pk]}"),
            "payload": row,
        }
        for row in rows
    ]

    try:
        res = await client.put(
            f"{settings.actian_vectorai_url.rstrip('/')}/collections/{_collection_name(table)}/points",
            params={"wait": "true"},
            headers=_headers(),
            json={"points": points},
        )
    except httpx.HTTPError as exc:
        logger.info("sync: %s unreachable (%s)", table, exc.__class__.__name__)
        return False

    if res.status_code >= 300:
        logger.error("sync: %s rejected %s %s", table, res.status_code, res.text[:400])
        return False
    return True


async def flush_outbox() -> dict:
    """
    Drain everything unsynced. Safe to call concurrently with itself; the worst
    case is one row pushed twice, and Actian point upsert makes that harmless.
    """
    settings = get_settings()
    if not settings.actian_vectorai_url:
        _state["online"] = False
        return {"synced": 0, "reason": "Actian VectorAI DB not configured"}

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
    for row in rows:
        batches.setdefault(row["entity"], []).append(row)

    synced_ids: list[int] = []
    async with httpx.AsyncClient(timeout=10.0) as client:
        for entity in ENTITY_ORDER:
            batch = batches.get(entity)
            if not batch:
                continue

            by_pk: dict[str, dict] = {}
            for row in batch:
                pk = row["entity_id"]
                data = json.loads(row["payload"])
                if pk in by_pk:
                    by_pk[pk].update(data)
                else:
                    by_pk[pk] = data

            payloads = [{k: v for k, v in payload.items() if v is not None} for payload in by_pk.values()]

            if await _push(client, entity, payloads):
                synced_ids.extend(row["id"] for row in batch)
            else:
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
    """Tick forever; failed ticks are cheap and local."""
    while True:
        try:
            await flush_outbox()
        except Exception:
            logger.exception("sync: tick failed")
        await asyncio.sleep(SYNC_INTERVAL_SECONDS)
