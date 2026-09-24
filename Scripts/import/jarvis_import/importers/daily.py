from __future__ import annotations

from datetime import datetime

from ..dates import IMPORT_TIMESTAMP_HEADER, date_key, format_day_with_time, now_in_tz
from ..garmin import GarminClient, iter_days
from ..sheets import ImportResult, batch_update_rows, ensure_column_header, get_existing_rows_by_key
from ..sort_sheets import sort_worksheet_by_name
from ..supabase_journal import as_float, as_int, get_supabase, require_owner_user_id, upsert_rows
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


def stats_to_supabase(user_id: str, day, stats: dict, note: str = "") -> dict:
    day_str = day.isoformat() if hasattr(day, "isoformat") else str(day)
    return {
        "user_id": user_id,
        "day": day_str,
        "total_steps": as_int(stats.get("totalSteps")),
        "total_kilocalories": as_int(stats.get("totalKilocalories")),
        "active_kilocalories": as_int(stats.get("activeKilocalories")),
        "bmr_kilocalories": as_int(stats.get("bmrKilocalories")),
        "average_stress": as_int(stats.get("averageStressLevel")),
        "max_stress": as_int(stats.get("maxStressLevel")),
        "resting_heart_rate": as_int(stats.get("restingHeartRate")),
        "body_battery_wake": as_int(stats.get("bodyBatteryAtWakeTime")),
        "body_battery_high": as_int(stats.get("bodyBatteryHighestValue")),
        "body_battery_low": as_int(stats.get("bodyBatteryLowestValue")),
        "moderate_intensity_min": as_int(stats.get("moderateIntensityMinutes")),
        "vigorous_intensity_min": as_int(stats.get("vigorousIntensityMinutes")),
        "min_heart_rate": as_int(stats.get("minHeartRate")),
        "min_avg_heart_rate": as_int(stats.get("minAvgHeartRate")),
        "max_heart_rate": as_int(stats.get("maxHeartRate")),
        "average_spo2": as_float(stats.get("averageSpo2")),
        "lowest_spo2": as_float(stats.get("lowestSpo2")),
        "avg_waking_respiration": as_float(stats.get("avgWakingRespirationValue")),
        "lowest_respiration": as_float(stats.get("lowestRespirationValue")),
        "note": note or None,
    }


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
    supabase_rows: list[dict] = []
    user_id = require_owner_user_id(ctx.config)

    for day, _ in iter_days(ctx.start_date, ctx.end_date):
        print(f"  Pobieram {day}...")
        existing = existing_rows.get(day, {})
        existing_note = existing.get("note", "")

        try:
            stats = api.get_stats(day) or {}
            row_values = build_row(
                day, stats, existing_note=existing_note, imported_at=now_in_tz(tz), tz=tz,
            )
            if user_id:
                supabase_rows.append(stats_to_supabase(user_id, day, stats, existing_note))
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

    sorted_rows = sort_worksheet_by_name(worksheet, WORKSHEET_NAME)

    client = get_supabase(ctx.config)
    if client and user_id and supabase_rows:
        try:
            n = upsert_rows(client, "garmin_daily_stats", supabase_rows, on_conflict="user_id,day")
            print(f"  Supabase garmin_daily_stats: upsert {n}")
        except Exception as error:
            print(f"  UWAGA: upsert Supabase dzien: {type(error).__name__}: {error}")
    elif not user_id or not client:
        print("  Supabase dzien: pominięto (brak JJ_WORKOUT_USER_ID / SUPABASE_*)")

    print(f"  Gotowe: zaktualizowano {updated_count}, dopisano {len(appended_rows)}, posortowano {sorted_rows} wierszy")
    return ImportResult("dzien", updated=updated_count, appended=len(appended_rows))
