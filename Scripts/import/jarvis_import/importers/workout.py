from __future__ import annotations

from google.oauth2.service_account import Credentials
import gspread
from supabase import Client, create_client

from ..dates import format_datetime, local_date_bounds_utc, normalize_datetime_for_key, utc_iso_to_local
from ..sheets import ImportResult, batch_update_rows
from ..sort_sheets import sort_worksheet_by_name
from . import ImportContext


WORKSHEET_NAME = "Silownia_import"
SUPABASE_PAGE_SIZE = 1000
IN_FILTER_CHUNK = 200

HEADERS = [
    "Data", "Split", "Cwiczenie", "Set", "Ciezar (kg)",
    "Powtorzenia", "Est. 1RM", "Volume", "PR", "Bol / Niggle", "Uwagi", "Czas serii",
    "Session ID", "Exercise ID",
]

COL_SESSION_ID = 12
COL_EXERCISE_ID = 13
LEGACY_HEADERS = HEADERS[:12]

SET_LOG_SELECT = "session_id, exercise_id, set_number, reps, weight_kg, completed_at"
SESSION_SELECT = "id, started_at, completed_at, notes, sheet_id, workout_sheets(name)"


def brzycki_1rm(weight: float, reps: int) -> float:
    if reps <= 0 or weight <= 0:
        return 0
    return round(weight / (1.0278 - 0.0278 * reps), 1)


def make_stable_key(session_id: str, exercise_id: str) -> str:
    return f"{session_id}|{exercise_id}"


def make_legacy_key(row: list) -> str:
    data = normalize_datetime_for_key(str(row[0]))
    exercise = str(row[2]).strip()
    if not data or not exercise:
        return ""
    return f"{data}|{exercise}"


def ensure_headers(worksheet, values: list[list]) -> None:
    if not values:
        worksheet.update("A1", [HEADERS])
        return

    current = values[0]
    if current[: len(HEADERS)] == HEADERS:
        return

    if current[: len(LEGACY_HEADERS)] == LEGACY_HEADERS:
        worksheet.update("A1", [HEADERS])
        return

    worksheet.update("A1", [HEADERS])


def get_existing_rows_maps(worksheet):
    values = worksheet.get_all_values()
    ensure_headers(worksheet, values)
    if not values:
        values = worksheet.get_all_values()

    stable_map: dict[str, int] = {}
    legacy_map: dict[str, int] = {}
    for row_number, row in enumerate(values[1:], start=2):
        if len(row) < 4 or not row[0].strip():
            continue
        padded = row + [""] * (len(HEADERS) - len(row))
        session_id = str(padded[COL_SESSION_ID]).strip()
        exercise_id = str(padded[COL_EXERCISE_ID]).strip()
        if session_id and exercise_id:
            stable_map[make_stable_key(session_id, exercise_id)] = row_number

        legacy_key = make_legacy_key(padded)
        if legacy_key:
            legacy_map[legacy_key] = row_number

    return stable_map, legacy_map


def resolve_existing_row(
    session_id: str,
    exercise_id: str,
    row: list,
    stable_map: dict[str, int],
    legacy_map: dict[str, int],
) -> int | None:
    stable_key = make_stable_key(session_id, exercise_id)
    if stable_key in stable_map:
        return stable_map[stable_key]

    legacy_key = make_legacy_key(row)
    if legacy_key in legacy_map:
        return legacy_map[legacy_key]

    return None


def fetch_set_logs_paginated(
    supabase: Client,
    *,
    gte: str | None = None,
    lte: str | None = None,
    lt: str | None = None,
) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    while True:
        query = supabase.table("session_set_logs").select(SET_LOG_SELECT)
        if gte is not None:
            query = query.gte("completed_at", gte)
        if lte is not None:
            query = query.lte("completed_at", lte)
        if lt is not None:
            query = query.lt("completed_at", lt)
        response = (
            query.order("completed_at")
            .range(offset, offset + SUPABASE_PAGE_SIZE - 1)
            .execute()
        )
        batch = response.data or []
        rows.extend(batch)
        if len(batch) < SUPABASE_PAGE_SIZE:
            break
        offset += SUPABASE_PAGE_SIZE
    return rows


def fetch_rows_by_ids(
    supabase: Client,
    table: str,
    select: str,
    id_column: str,
    ids: set[str],
) -> list[dict]:
    if not ids:
        return []
    id_list = list(ids)
    rows: list[dict] = []
    for offset in range(0, len(id_list), IN_FILTER_CHUNK):
        chunk = id_list[offset : offset + IN_FILTER_CHUNK]
        response = supabase.table(table).select(select).in_(id_column, chunk).execute()
        rows.extend(response.data or [])
    return rows


def build_max_weight_before_range(logs: list[dict]) -> dict[str, float]:
    max_by_exercise: dict[str, float] = {}
    for log in logs:
        exercise_id = log["exercise_id"]
        weight = log["weight_kg"] or 0
        if weight > max_by_exercise.get(exercise_id, 0):
            max_by_exercise[exercise_id] = weight
    return max_by_exercise


def import_workout(ctx: ImportContext) -> ImportResult:
    if not ctx.config.supabase_url or not ctx.config.supabase_secret_key:
        return ImportResult("silownia", skipped=1, error="Brak SUPABASE_URL/SUPABASE_SECRET_KEY — pominięto")

    print(f"\n[SILOWNIA] Zakres: {ctx.start_date} – {ctx.end_date}")

    supabase = create_client(ctx.config.supabase_url, ctx.config.supabase_secret_key)
    tz = ctx.config.timezone
    start_str = ctx.start_date.isoformat()
    end_str = ctx.end_date.isoformat()
    range_start_utc, range_end_utc = local_date_bounds_utc(ctx.start_date, ctx.end_date, tz)

    prior_logs = fetch_set_logs_paginated(supabase, lt=range_start_utc)
    max_weight_by_exercise = build_max_weight_before_range(prior_logs)
    if prior_logs:
        print(f"  Historia PR: {len(prior_logs)} serii przed zakresem")

    logs = fetch_set_logs_paginated(
        supabase,
        gte=range_start_utc,
        lte=range_end_utc,
    )
    print(f"  Serie w zakresie (completed_at): {len(logs)}")

    if not logs and not prior_logs:
        return ImportResult(
            "silownia",
            skipped=1,
            error="Brak zalogowanych serii — pominięto",
        )

    session_ids = {log["session_id"] for log in logs}
    exercise_ids = {log["exercise_id"] for log in logs}

    sessions_list = fetch_rows_by_ids(supabase, "workout_sessions", SESSION_SELECT, "id", session_ids)
    sessions = {s["id"]: s for s in sessions_list}

    exercises_list = fetch_rows_by_ids(supabase, "exercises", "id, name", "id", exercise_ids)
    exercises = {e["id"]: e["name"] for e in exercises_list}

    notes_list = fetch_rows_by_ids(
        supabase,
        "session_exercise_notes",
        "session_id, exercise_id, notes",
        "session_id",
        session_ids,
    )
    exercise_notes = {
        f"{n['session_id']}:{n['exercise_id']}": n["notes"]
        for n in notes_list
    }

    rows_to_upsert: list[list] = []
    skipped_out_of_range = 0

    groups: dict[str, dict] = {}

    for log in logs:
        session = sessions.get(log["session_id"])
        if not session:
            continue

        session_date = utc_iso_to_local(session["started_at"], tz)
        date_str = session_date.strftime("%Y-%m-%d")
        if date_str < start_str or date_str > end_str:
            skipped_out_of_range += 1
            continue

        group_key = f"{log['session_id']}:{log['exercise_id']}"
        if group_key not in groups:
            groups[group_key] = {
                "session_id": log["session_id"],
                "exercise_id": log["exercise_id"],
                "logs": [],
            }
        groups[group_key]["logs"].append(log)

    for group in groups.values():
        session = sessions.get(group["session_id"])
        if not session:
            continue

        sorted_logs = sorted(group["logs"], key=lambda item: item["set_number"])
        set_count = len(sorted_logs)
        first = sorted_logs[0]
        weight = first["weight_kg"] or 0
        reps = first["reps"] or 0
        exercise_id = group["exercise_id"]
        session_id = group["session_id"]

        prev_max = max_weight_by_exercise.get(exercise_id, 0)
        is_pr = weight > 0 and weight > prev_max
        if weight > prev_max:
            max_weight_by_exercise[exercise_id] = weight

        session_date = utc_iso_to_local(session["started_at"], tz)
        data_value = format_datetime(session_date)
        split_name = "Brak"
        if session.get("workout_sheets"):
            split_name = session["workout_sheets"].get("name", "Brak")

        exercise_name = exercises.get(exercise_id, "Nieznane cwiczenie")
        note_key = f"{session_id}:{exercise_id}"
        volume = weight * reps * set_count

        rows_to_upsert.append([
            data_value,
            split_name,
            exercise_name,
            set_count,
            weight,
            reps,
            brzycki_1rm(weight, reps),
            volume,
            "Tak" if is_pr else "",
            exercise_notes.get(note_key, ""),
            session.get("notes") or "",
            "",
            session_id,
            exercise_id,
        ])

    if not rows_to_upsert:
        return ImportResult(
            "silownia",
            skipped=max(skipped_out_of_range, 1),
            error=f"Brak serii w zakresie {start_str}–{end_str} — pominięto",
        )

    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]
    creds = Credentials.from_service_account_file(
        str(ctx.config.google_credentials_file),
        scopes=scopes,
    )
    gc = gspread.authorize(creds)
    spreadsheet = gc.open_by_key(ctx.config.spreadsheet_id)

    try:
        worksheet = spreadsheet.worksheet(WORKSHEET_NAME)
    except gspread.WorksheetNotFound:
        worksheet = spreadsheet.add_worksheet(title=WORKSHEET_NAME, rows=1000, cols=20)
        print(f"  Utworzono zakładkę: {WORKSHEET_NAME}")

    stable_map, legacy_map = get_existing_rows_maps(worksheet)
    pending_updates: list[tuple[int, list]] = []
    appended_rows = []

    for row in rows_to_upsert:
        session_id = str(row[COL_SESSION_ID])
        exercise_id = str(row[COL_EXERCISE_ID])
        existing_row = resolve_existing_row(session_id, exercise_id, row, stable_map, legacy_map)
        if existing_row is not None:
            pending_updates.append((existing_row, row))
            stable_map[make_stable_key(session_id, exercise_id)] = existing_row
        else:
            appended_rows.append(row)

    batch_update_rows(worksheet, pending_updates, "N")
    updated_count = len(pending_updates)

    if appended_rows:
        worksheet.append_rows(appended_rows, value_input_option="USER_ENTERED")

    sorted_rows = sort_worksheet_by_name(worksheet, WORKSHEET_NAME)
    print(
        f"  Gotowe: zaktualizowano {updated_count}, dopisano {len(appended_rows)}, "
        f"posortowano {sorted_rows} wierszy "
        f"(pominięto poza zakresem sesji: {skipped_out_of_range})"
    )
    return ImportResult(
        "silownia",
        updated=updated_count,
        appended=len(appended_rows),
        skipped=skipped_out_of_range,
    )
