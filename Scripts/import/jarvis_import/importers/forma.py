from __future__ import annotations

from datetime import datetime

from ..dates import IMPORT_TIMESTAMP_HEADER, date_key, format_day_with_time, now_in_tz
from ..garmin import GarminClient, iter_days
from ..sheets import ImportResult, batch_update_rows, ensure_column_header, get_existing_rows_by_key
from ..sort_sheets import sort_worksheet_by_name
from ..supabase_journal import as_float, as_int, get_supabase, require_owner_user_id, upsert_rows
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


def build_row(day, hrv_data, stats, existing_note="", imported_at: datetime | None = None, tz=None):
    summary = get_hrv_summary(hrv_data)
    baseline_low, baseline_high = get_baseline(summary)
    return [
        format_day_with_time(day, imported_at, tz=tz),
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


def forma_to_supabase(user_id: str, day, hrv_data, stats, note: str = "") -> dict:
    day_str = day.isoformat() if hasattr(day, "isoformat") else str(day)
    summary = get_hrv_summary(hrv_data)
    baseline_low, baseline_high = get_baseline(summary)
    return {
        "user_id": user_id,
        "day": day_str,
        "hrv_last_night_avg": as_float(summary.get("lastNightAvg")),
        "hrv_weekly_avg": as_float(summary.get("weeklyAvg")),
        "hrv_status": summary.get("status"),
        "hrv_baseline_low": as_float(baseline_low),
        "hrv_baseline_high": as_float(baseline_high),
        "resting_heart_rate": as_int(stats.get("restingHeartRate")),
        "resting_hr_7d_avg": as_int(stats.get("lastSevenDaysAvgRestingHeartRate")),
        "body_battery_wake": as_int(stats.get("bodyBatteryAtWakeTime")),
        "average_stress": as_int(stats.get("averageStressLevel")),
        "active_kilocalories": as_int(stats.get("activeKilocalories")),
        "moderate_intensity_min": as_int(stats.get("moderateIntensityMinutes")),
        "vigorous_intensity_min": as_int(stats.get("vigorousIntensityMinutes")),
        "note": note or None,
    }


def import_forma(ctx: ImportContext, garmin: GarminClient) -> ImportResult:
    print(f"\n[FORMA] Zakres: {ctx.start_date} – {ctx.end_date}")
    worksheet = ctx.sheets.worksheet(WORKSHEET_NAME)
    ensure_column_header(worksheet, IMPORT_TIMESTAMP_HEADER)
    existing_rows = get_existing_rows_by_key(worksheet, note_column=NOTE_COLUMN, key_normalizer=date_key)
    api = garmin.api
    tz = ctx.config.timezone

    updated_count = 0
    appended_rows = []
    pending_updates: list[tuple[int, list]] = []
    supabase_rows: list[dict] = []
    user_id = require_owner_user_id(ctx.config)

    for day, _ in iter_days(ctx.start_date, ctx.end_date):
        print(f"  Pobieram {day}...")
        existing = existing_rows.get(day, {})
        existing_note = existing.get("note", "")

        try:
            hrv_data = api.get_hrv_data(day) or {}
            stats = api.get_stats(day) or {}
            row_values = build_row(
                day, hrv_data, stats, existing_note=existing_note, imported_at=now_in_tz(tz), tz=tz,
            )
            if user_id:
                supabase_rows.append(forma_to_supabase(user_id, day, hrv_data, stats, existing_note))
        except Exception as error:
            print(f"    Błąd: {type(error).__name__}: {error}")
            row_values = [
                format_day_with_time(day, tz=tz), "", "", "", "", "", "", "", "", "", "", "", "",
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

    sorted_rows = sort_worksheet_by_name(worksheet, WORKSHEET_NAME)

    client = get_supabase(ctx.config)
    if client and user_id and supabase_rows:
        try:
            n = upsert_rows(client, "garmin_forma_days", supabase_rows, on_conflict="user_id,day")
            print(f"  Supabase garmin_forma_days: upsert {n}")
        except Exception as error:
            print(f"  UWAGA: upsert Supabase forma: {type(error).__name__}: {error}")
    elif not user_id or not client:
        print("  Supabase forma: pominięto (brak JJ_WORKOUT_USER_ID / SUPABASE_*)")

    print(f"  Gotowe: zaktualizowano {updated_count}, dopisano {len(appended_rows)}, posortowano {sorted_rows} wierszy")
    return ImportResult("forma", updated=updated_count, appended=len(appended_rows))
