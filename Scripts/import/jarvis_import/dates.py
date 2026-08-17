from __future__ import annotations

from datetime import date, datetime, time
from zoneinfo import ZoneInfo

SHEET_DATETIME_FMT = "%Y-%m-%d %H:%M:%S"
DEFAULT_TIMEZONE = "Europe/Warsaw"
IMPORT_TIMESTAMP_HEADER = "Data importu"


def resolve_timezone(name: str | None = None) -> ZoneInfo:
    try:
        return ZoneInfo(name or DEFAULT_TIMEZONE)
    except Exception:
        return ZoneInfo(DEFAULT_TIMEZONE)


def now_in_tz(tz: ZoneInfo) -> datetime:
    return datetime.now(tz)


def format_datetime(dt: datetime) -> str:
    return dt.strftime(SHEET_DATETIME_FMT)


def format_day_with_time(
    day: str | date,
    when: datetime | None = None,
    *,
    tz: ZoneInfo | None = None,
) -> str:
    """Data dnia + godzina (domyślnie: moment importu w strefie użytkownika)."""
    zone = tz or resolve_timezone()
    if when is None:
        when = now_in_tz(zone)
    elif when.tzinfo is None:
        when = when.replace(tzinfo=zone)
    else:
        when = when.astimezone(zone)
    day_str = day.isoformat() if isinstance(day, date) else date_key(day)
    return f"{day_str} {when.strftime('%H:%M:%S')}"


def utc_iso_to_local(iso_value: str, tz: ZoneInfo) -> datetime:
    normalized = iso_value.replace("Z", "+00:00")
    return datetime.fromisoformat(normalized).astimezone(tz)


def timestamp_ms_to_local(timestamp_ms: int, tz: ZoneInfo) -> datetime:
    return datetime.fromtimestamp(timestamp_ms / 1000, tz=tz)


def local_date_bounds_utc(start: date, end: date, tz: ZoneInfo) -> tuple[str, str]:
    """Początek i koniec dni kalendarzowych w tz → ISO UTC (filtry Supabase)."""
    utc = ZoneInfo("UTC")
    start_dt = datetime.combine(start, time.min, tzinfo=tz).astimezone(utc)
    end_dt = datetime.combine(end, time.max, tzinfo=tz).astimezone(utc)
    return start_dt.isoformat(), end_dt.isoformat()


def date_key(value: str) -> str:
    """Wyciąga YYYY-MM-DD z komórki ( sama data lub data + godzina )."""
    value = (value or "").strip()
    if not value:
        return ""
    if " " in value:
        return value.split(" ", 1)[0]
    return value[:10] if len(value) >= 10 else value


def normalize_datetime_for_key(value: str) -> str:
    """Normalizuje datę z arkusza (ISO lub PL) do klucza upsert yyyy-MM-dd HH:mm:ss."""
    import re

    value = (value or "").strip()
    if not value:
        return ""

    pl_match = re.match(
        r"^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?$",
        value,
    )
    if pl_match:
        day, month, year, time_part = pl_match.groups()
        time_part = time_part or "00:00:00"
        if len(time_part) == 5:
            time_part = f"{time_part}:00"
        return f"{year}-{month.zfill(2)}-{day.zfill(2)} {time_part}"

    if " " in value:
        date_part, time_part = value.split(" ", 1)
        time_part = time_part.strip()
        if len(time_part) == 5:
            time_part = f"{time_part}:00"
        return f"{date_part} {time_part}"

    if len(value) >= 10:
        return f"{value[:10]} 00:00:00"
    return value


def combine_date_time(date_str: str, time_str: str) -> str:
    date_part = date_key(date_str)
    time_part = (time_str or "").strip()
    if not date_part:
        return ""
    if not time_part:
        return date_part
    return f"{date_part} {time_part}"
