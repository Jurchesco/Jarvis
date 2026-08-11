from __future__ import annotations

from datetime import datetime

from google.oauth2.service_account import Credentials
import gspread
from supabase import create_client

from ..sheets import ImportResult, batch_update_rows
from . import ImportContext


WORKSHEET_NAME = "Silownia_import"

HEADERS = [
    "Data", "Split", "Cwiczenie", "Set", "Ciezar (kg)",
    "Powtorzenia", "Est. 1RM", "Volume", "PR", "Bol / Niggle", "Uwagi", "Czas serii",
]


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


def import_stravio(ctx: ImportContext) -> ImportResult:
    if not ctx.config.supabase_url or not ctx.config.supabase_secret_key:
        return ImportResult("silownia", skipped=1, error="Brak SUPABASE_URL/SUPABASE_SECRET_KEY — pominięto")

    print(f"\n[SILOWNIA] Zakres: {ctx.start_date} – {ctx.end_date}")

    supabase = create_client(ctx.config.supabase_url, ctx.config.supabase_secret_key)

    sessions_resp = supabase.table("workout_sessions").select(
        "id, started_at, completed_at, notes, sheet_id, workout_sheets(name)"
    ).execute()
    sessions = {s["id"]: s for s in sessions_resp.data}

    exercises_resp = supabase.table("exercises").select("id, name").execute()
    exercises = {e["id"]: e["name"] for e in exercises_resp.data}

    notes_resp = supabase.table("session_exercise_notes").select(
        "session_id, exercise_id, notes"
    ).execute()
    exercise_notes = {
        f"{n['session_id']}:{n['exercise_id']}": n["notes"]
        for n in notes_resp.data
    }

    logs_resp = supabase.table("session_set_logs").select(
        "session_id, exercise_id, set_number, reps, weight_kg, completed_at"
    ).order("completed_at").execute()
    logs = logs_resp.data

    if not logs:
        return ImportResult(
            "silownia",
            skipped=1,
            error="Brak zalogowanych serii w Stravio — pominięto",
        )

    start_str = ctx.start_date.isoformat()
    end_str = ctx.end_date.isoformat()

    max_weight_by_exercise: dict[str, float] = {}
    rows_to_upsert: list[list] = []
    skipped_out_of_range = 0

    for log in logs:
        session = sessions.get(log["session_id"])
        if not session:
            continue

        session_date = datetime.fromisoformat(session["started_at"].replace("Z", "+00:00"))
        date_str = session_date.strftime("%Y-%m-%d")
        data_value = session_date.strftime("%Y-%m-%d %H:%M:%S")
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
        set_time = datetime.fromisoformat(log["completed_at"].replace("Z", "+00:00")).strftime("%H:%M")
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
    updated_count = 0
    appended_rows = []
    pending_updates: list[tuple[int, list]] = []

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

    print(
        f"  Gotowe: zaktualizowano {updated_count}, dopisano {len(appended_rows)} "
        f"(pominięto poza zakresem: {skipped_out_of_range})"
    )
    return ImportResult(
        "silownia",
        updated=updated_count,
        appended=len(appended_rows),
        skipped=skipped_out_of_range,
    )
