from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

from .dates import resolve_timezone

PACKAGE_DIR = Path(__file__).resolve().parent
ROOT_DIR = PACKAGE_DIR.parent


@dataclass(frozen=True)
class Config:
    spreadsheet_id: str
    google_credentials_file: Path
    garmin_token_dir: Path
    openscale_backup: Path | None
    supabase_url: str | None
    supabase_secret_key: str | None
    default_days: int
    import_start_date: date
    timezone: ZoneInfo
    request_delay_sec: float


def _resolve_path(root: Path, env_value: str | None, local_name: str, legacy_relative: str) -> Path:
    if env_value:
        path = Path(env_value)
        if not path.is_absolute():
            path = (root / path).resolve()
        return path

    local = root / local_name
    if local.exists():
        return local.resolve()

    return (root.parent / legacy_relative).resolve()


def load_config(env_file: Path | None = None) -> Config:
    if env_file:
        load_dotenv(env_file)
    else:
        load_dotenv(PACKAGE_DIR.parent / ".env")

    credentials_path = _resolve_path(
        ROOT_DIR,
        os.getenv("GOOGLE_CREDENTIALS_FILE"),
        "google-service-account.json",
        "garmin-sheets/google-service-account.json",
    )
    token_path = _resolve_path(
        ROOT_DIR,
        os.getenv("GARMIN_TOKEN_DIR"),
        ".garminconnect",
        "garmin-sheets/.garminconnect",
    )

    backup_path: Path | None = None
    backup_raw = os.getenv("OPENSCALE_BACKUP") or os.getenv("OPENSCALE_CSV")
    if backup_raw:
        backup_path = Path(backup_raw)
        if not backup_path.is_absolute():
            backup_path = backup_path.resolve()

    sheet_id = os.getenv("GOOGLE_SHEET_ID")
    if not sheet_id:
        raise KeyError("GOOGLE_SHEET_ID")

    return Config(
        spreadsheet_id=sheet_id,
        google_credentials_file=credentials_path,
        garmin_token_dir=token_path,
        openscale_backup=backup_path,
        supabase_url=os.getenv("SUPABASE_URL"),
        supabase_secret_key=os.getenv("SUPABASE_SECRET_KEY"),
        default_days=int(os.getenv("DEFAULT_DAYS", "7")),
        import_start_date=date.fromisoformat(os.getenv("IMPORT_START_DATE", "2026-07-09")),
        timezone=resolve_timezone(os.getenv("TIMEZONE")),
        request_delay_sec=float(os.getenv("REQUEST_DELAY_SEC", "0.4")),
    )


def date_range(days: int, end: date | None = None) -> tuple[date, date]:
    if days < 1:
        raise ValueError("Liczba dni musi być >= 1")
    end_date = end or date.today()
    start_date = end_date - timedelta(days=days - 1)
    return start_date, end_date


def date_range_from_start(start: date, end: date | None = None) -> tuple[date, date]:
    end_date = end or date.today()
    if start > end_date:
        raise ValueError("Data początkowa importu jest późniejsza niż dziś")
    return start, end_date
