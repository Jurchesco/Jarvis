from __future__ import annotations

from datetime import datetime

from ..dates import combine_date_time
from ..garmin import GarminClient
from ..sheets import ImportResult, batch_update_rows, get_existing_rows_by_key
from . import ImportContext


WORKSHEET_NAME = "Aktywnosci"
NOTE_COLUMN = 32
PAGE_SIZE = 50
MAX_PAGES = 20


def val(data, *keys, default=""):
    if not isinstance(data, dict):
        return default
    for key in keys:
        if data.get(key) is not None:
            return data.get(key)
    return default


def fmt_num(value, digits=0):
    if value in ("", None):
        return ""
    try:
        return f"{float(value):.{digits}f}"
    except (TypeError, ValueError):
        return str(value)


def fmt_int(value):
    if value in ("", None):
        return ""
    try:
        return str(int(round(float(value))))
    except (TypeError, ValueError):
        return str(value)


def seconds_to_hms(seconds):
    if seconds in ("", None):
        return ""
    try:
        seconds = int(round(float(seconds)))
        h = seconds // 3600
        m = (seconds % 3600) // 60
        s = seconds % 60
        return f"{h:02d}:{m:02d}:{s:02d}"
    except (TypeError, ValueError):
        return ""


def meters_to_km(value):
    if value in ("", None):
        return ""
    try:
        return f"{float(value) / 1000:.2f}"
    except (TypeError, ValueError):
        return ""


def ms_to_kmh(value):
    if value in ("", None):
        return ""
    try:
        return f"{float(value) * 3.6:.2f}"
    except (TypeError, ValueError):
        return ""


def speed_to_pace(value):
    if value in ("", None):
        return ""
    try:
        value = float(value)
        if value <= 0:
            return ""
        seconds_per_km = 1000 / value
        minutes = int(seconds_per_km // 60)
        seconds = int(round(seconds_per_km % 60))
        if seconds == 60:
            minutes += 1
            seconds = 0
        return f"{minutes}:{seconds:02d}"
    except (TypeError, ValueError, ZeroDivisionError):
        return ""


def parse_start(activity):
    start_local = val(activity, "startTimeLocal")
    if not start_local:
        return "", ""
    try:
        dt = datetime.fromisoformat(start_local.replace("Z", ""))
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M:%S")
    except ValueError:
        if " " in start_local:
            parts = start_local.split(" ")
            if len(parts) >= 2:
                return parts[0], parts[1]
        return start_local, ""


def get_activity_type(activity):
    activity_type = activity.get("activityType", {})
    if isinstance(activity_type, dict):
        return val(activity_type, "typeKey", "typeId", default="")
    return ""


def get_device_label(activity):
    metadata = activity.get("metadataDTO") or activity.get("metadata") or {}
    if isinstance(metadata, dict):
        manufacturer = val(metadata, "manufacturer")
        device_name = val(metadata, "deviceName", "agentClass")
        parts = [x for x in [manufacturer, device_name] if x]
        return " ".join(parts)
    return ""


def build_row(activity, existing_note=""):
    start_date, start_time = parse_start(activity)
    return [
        combine_date_time(start_date, start_time),
        start_time,
        str(val(activity, "activityId")),
        get_activity_type(activity),
        val(activity, "activityName"),
        seconds_to_hms(val(activity, "duration")),
        meters_to_km(val(activity, "distance")),
        fmt_int(val(activity, "calories")),
        fmt_int(val(activity, "elevationGain")),
        fmt_int(val(activity, "elevationLoss")),
        fmt_int(val(activity, "averageHR")),
        fmt_int(val(activity, "maxHR")),
        fmt_int(val(activity, "minHR")),
        speed_to_pace(val(activity, "averageSpeed")),
        speed_to_pace(val(activity, "maxSpeed")),
        ms_to_kmh(val(activity, "averageSpeed")),
        ms_to_kmh(val(activity, "maxSpeed")),
        fmt_int(val(activity, "averageRunningCadenceInStepsPerMinute", "averageBikingCadenceInRevPerMinute")),
        fmt_int(val(activity, "maxRunningCadenceInStepsPerMinute", "maxBikingCadenceInRevPerMinute")),
        fmt_int(val(activity, "avgPower")),
        fmt_int(val(activity, "maxPower")),
        fmt_int(val(activity, "normPower")),
        fmt_num(val(activity, "aerobicTrainingEffect"), 1),
        fmt_num(val(activity, "anaerobicTrainingEffect"), 1),
        fmt_int(val(activity, "activityTrainingLoad")),
        fmt_num(val(activity, "vO2MaxValue"), 1),
        fmt_num(val(activity, "avgTemperature"), 1),
        fmt_num(val(activity, "minTemperature"), 1),
        fmt_num(val(activity, "maxTemperature"), 1),
        fmt_int(val(activity, "hydrationLoss")),
        fmt_int(val(activity, "lapCount")),
        get_device_label(activity),
        existing_note,
    ]


def get_activity_date(activity):
    start_date, _ = parse_start(activity)
    if not start_date:
        return None
    try:
        return datetime.strptime(start_date, "%Y-%m-%d").date()
    except ValueError:
        return None


def import_activities(ctx: ImportContext, garmin: GarminClient) -> ImportResult:
    print(f"\n[AKTYWNOSCI] Zakres: {ctx.start_date} – {ctx.end_date}")
    api = garmin.api

    all_activities = []
    for page in range(MAX_PAGES):
        start = page * PAGE_SIZE
        batch = api.get_activities(start, PAGE_SIZE) or []
        print(f"  Paczka {page + 1}: {len(batch)} aktywności")
        if not batch:
            break
        all_activities.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
        garmin.pause(0.4)

    recent_activities = [
        activity for activity in all_activities
        if (activity_date := get_activity_date(activity)) is not None
        and activity_date >= ctx.start_date
    ]
    print(f"  W zakresie: {len(recent_activities)} z {len(all_activities)} pobranych")

    worksheet = ctx.sheets.worksheet(WORKSHEET_NAME)
    existing_rows = get_existing_rows_by_key(worksheet, key_column=2, note_column=NOTE_COLUMN)

    updated_count = 0
    appended_rows = []
    pending_updates: list[tuple[int, list]] = []

    for activity in recent_activities:
        activity_id = str(val(activity, "activityId"))
        if not activity_id:
            continue

        existing = existing_rows.get(activity_id, {})
        existing_note = existing.get("note", "")
        row_values = build_row(activity, existing_note=existing_note)

        if activity_id in existing_rows:
            pending_updates.append((existing_rows[activity_id]["row_number"], row_values))
        else:
            appended_rows.append(row_values)

        garmin.pause(0.2)

    batch_update_rows(worksheet, pending_updates, "AG")
    updated_count = len(pending_updates)

    if appended_rows:
        worksheet.append_rows(appended_rows, value_input_option="USER_ENTERED")

    print(f"  Gotowe: zaktualizowano {updated_count}, dopisano {len(appended_rows)}")
    return ImportResult("aktywnosci", updated=updated_count, appended=len(appended_rows))
