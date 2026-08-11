from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

import gspread
from gspread.exceptions import APIError

BATCH_UPDATE_CHUNK = 100


@dataclass
class ImportResult:
    name: str
    updated: int = 0
    appended: int = 0
    skipped: int = 0
    error: str | None = None

    @property
    def ok(self) -> bool:
        return self.error is None


class SheetsClient:
    def __init__(self, spreadsheet_id: str, credentials_file: Path):
        if not credentials_file.exists():
            raise FileNotFoundError(f"Nie znaleziono pliku credentials: {credentials_file}")
        self._gc = gspread.service_account(filename=str(credentials_file))
        self._spreadsheet_id = spreadsheet_id

    def worksheet(self, name: str):
        return self._gc.open_by_key(self._spreadsheet_id).worksheet(name)


def get_existing_rows_by_key(
    worksheet,
    key_column: int = 0,
    note_column: int | None = None,
    *,
    start_row: int = 2,
    key_normalizer: Callable[[str], str] | None = None,
) -> dict[str, dict]:
    values = worksheet.get_all_values()
    rows_map: dict[str, dict] = {}

    for idx, row in enumerate(values[start_row - 1 :], start=start_row):
        if not row:
            continue
        raw_key = row[key_column].strip() if len(row) > key_column else ""
        if not raw_key:
            continue
        key = key_normalizer(raw_key) if key_normalizer else raw_key
        entry: dict = {"row_number": idx}
        if note_column is not None:
            entry["note"] = row[note_column] if len(row) > note_column else ""
        rows_map[key] = entry

    return rows_map


def batch_update_rows(
    worksheet,
    updates: list[tuple[int, list]],
    last_column: str,
    *,
    chunk_size: int = BATCH_UPDATE_CHUNK,
) -> None:
    """Jeden lub kilka batch_update zamiast setek pojedynczych update (limit 60/min)."""
    if not updates:
        return

    for offset in range(0, len(updates), chunk_size):
        chunk = updates[offset : offset + chunk_size]
        payload = [
            {"range": f"A{row_number}:{last_column}{row_number}", "values": [values]}
            for row_number, values in chunk
        ]
        _batch_update_with_retry(worksheet, payload)


def _batch_update_with_retry(worksheet, payload: list[dict], max_retries: int = 6) -> None:
    for attempt in range(max_retries):
        try:
            worksheet.batch_update(payload, value_input_option="USER_ENTERED")
            return
        except APIError as error:
            if "429" not in str(error) or attempt >= max_retries - 1:
                raise
            wait_sec = min(60, 15 * (2**attempt))
            print(f"    Limit Google Sheets (429) — czekam {wait_sec}s...")
            time.sleep(wait_sec)
