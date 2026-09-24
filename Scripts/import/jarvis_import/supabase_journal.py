"""Helpers for writing Garmin / openScale rows into Supabase (service role)."""

from __future__ import annotations

from typing import Any

from supabase import Client, create_client

from .config import Config


def get_supabase(config: Config) -> Client | None:
    if not config.supabase_url or not config.supabase_secret_key:
        return None
    return create_client(config.supabase_url, config.supabase_secret_key)


def require_owner_user_id(config: Config) -> str | None:
    """Owner UUID for journal upserts. Soft-skip when unset."""
    return config.jj_workout_user_id


def upsert_rows(
    client: Client,
    table: str,
    rows: list[dict[str, Any]],
    *,
    on_conflict: str,
) -> int:
    if not rows:
        return 0
    # PostgREST prefers moderate batches
    chunk = 200
    total = 0
    for i in range(0, len(rows), chunk):
        part = rows[i : i + chunk]
        client.table(table).upsert(part, on_conflict=on_conflict).execute()
        total += len(part)
    return total


def as_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return None


def as_int(value: Any) -> int | None:
    num = as_float(value)
    if num is None:
        return None
    return int(round(num))
