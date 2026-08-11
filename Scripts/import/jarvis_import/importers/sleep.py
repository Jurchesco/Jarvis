from __future__ import annotations

from datetime import datetime

from ..dates import date_key, format_day_with_time
from ..garmin import GarminClient, iter_days
from ..sheets import ImportResult, batch_update_rows, get_existing_rows_by_key
from . import ImportContext


WORKSHEET_NAME = "Sen"
NOTE_COLUMN = 27
COLUMN_RANGE = "A:AB"


def value_or_blank(value):
    return "" if value is None else value


def minutes_to_hm_text(minutes):
    if minutes is None:
        return ""
    hours = int(minutes) // 60
    mins = int(minutes) % 60
    return f"{hours}h {mins:02d}m"


def format_sleep_window(sleep_data):
    start_local = sleep_data.get("sleepStartTimestampLocal")
    end_local = sleep_data.get("sleepEndTimestampLocal")
    if not start_local or not end_local:
        return "brak danych"
    try:
        start_time = datetime.utcfromtimestamp(start_local / 1000).strftime("%H:%M")
        end_time = datetime.utcfromtimestamp(end_local / 1000).strftime("%H:%M")
        return f"{start_time}-{end_time}"
    except Exception:
        return "brak danych"


def get_sleep_scores(sleep_data):
    score_data = sleep_data.get("sleepScores", {}) or {}
    overall = score_data.get("overall", {}) or {}
    score = overall.get("value")
    qualifier = overall.get("qualifierKey")
    qualifier_map = {
        "EXCELLENT": "Bardzo dobry",
        "GOOD": "Dobry",
        "FAIR": "Dostateczny",
        "POOR": "Słaby",
    }
    return value_or_blank(score), qualifier_map.get(qualifier, value_or_blank(qualifier))


def get_sleep_minutes(sleep_data):
    return {
        "sleep_minutes": sleep_data.get("sleepTimeSeconds", 0) // 60 if sleep_data.get("sleepTimeSeconds") is not None else None,
        "deep_minutes": sleep_data.get("deepSleepSeconds", 0) // 60 if sleep_data.get("deepSleepSeconds") is not None else None,
        "light_minutes": sleep_data.get("lightSleepSeconds", 0) // 60 if sleep_data.get("lightSleepSeconds") is not None else None,
        "rem_minutes": sleep_data.get("remSleepSeconds", 0) // 60 if sleep_data.get("remSleepSeconds") is not None else None,
        "awake_minutes": sleep_data.get("awakeSleepSeconds", 0) // 60 if sleep_data.get("awakeSleepSeconds") is not None else None,
    }


def percent_text(part, total):
    if part is None or total in (None, 0):
        return ""
    return f"{round((part / total) * 100, 1)}%"


def get_hrv_summary(hrv_data):
    if not isinstance(hrv_data, dict):
        return {}
    return hrv_data.get("hrvSummary", {}) or {}


def one_decimal_text(value, suffix=""):
    if value is None:
        return ""
    text = f"{round(float(value), 1)}"
    return f"{text}{suffix}" if suffix else text


def build_no_data_row(day, existing_note="", imported_at: datetime | None = None):
    return [
        format_day_with_time(day, imported_at),
        *["brak danych"] * 26,
        existing_note or "Zegarek nie był noszony podczas snu lub Garmin nie ma danych.",
    ]


def build_row(day, sleep_data, hrv_data, stats, existing_note="", imported_at: datetime | None = None):
    if not sleep_data or not sleep_data.get("dailySleepDTO"):
        return build_no_data_row(day, existing_note=existing_note, imported_at=imported_at)

    daily_sleep_dto = sleep_data.get("dailySleepDTO", {}) or {}
    sleep_minutes = get_sleep_minutes(daily_sleep_dto)
    total_sleep = sleep_minutes["sleep_minutes"]
    deep_minutes = sleep_minutes["deep_minutes"]
    light_minutes = sleep_minutes["light_minutes"]
    rem_minutes = sleep_minutes["rem_minutes"]
    awake_minutes = sleep_minutes["awake_minutes"]
    sleep_history = sleep_data.get("sleepMovement", []) or []
    score, qualifier = get_sleep_scores(daily_sleep_dto)
    hrv_summary = get_hrv_summary(hrv_data)

    time_in_bed_minutes = None
    if daily_sleep_dto.get("sleepStartTimestampLocal") and daily_sleep_dto.get("sleepEndTimestampLocal"):
        start_ts = daily_sleep_dto.get("sleepStartTimestampGMT")
        end_ts = daily_sleep_dto.get("sleepEndTimestampGMT")
        if start_ts is not None and end_ts is not None:
            time_in_bed_minutes = int((end_ts - start_ts) / 1000 / 60)

    restless_moments = 0
    if isinstance(sleep_history, list):
        restless_moments = sum(
            1 for item in sleep_history
            if isinstance(item, dict) and item.get("activityLevel") in ("HIGH", "ACTIVE", 4, 5, 6)
        )

    avg_hr = daily_sleep_dto.get("avgHeartRate")
    avg_resp = daily_sleep_dto.get("averageRespirationValue") or stats.get("avgRespirationValue")
    lowest_resp = stats.get("lowestRespirationValue") or daily_sleep_dto.get("lowestRespirationValue")

    return [
        format_day_with_time(day, imported_at),
        format_sleep_window(daily_sleep_dto),
        minutes_to_hm_text(total_sleep) if total_sleep is not None else "brak danych",
        minutes_to_hm_text(time_in_bed_minutes) if time_in_bed_minutes is not None else "brak danych",
        value_or_blank(score) if score != "" else "brak danych",
        qualifier if qualifier != "" else "brak danych",
        minutes_to_hm_text(deep_minutes) if deep_minutes is not None else "brak danych",
        percent_text(deep_minutes, total_sleep) if deep_minutes is not None else "brak danych",
        minutes_to_hm_text(light_minutes) if light_minutes is not None else "brak danych",
        percent_text(light_minutes, total_sleep) if light_minutes is not None else "brak danych",
        minutes_to_hm_text(rem_minutes) if rem_minutes is not None else "brak danych",
        percent_text(rem_minutes, total_sleep) if rem_minutes is not None else "brak danych",
        minutes_to_hm_text(awake_minutes) if awake_minutes is not None else "brak danych",
        value_or_blank(daily_sleep_dto.get("awakeCount")) if daily_sleep_dto.get("awakeCount") is not None else "brak danych",
        restless_moments if restless_moments is not None else "brak danych",
        value_or_blank(stats.get("averageStressLevel")) if stats.get("averageStressLevel") is not None else "brak danych",
        f"{round(avg_hr)} bpm" if avg_hr is not None else "brak danych",
        f"{stats.get('restingHeartRate')} bpm" if stats.get("restingHeartRate") is not None else "brak danych",
        one_decimal_text(avg_resp, " / min") if avg_resp is not None else "brak danych",
        one_decimal_text(lowest_resp, " / min") if lowest_resp is not None else "brak danych",
        f"{hrv_summary.get('lastNightAvg')} ms" if hrv_summary.get("lastNightAvg") is not None else "brak danych",
        value_or_blank(hrv_summary.get("status")) if hrv_summary.get("status") is not None else "brak danych",
        f"{hrv_summary.get('weeklyAvg')} ms" if hrv_summary.get("weeklyAvg") is not None else "brak danych",
        value_or_blank(hrv_summary.get("lastNight5MinHigh")) if hrv_summary.get("lastNight5MinHigh") is not None else "brak danych",
        value_or_blank(stats.get("bodyBatteryAtWakeTime")) if stats.get("bodyBatteryAtWakeTime") is not None else "brak danych",
        value_or_blank(stats.get("bodyBatteryLowestValue")) if stats.get("bodyBatteryLowestValue") is not None else "brak danych",
        value_or_blank(stats.get("bodyBatteryDuringSleep")) if stats.get("bodyBatteryDuringSleep") is not None else "brak danych",
        existing_note,
    ]


def import_sleep(ctx: ImportContext, garmin: GarminClient) -> ImportResult:
    print(f"\n[SEN] Zakres: {ctx.start_date} – {ctx.end_date}")
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
            sleep_data = api.get_sleep_data(day) or {}
            hrv_data = api.get_hrv_data(day) or {}
            stats = api.get_stats(day) or {}
            row_values = build_row(
                day, sleep_data, hrv_data, stats,
                existing_note=existing_note,
                imported_at=datetime.now(),
            )
        except Exception as error:
            print(f"    Błąd: {type(error).__name__}: {error}")
            row_values = [""] * 28
            row_values[0] = format_day_with_time(day)
            row_values[27] = existing_note or f"Błąd importu: {type(error).__name__}"

        if day in existing_rows:
            pending_updates.append((existing_rows[day]["row_number"], row_values))
        else:
            appended_rows.append(row_values)

        garmin.pause()

    batch_update_rows(worksheet, pending_updates, "AB")
    updated_count = len(pending_updates)

    if appended_rows:
        worksheet.append_rows(appended_rows, value_input_option="USER_ENTERED")

    print(f"  Gotowe: zaktualizowano {updated_count}, dopisano {len(appended_rows)}")
    return ImportResult("sen", updated=updated_count, appended=len(appended_rows))
