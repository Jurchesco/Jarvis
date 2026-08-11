from __future__ import annotations

import sqlite3
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path

from ..openscale_source import resolve_openscale_backup
from ..sheets import ImportResult, get_existing_rows_by_key
from . import ImportContext

WORKSHEET_NAME = "Cialo"
SOURCE_NAME = "openScale"

SHEET_HEADERS = [
    "Data",
    "Godzina",
    "DataCzas",
    "Waga (kg)",
    "BMI",
    "% tkanki tłuszczowej est.",
    "Masa mięśniowa est.",
    "LBM est.",
    "Masa kostna est.",
    "% wody est.",
    "Tłuszcz wisceralny est.",
    "BMR est.",
    "Białko % est.",
    "Impedancja",
    "Komentarz",
    "Źródło",
]

# Mapowanie kluczy openScale (MeasurementType.key) → indeks kolumny arkusza (informacyjnie)
# WEIGHT=3, BMI=4, BODY_FAT=5, MUSCLE=6, LBM=7, BONE=8, WATER=9,
# VISCERAL_FAT=10, BMR=11, PROTEIN=12, IMPEDANCE=13, COMMENT=14


def value_or_blank(value):
    return "" if value is None else value


def number_or_blank(value):
    if value is None:
        return ""
    try:
        num = float(value)
        return round(num, 2)
    except (TypeError, ValueError):
        return value


def extract_db_path(backup_path: Path) -> Path:
    """Rozpakowuje openScale.db z zip backupu do pliku tymczasowego."""
    suffix = backup_path.suffix.lower()
    if suffix == ".zip":
        tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        tmp.close()
        db_path = Path(tmp.name)
        with zipfile.ZipFile(backup_path) as archive:
            names = archive.namelist()
            db_name = "openScale.db" if "openScale.db" in names else None
            if db_name is None:
                db_candidates = [n for n in names if n.endswith(".db") and "/" not in n and "\\" not in n]
                if not db_candidates:
                    raise RuntimeError(f"Brak pliku .db w archiwum: {backup_path}")
                db_name = db_candidates[0]
            with archive.open(db_name) as src, db_path.open("wb") as dst:
                dst.write(src.read())
        return db_path

    if suffix == ".db":
        return backup_path

    raise RuntimeError(f"Nieobsługiwany format backupu openScale: {backup_path}")


def read_measurements_from_db(db_path: Path) -> list[list]:
    local_tz = datetime.now().astimezone().tzinfo

    query = """
        SELECT
            m.id,
            m.timestamp,
            MAX(CASE WHEN mt.key = 'WEIGHT' THEN mv.floatValue END) AS weight,
            MAX(CASE WHEN mt.key = 'BMI' THEN mv.floatValue END) AS bmi,
            MAX(CASE WHEN mt.key = 'BODY_FAT' THEN mv.floatValue END) AS body_fat,
            MAX(CASE WHEN mt.key = 'MUSCLE' THEN mv.floatValue END) AS muscle,
            MAX(CASE WHEN mt.key = 'LBM' THEN mv.floatValue END) AS lbm,
            MAX(CASE WHEN mt.key = 'BONE' THEN mv.floatValue END) AS bone,
            MAX(CASE WHEN mt.key = 'WATER' THEN mv.floatValue END) AS water,
            MAX(CASE WHEN mt.key = 'VISCERAL_FAT' THEN mv.floatValue END) AS visceral_fat,
            MAX(CASE WHEN mt.key = 'BMR' THEN mv.floatValue END) AS bmr,
            MAX(CASE WHEN mt.key = 'PROTEIN' THEN mv.floatValue END) AS protein,
            MAX(CASE WHEN mt.key = 'IMPEDANCE' THEN mv.floatValue END) AS impedance,
            MAX(CASE WHEN mt.key = 'COMMENT' THEN mv.textValue END) AS comment
        FROM Measurement m
        LEFT JOIN MeasurementValue mv ON mv.measurementId = m.id
        LEFT JOIN MeasurementType mt ON mt.id = mv.typeId
        GROUP BY m.id, m.timestamp
        HAVING weight IS NOT NULL
        ORDER BY m.timestamp
    """

    con = sqlite3.connect(db_path)
    try:
        cur = con.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='Measurement'")
        if cur.fetchone() is None:
            raise RuntimeError("Plik backupu nie zawiera tabeli Measurement (niepoprawny backup openScale)")

        rows: list[list] = []
        for (
            _mid,
            timestamp_ms,
            weight,
            bmi,
            body_fat,
            muscle,
            lbm,
            bone,
            water,
            visceral_fat,
            bmr,
            protein,
            impedance,
            comment,
        ) in cur.execute(query):
            dt = datetime.fromtimestamp(timestamp_ms / 1000, tz=local_tz)
            rows.append([
                dt.strftime("%Y-%m-%d"),
                dt.strftime("%H:%M:%S"),
                dt.strftime("%Y-%m-%d %H:%M:%S"),
                number_or_blank(weight),
                number_or_blank(bmi),
                number_or_blank(body_fat),
                number_or_blank(muscle),
                number_or_blank(lbm),
                number_or_blank(bone),
                number_or_blank(water),
                number_or_blank(visceral_fat),
                number_or_blank(bmr),
                number_or_blank(protein),
                number_or_blank(impedance),
                value_or_blank(comment).strip(),
                SOURCE_NAME,
            ])
        return rows
    finally:
        con.close()


def read_openscale_rows(source: Path) -> list[list]:
    extracted = source.suffix.lower() == ".zip"
    db_path = extract_db_path(source)
    try:
        return read_measurements_from_db(db_path)
    finally:
        if extracted and db_path.exists():
            db_path.unlink(missing_ok=True)


def make_key(datetime_value, weight, source):
    try:
        normalized_weight = f"{float(str(weight).replace(',', '.')):.4f}"
    except (TypeError, ValueError):
        normalized_weight = str(weight).strip()
    return (str(datetime_value).strip(), normalized_weight, str(source).strip().lower())


def get_existing_rows_map(worksheet):
    values = worksheet.get_all_values()
    if not values:
        raise RuntimeError(f"Zakładka '{WORKSHEET_NAME}' jest pusta.")
    actual_headers = values[0][: len(SHEET_HEADERS)]
    if actual_headers != SHEET_HEADERS:
        raise RuntimeError(
            f"Nagłówki w '{WORKSHEET_NAME}' nie są zgodne.\n"
            f"Oczekiwane: {SHEET_HEADERS}\nZnalezione: {actual_headers}"
        )
    rows_map = {}
    for row_number, row in enumerate(values[1:], start=2):
        datetime_value = row[2].strip() if len(row) > 2 else ""
        weight = row[3].strip() if len(row) > 3 else ""
        source = row[15].strip() if len(row) > 15 else ""
        if not datetime_value or not weight or not source:
            continue
        rows_map[make_key(datetime_value, weight, source)] = row_number
    return rows_map


def import_openscale(ctx: ImportContext) -> ImportResult:
    backup_path = resolve_openscale_backup(ctx.config)
    if backup_path is None:
        return ImportResult("cialo", skipped=1, error="Brak OPENSCALE_BACKUP / OPENSCALE_DRIVE_FILE_ID — pominięto")
    if not backup_path.exists():
        return ImportResult("cialo", error=f"Nie znaleziono backupu: {backup_path}")

    print(f"\n[CIALO] Zakres: {ctx.start_date} – {ctx.end_date}")
    print(f"  Backup: {backup_path}")

    all_rows = read_openscale_rows(backup_path)
    filtered_rows = [
        row for row in all_rows
        if ctx.start_date.isoformat() <= row[0] <= ctx.end_date.isoformat()
    ]
    print(f"  Odczytano {len(all_rows)} pomiarów, w zakresie: {len(filtered_rows)}")

    worksheet = ctx.sheets.worksheet(WORKSHEET_NAME)
    existing_rows = get_existing_rows_map(worksheet)

    updated_count = 0
    appended_rows = []
    skipped_count = 0
    seen_keys = set()

    for row in filtered_rows:
        key = make_key(row[2], row[3], row[15])
        if key in seen_keys:
            skipped_count += 1
            continue
        seen_keys.add(key)

        if key in existing_rows:
            row_number = existing_rows[key]
            worksheet.update(
                range_name=f"A{row_number}:P{row_number}",
                values=[row],
                value_input_option="USER_ENTERED",
            )
            updated_count += 1
        else:
            appended_rows.append(row)

    if appended_rows:
        worksheet.append_rows(appended_rows, value_input_option="USER_ENTERED")

    print(f"  Gotowe: zaktualizowano {updated_count}, dopisano {len(appended_rows)}")
    return ImportResult(
        "cialo",
        updated=updated_count,
        appended=len(appended_rows),
        skipped=skipped_count,
    )
