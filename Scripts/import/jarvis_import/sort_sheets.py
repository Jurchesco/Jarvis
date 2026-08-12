from __future__ import annotations

from datetime import datetime

from gspread.exceptions import WorksheetNotFound

from .sheets import _batch_update_with_retry


WORKSHEET_SORT: dict[str, dict] = {
    "Dzien": {"columns": [0]},
    "Sen": {"columns": [0]},
    "Forma": {"columns": [0]},
    "Cialo": {"columns": [0]},
    "Aktywnosci": {"columns": [0]},
    "Silownia": {"columns": [0, 1, 2, 3], "numeric_columns": {3}},
    "Silownia_import": {"columns": [0, 1, 2, 3], "numeric_columns": {3}},
}


def _column_letter(index: int) -> str:
    """Indeks kolumny 1-based → litera (A, B, …, AA)."""
    letters = ""
    while index > 0:
        index, rem = divmod(index - 1, 26)
        letters = chr(65 + rem) + letters
    return letters


def _sortable_value(value: str, *, numeric: bool = False) -> tuple:
    text = (value or "").strip()
    if not text:
        return (2, "")

    if numeric:
        try:
            return (0, float(text.replace(",", ".")))
        except ValueError:
            pass

    for fmt, length in (
        ("%Y-%m-%d %H:%M:%S", 19),
        ("%Y-%m-%d %H:%M", 16),
        ("%Y-%m-%d", 10),
    ):
        try:
            return (0, datetime.strptime(text[:length], fmt))
        except ValueError:
            continue

    return (1, text.lower())


def _row_sort_key(row: list, columns: list[int], numeric_columns: set[int]) -> tuple:
    parts = []
    for col in columns:
        cell = row[col] if len(row) > col else ""
        parts.append(_sortable_value(cell, numeric=col in numeric_columns))
    return tuple(parts)


def sort_worksheet(worksheet, *, columns: list[int], numeric_columns: set[int] | None = None) -> int:
    """Sortuje wiersze danych (od wiersza 2) rosnąco po wskazanych kolumnach. Zwraca liczbę wierszy."""
    numeric_columns = numeric_columns or set()
    values = worksheet.get_all_values()
    if len(values) <= 1:
        return 0

    header = values[0]
    width = max(len(header), max((len(row) for row in values[1:]), default=0))
    last_column = _column_letter(width)

    data_rows = []
    for row in values[1:]:
        if not any((cell or "").strip() for cell in row):
            continue
        padded = row + [""] * (width - len(row))
        data_rows.append(padded[:width])

    if len(data_rows) <= 1:
        return len(data_rows)

    data_rows.sort(key=lambda row: _row_sort_key(row, columns, numeric_columns))

    old_last = len(values)
    if old_last > 1:
        worksheet.batch_clear([f"A2:{last_column}{old_last}"])

    payload = [
        {"range": f"A2:{last_column}{1 + len(data_rows)}", "values": data_rows},
    ]
    _batch_update_with_retry(worksheet, payload)
    return len(data_rows)


def sort_worksheet_by_name(worksheet, name: str) -> int:
    config = WORKSHEET_SORT.get(name)
    if not config:
        return 0
    return sort_worksheet(
        worksheet,
        columns=config["columns"],
        numeric_columns=set(config.get("numeric_columns", [])),
    )


def sort_all_worksheets(spreadsheet, *, only: set[str] | None = None) -> dict[str, int]:
    results: dict[str, int] = {}
    for name, config in WORKSHEET_SORT.items():
        if only and name not in only:
            continue
        try:
            worksheet = spreadsheet.worksheet(name)
        except WorksheetNotFound:
            continue
        count = sort_worksheet(
            worksheet,
            columns=config["columns"],
            numeric_columns=set(config.get("numeric_columns", [])),
        )
        results[name] = count
    return results
