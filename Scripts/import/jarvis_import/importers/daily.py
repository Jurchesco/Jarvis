from __future__ import annotations

from datetime import datetime

from ..dates import date_key, format_day_with_time
from ..garmin import GarminClient, iter_days
from ..sheets import ImportResult, get_existing_rows_by_key
from . import ImportContext


WORKSHEET_NAME = "Dzien"
NOTE_COLUMN = 20


def value_or_blank(value):
    return "" if value is None else value


def one_decimal_or_blank(value):
    if value is None:
        return ""
    return round(float(value), 1)


def build_row(day, stats, existing_note="", imported_at: datetime | None = None):
    return [
        format_day_with_time(day, imported_at),
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
    existing_rows = get_existing_rows_by_key(worksheet, note_column=NOTE_COLUMN, key_normalizer=date_key)
    api = garmin.api

    updated_count = 0
    appended_rows = []

    for day, _ in iter_days(ctx.start_date, ctx.end_date):
        print(f"  Pobieram {day}...")
        existing = existing_rows.get(day, {})
        existing_note = existing.get("note", "")

        try:
            stats = api.get_stats(day) or {}
            row_values = build_row(day, stats, existing_note=existing_note, imported_at=datetime.now())
        except Exception as error:
            print(f"    Błąd: {type(error).__name__}: {error}")
            row_values = [
                format_day_with_time(day), "", "", "", "", "", "", "", "", "", "", "", "",
                "", "", "", "", "", "", existing_note or f"Błąd importu: {type(error).__name__}",
            ]

        if day in existing_rows:
            row_number = existing_rows[day]["row_number"]
            worksheet.update(
                range_name=f"A{row_number}:U{row_number}",
                values=[row_values],
                value_input_option="USER_ENTERED",
            )
            updated_count += 1
        else:
            appended_rows.append(row_values)

        garmin.pause()

    if appended_rows:
        worksheet.append_rows(appended_rows, value_input_option="USER_ENTERED")

    print(f"  Gotowe: zaktualizowano {updated_count}, dopisano {len(appended_rows)}")
    return ImportResult("dzien", updated=updated_count, appended=len(appended_rows))
