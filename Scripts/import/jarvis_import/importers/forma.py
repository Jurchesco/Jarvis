from __future__ import annotations

from datetime import datetime

from ..dates import date_key, format_day_with_time
from ..garmin import GarminClient, iter_days
from ..sheets import ImportResult, batch_update_rows, get_existing_rows_by_key
from . import ImportContext


WORKSHEET_NAME = "Forma"
NOTE_COLUMN = 13


def value_or_blank(value):
    return "" if value is None else value


def get_hrv_summary(hrv_data):
    if not isinstance(hrv_data, dict):
        return {}
    return hrv_data.get("hrvSummary", {}) or {}


def get_baseline(summary):
    baseline = summary.get("baseline", {}) or {}
    lower = baseline.get("balancedLow") or baseline.get("lowUpper") or baseline.get("lowerBound")
    upper = baseline.get("balancedUpper") or baseline.get("upperBound")
    return lower, upper


def build_row(day, hrv_data, stats, existing_note="", imported_at: datetime | None = None):
    summary = get_hrv_summary(hrv_data)
    baseline_low, baseline_high = get_baseline(summary)
    return [
        format_day_with_time(day, imported_at),
        value_or_blank(summary.get("lastNightAvg")),
        value_or_blank(summary.get("weeklyAvg")),
        value_or_blank(summary.get("status")),
        value_or_blank(baseline_low),
        value_or_blank(baseline_high),
        value_or_blank(stats.get("restingHeartRate")),
        value_or_blank(stats.get("lastSevenDaysAvgRestingHeartRate")),
        value_or_blank(stats.get("bodyBatteryAtWakeTime")),
        value_or_blank(stats.get("averageStressLevel")),
        value_or_blank(stats.get("activeKilocalories")),
        value_or_blank(stats.get("moderateIntensityMinutes")),
        value_or_blank(stats.get("vigorousIntensityMinutes")),
        existing_note,
    ]


def import_forma(ctx: ImportContext, garmin: GarminClient) -> ImportResult:
    print(f"\n[FORMA] Zakres: {ctx.start_date} – {ctx.end_date}")
    worksheet = ctx.sheets.worksheet(WORKSHEET_NAME)
    existing_rows = get_existing_rows_by_key(worksheet, note_column=NOTE_COLUMN, key_normalizer=date_key)
    api = garmin.api

    updated_count = 0
    appended_rows = []
    pending_updates: list[tuple[int, list]] = []

    for day, _ in iter_days(ctx.start_date, ctx.end_date):
        print(f"  Pobieram {day}...")
        existing = existing_rows.get(day, {})
        existing_note = existing.get("note", "")

        try:
            hrv_data = api.get_hrv_data(day) or {}
            stats = api.get_stats(day) or {}
            row_values = build_row(day, hrv_data, stats, existing_note=existing_note, imported_at=datetime.now())
        except Exception as error:
            print(f"    Błąd: {type(error).__name__}: {error}")
            row_values = [
                format_day_with_time(day), "", "", "", "", "", "", "", "", "", "", "", "",
                existing_note or f"Błąd importu: {type(error).__name__}",
            ]

        if day in existing_rows:
            pending_updates.append((existing_rows[day]["row_number"], row_values))
        else:
            appended_rows.append(row_values)

        garmin.pause()

    batch_update_rows(worksheet, pending_updates, "N")
    updated_count = len(pending_updates)

    if appended_rows:
        worksheet.append_rows(appended_rows, value_input_option="USER_ENTERED")

    print(f"  Gotowe: zaktualizowano {updated_count}, dopisano {len(appended_rows)}")
    return ImportResult("forma", updated=updated_count, appended=len(appended_rows))
