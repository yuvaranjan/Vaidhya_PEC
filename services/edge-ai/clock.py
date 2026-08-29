"""
One source of "now".

Local SQLite is happy with anything; Postgres `timestamptz` is not. Writing ISO
everywhere means an outbox row can be pushed to Supabase byte-for-byte as it was
stored, with no reformatting at the boundary — which is exactly where a sync
worker would otherwise grow a bug nobody sees until the wifi comes back.
"""

from datetime import datetime, timezone


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def to_iso(epoch: float | None) -> str | None:
    if epoch is None:
        return None
    return datetime.fromtimestamp(epoch, tz=timezone.utc).isoformat()
