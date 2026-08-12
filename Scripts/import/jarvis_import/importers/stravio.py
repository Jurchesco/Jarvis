from __future__ import annotations

from google.oauth2.service_account import Credentials
import gspread
from supabase import Client, create_client

from ..dates import format_datetime, local_date_bounds_utc, utc_iso_to_local
from ..sheets import ImportResult, batch_update_rows
from ..sort_sheets import sort_worksheet_by_name
from . import ImportContext


WORKSHEET_NAME = "Silownia_import"
SUPABASE_PAGE_SIZE = 1000
IN_FILTER_CHUNK = 200

HEADERS = [
    "Data", "Split", "Cwiczenie", "Set", "Ciezar (kg)",
    "Powtorzenia", "Est. 1RM", "Volume", "PR", "Bol / Niggle", "Uwagi", "Czas serii",
]

SET_LOG_SELECT = "session_id, exercise_id, set_number, reps, weight_kg, completed_at"
SESSION_SELECT = "id, started_at, completed_at, notes, sheet_id, workout_sheets(name)"


def brzycki_1rm(weight: float, reps: int) -> float:
    if reps <= 0 or weight <= 0:
        return 0
    return round(weight / (1.0278 - 0.0278 * reps), 1)


def make_key(row: list) -> str:
    return "|".join([
        str(row[0]),   # Data
        str(row[2]),   # Cwiczenie
        str(row[3]),   # Set
        str(row[11]),  # Czas serii
    ])


def get_existing_rows_map(worksheet):
    values = worksheet.get_all_values()
    if not values:
        worksheet.update("A1", [HEADERS])
        return {}

    if values[0][: len(HEADERS)] != HEADERS:
        worksheet.update("A1", [HEADERS])

    rows_map = {}
    for row_number, row in enumerate(values[1:], start=2):
        if len(row) < 4 or not row[0].strip():
            continue
        padded = row + [""] * (len(HEADERS) - len(row))
        rows_map[make_key(padded)] = row_number
    return rows_map


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


def import_stravio(ctx: ImportContext) -> ImportResult:
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
            error="Brak zalogowanych serii w Stravio — pominięto",
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

    for log in logs:
        session = sessions.get(log["session_id"])
        if not session:
            continue

        session_date = utc_iso_to_local(session["started_at"], tz)
        date_str = session_date.strftime("%Y-%m-%d")
        data_value = format_datetime(session_date)
        weight = log["weight_kg"] or 0
        reps = log["reps"] or 0
        exercise_id = log["exercise_id"]

        prev_max = max_weight_by_exercise.get(exercise_id, 0)
        is_pr = weight > 0 and weight > prev_max
        if weight > prev_max:
            max_weight_by_exercise[exercise_id] = weight

        if date_str < start_str or date_str > end_str:
            skipped_out_of_range += 1
            continue

        split_name = "Brak"
        if session.get("workout_sheets"):
            split_name = session["workout_sheets"].get("name", "Brak")

        exercise_name = exercises.get(exercise_id, "Nieznane cwiczenie")
        set_time = utc_iso_to_local(log["completed_at"], tz).strftime("%H:%M")
        note_key = f"{log['session_id']}:{exercise_id}"

        rows_to_upsert.append([
            data_value,
            split_name,
            exercise_name,
            log["set_number"],
            weight,
            reps,
            brzycki_1rm(weight, reps),
            weight * reps,
            "Tak" if is_pr else "",
            exercise_notes.get(note_key, ""),
            session.get("notes") or "",
            set_time,
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

    existing_rows = get_existing_rows_map(worksheet)
    pending_updates: list[tuple[int, list]] = []
    appended_rows = []

    for row in rows_to_upsert:
        key = make_key(row)
        if key in existing_rows:
            pending_updates.append((existing_rows[key], row))
        else:
            appended_rows.append(row)

    batch_update_rows(worksheet, pending_updates, "L")
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
