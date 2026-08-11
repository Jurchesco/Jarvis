from __future__ import annotations

from datetime import date, datetime

SHEET_DATETIME_FMT = "%Y-%m-%d %H:%M:%S"


def date_key(value: str) -> str:
    """Wyciąga YYYY-MM-DD z komórki ( sama data lub data + godzina )."""
    value = (value or "").strip()
    if not value:
        return ""
    if " " in value:
        return value.split(" ", 1)[0]
    return value[:10] if len(value) >= 10 else value


def format_day_with_time(day: str | date, when: datetime | None = None) -> str:
    """Data dnia + godzina (domyślnie: moment importu)."""
    if when is None:
        when = datetime.now()
    day_str = day.isoformat() if isinstance(day, date) else date_key(day)
    return f"{day_str} {when.strftime('%H:%M:%S')}"


def combine_date_time(date_str: str, time_str: str) -> str:
    date_part = date_key(date_str)
    time_part = (time_str or "").strip()
    if not date_part:
        return ""
    if not time_part:
        return date_part
    return f"{date_part} {time_part}"
