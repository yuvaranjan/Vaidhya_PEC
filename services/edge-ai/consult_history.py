"""Durable, per-visit consultation timeline.

MQTT is transport, not storage. Every clinically relevant doctor question and
patient answer is recorded locally before it is considered delivered, allowing
the visit to be reconstructed after a refresh or broker reconnect.
"""
from __future__ import annotations

import json
import sqlite3
import uuid

from clock import now_iso
from config import get_settings


def append(visit_id: str, speaker: str, text_en: str, text_native: str = "", message_id: str | None = None) -> dict:
    item = {"message_id": message_id or uuid.uuid4().hex, "visit_id": visit_id, "speaker": speaker, "text_en": text_en, "text_native": text_native, "timestamp": now_iso()}
    with sqlite3.connect(get_settings().edge_db_path, timeout=5) as conn:
        conn.execute("insert or ignore into consult_messages (message_id, visit_id, speaker, text_en, text_native, created_at) values (?,?,?,?,?,?)", (item["message_id"], visit_id, speaker, text_en, text_native, item["timestamp"]))
    return item


def list_for_visit(visit_id: str) -> list[dict]:
    with sqlite3.connect(get_settings().edge_db_path, timeout=5) as conn:
        rows = conn.execute("select message_id, speaker, text_en, text_native, created_at from consult_messages where visit_id = ? order by created_at, rowid", (visit_id,)).fetchall()
    return [{"message_id": r[0], "speaker": r[1], "text_en": r[2], "text_native": r[3], "timestamp": r[4]} for r in rows]
