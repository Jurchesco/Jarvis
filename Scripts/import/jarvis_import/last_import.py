from __future__ import annotations

from datetime import datetime

from .config import ROOT_DIR

LAST_IMPORT_FILE = ROOT_DIR / ".last_import"
DISPLAY_FORMAT = "%Y-%m-%d %H:%M:%S"


def get_last_import_label() -> str:
    if not LAST_IMPORT_FILE.exists():
        return "brak (pierwsze uruchomienie)"

    try:
        raw = LAST_IMPORT_FILE.read_text(encoding="utf-8").strip()
        if not raw:
            return "brak (pierwsze uruchomienie)"
        imported_at = datetime.fromisoformat(raw)
        return imported_at.strftime(DISPLAY_FORMAT)
    except (OSError, ValueError):
        return "nieznana"


def save_last_import(when: datetime | None = None) -> None:
    imported_at = when or datetime.now()
    LAST_IMPORT_FILE.write_text(
        imported_at.isoformat(timespec="seconds"),
        encoding="utf-8",
    )
