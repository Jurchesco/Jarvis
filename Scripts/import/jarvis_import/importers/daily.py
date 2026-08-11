from __future__ import annotations

from datetime import datetime

from ..dates import IMPORT_TIMESTAMP_HEADER, date_key, format_day_with_time, now_in_tz
from ..garmin import GarminClient, iter_days
from ..sheets import ImportResult, batch_update_rows, ensure_column_header, get_existing_rows_by_key
from . import ImportContext


WORKSHEET_NAME = "Dzien"
NOTE_COLUMN = 20


def value_or_blank(value):
    return "" if value is None else value


def one_decimal_or_blank(value):
    if value is None:
        return ""
    return round(float(value), 1)


def build_row(day, stats, existing_note="", imported_at: datetime | None = None, tz=None):
    return [
        format_day_with_time(day, imported_at, tz=tz),
        value_or_blank(stats.get("totalSteps")),
        value_or_blank(stats.get("totalKilocalories")),
        value_or_blank(stats.get("activeKilocalories")),
        value_or_blank(stats.get("bmrKilocalories")),
        value_or_blank(stats.get("averageStressLevel")),
        value_or_blank(stats.get("maxStressLevel")),
        value_or_blank(stats.get("restingHeartRate")),
        value_or_blank(stats.get("bodyBatteryAtWakeTime")),
        value_or_blank(stats.get("bodyBatteryHighestValue")),
        value_or_blank(stats.get("bodyBatteryLowestValue")),
        value_or_blank(stats.get("moderateIntensityMinutes")),
        value_or_blank(stats.get("vigorousIntensityMinutes")),
        value_or_blank(stats.get("minHeartRate")),
        value_or_blank(stats.get("minAvgHeartRate")),
        value_or_blank(stats.get("maxHeartRate")),
        one_decimal_or_blank(stats.get("averageSpo2")),
        one_decimal_or_blank(stats.get("lowestSpo2")),
        one_decimal_or_blank(stats.get("avgWakingRespirationValue")),
        one_decimal_or_blank(stats.get("lowestRespirationValue")),
        existing_note,
    ]


def import_daily(ctx: ImportContext, garmin: GarminClient) -> ImportResult:
    print(f"\n[DZIEN] Zakres: {ctx.start_date} – {ctx.end_date}")
    worksheet = ctx.sheets.worksheet(WORKSHEET_NAME)
    ensure_column_header(worksheet, IMPORT_TIMESTAMP_HEADER)
    existing_rows = get_existing_rows_by_key(worksheet, note_column=NOTE_COLUMN, key_normalizer=date_key)
    api = garmin.api
    tz = ctx.config.timezone

    updated_count = 0
    appended_rows = []
    pending_updates: list[tuple[int, list]] = []

    for day, _ in iter_days(ctx.start_date, ctx.end_date):
        print(f"  Pobieram {day}...")
        existing = existing_rows.get(day, {})
        existing_note = existing.get("note", "")

        try:
            stats = api.get_stats(day) or {}
            row_values = build_row(
                day, stats, existing_note=existing_note, imported_at=now_in_tz(tz), tz=tz,
            )
        except Exception as error:
            print(f"    Błąd: {type(error).__name__}: {error}")
            row_values = [
                format_day_with_time(day, tz=tz), "", "", "", "", "", "", "", "", "", "", "", "",
                "", "", "", "", "", "", existing_note or f"Błąd importu: {type(error).__name__}",
            ]

        if day in existing_rows:
            pending_updates.append((existing_rows[day]["row_number"], row_values))
        else:
            appended_rows.append(row_values)

        garmin.pause()

    batch_update_rows(worksheet, pending_updates, "U")
    updated_count = len(pending_updates)

    if appended_rows:
        worksheet.append_rows(appended_rows, value_input_option="USER_ENTERED")

    print(f"  Gotowe: zaktualizowano {updated_count}, dopisano {len(appended_rows)}")
    return ImportResult("dzien", updated=updated_count, appended=len(appended_rows))
