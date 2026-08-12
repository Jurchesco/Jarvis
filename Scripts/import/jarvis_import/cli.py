from __future__ import annotations

import argparse
import sys
from datetime import datetime

from .config import date_range, date_range_from_start, load_config
from .garmin import GarminClient
from .last_import import get_last_import_label, save_last_import
from .importers import ImportContext
from .importers.activities import import_activities
from .importers.daily import import_daily
from .importers.forma import import_forma
from .importers.openscale import import_openscale
from .importers.sleep import import_sleep
from .importers.workout import import_workout
from .sheets import ImportResult, SheetsClient
from .sort_sheets import WORKSHEET_SORT, sort_all_worksheets

ALL_IMPORTERS = ("sen", "dzien", "forma", "aktywnosci", "cialo", "silownia")

GARMIN_IMPORTERS = {
    "sen": import_sleep,
    "dzien": import_daily,
    "forma": import_forma,
    "aktywnosci": import_activities,
}


def parse_list(value: str) -> set[str]:
    return {item.strip().lower() for item in value.split(",") if item.strip()}


def prompt_days(default: int) -> int:
    print()
    print(f"Ostatni import: {get_last_import_label()}")
    print()
    print("Moduły: sen, dzien, forma, aktywnosci, cialo, silownia")
    print(f"Domyślnie: ostatnie {default} dni (Enter = domyślnie)")
    print()

    while True:
        raw = input(f"Ile dni wstecz importować? [{default}]: ").strip()
        if not raw:
            return default
        try:
            days = int(raw)
            if days >= 1:
                return days
        except ValueError:
            pass
        print("Podaj liczbę całkowitą większą od zera.")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Jarvis — ujednolicony importer danych do Google Sheets",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=None,
        help="Ile dni wstecz importować (pomija pytanie interaktywne)",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Importuj od IMPORT_START_DATE (domyślnie 2026-07-09) do dziś — ignoruje --days",
    )
    parser.add_argument(
        "--no-prompt",
        action="store_true",
        help="Bez pytania — użyj DEFAULT_DAYS z .env (dla harmonogramu zadań)",
    )
    parser.add_argument(
        "--only",
        type=str,
        default=None,
        help=f"Importuj tylko wybrane moduły (dostępne: {', '.join(ALL_IMPORTERS)})",
    )
    parser.add_argument(
        "--skip",
        type=str,
        default=None,
        help="Pomiń wybrane moduły, np. silownia,cialo",
    )
    parser.add_argument(
        "--sort-only",
        action="store_true",
        help="Tylko posortuj zakładki po dacie (bez importu). Użyj z --only, aby wybrać moduły.",
    )
    return parser


SORT_MODULE_TO_SHEET = {
    "sen": "Sen",
    "dzien": "Dzien",
    "forma": "Forma",
    "aktywnosci": "Aktywnosci",
    "cialo": "Cialo",
    "silownia": "Silownia_import",
}


def run_sort_only(sheets: SheetsClient, only: str | None) -> int:
    selected = set(WORKSHEET_SORT) if not only else {SORT_MODULE_TO_SHEET[n] for n in parse_list(only) if n in SORT_MODULE_TO_SHEET}
    unknown = parse_list(only) - set(SORT_MODULE_TO_SHEET) if only else set()
    if unknown:
        print(f"Błąd: nieznane moduły do sortowania: {', '.join(sorted(unknown))}")
        return 1

    spreadsheet = sheets._gc.open_by_key(sheets._spreadsheet_id)
    print("=" * 70)
    print("JARVIS — SORTOWANIE ARKUSZY")
    print("=" * 70)
    results = sort_all_worksheets(spreadsheet, only=selected or None)
    for name, count in results.items():
        print(f"[OK] {name}: posortowano {count} wierszy")
    print(f"\nGotowe: {len(results)} zakładek.")
    return 0


def resolve_importers(only: str | None, skip: str | None) -> list[str]:
    if only:
        selected = parse_list(only)
    else:
        selected = set(ALL_IMPORTERS)

    if skip:
        selected -= parse_list(skip)

    unknown = selected - set(ALL_IMPORTERS)
    if unknown:
        raise ValueError(f"Nieznane moduły: {', '.join(sorted(unknown))}")

    return [name for name in ALL_IMPORTERS if name in selected]


def resolve_days(args: argparse.Namespace, default_days: int) -> int:
    if args.days is not None:
        return args.days
    if args.no_prompt:
        return default_days
    return prompt_days(default_days)


def run() -> int:
    parser = build_parser()
    args = parser.parse_args()

    try:
        config = load_config()
    except KeyError as error:
        print(f"Błąd konfiguracji: brak zmiennej {error}")
        return 1

    try:
        sheets = SheetsClient(config.spreadsheet_id, config.google_credentials_file)
    except FileNotFoundError as error:
        print(f"Błąd: {error}")
        return 1

    if args.sort_only:
        return run_sort_only(sheets, args.only)

    days = resolve_days(args, config.default_days)
    if args.all:
        start_date, end_date = date_range_from_start(config.import_start_date)
        days = (end_date - start_date).days + 1
    else:
        if days < 1:
            print("Błąd: liczba dni musi być >= 1")
            return 1
        start_date, end_date = date_range(days)

    try:
        importers = resolve_importers(args.only, args.skip)
    except ValueError as error:
        print(f"Błąd: {error}")
        return 1

    if not importers:
        print("Błąd: nie wybrano żadnego modułu do importu")
        return 1

    print("=" * 70)
    print("JARVIS IMPORT")
    print(f"Start: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    if args.all:
        print(f"Tryb: pełny import od {config.import_start_date}")
    print(f"Zakres: {start_date} – {end_date} ({days} dni)")
    print(f"Moduły: {', '.join(importers)}")
    print("=" * 70)

    ctx = ImportContext(
        config=config,
        sheets=sheets,
        days=days,
        start_date=start_date,
        end_date=end_date,
    )

    garmin: GarminClient | None = None
    if any(name in GARMIN_IMPORTERS for name in importers):
        garmin = GarminClient(config)

    results: list[ImportResult] = []

    for name in importers:
        try:
            if name in GARMIN_IMPORTERS:
                assert garmin is not None
                result = GARMIN_IMPORTERS[name](ctx, garmin)
            elif name == "cialo":
                result = import_openscale(ctx)
            elif name == "silownia":
                result = import_workout(ctx)
            else:
                continue
            results.append(result)
        except Exception as error:
            print(f"\n[{name.upper()}] KRYTYCZNY BŁĄD: {type(error).__name__}: {error}")
            results.append(ImportResult(name, error=str(error)))

    print("\n" + "=" * 70)
    print("PODSUMOWANIE")
    print("=" * 70)

    failed = [r for r in results if not r.ok]
    for result in results:
        if result.ok:
            print(
                f"[OK] {result.name}: "
                f"zaktualizowano {result.updated}, dopisano {result.appended}"
                + (f", pominięto {result.skipped}" if result.skipped else "")
            )
        elif result.skipped:
            print(f"[SKIP] {result.name}: {result.error}")
        else:
            print(f"[ERROR] {result.name}: {result.error}")

    if failed:
        hard_failures = [r for r in failed if r.skipped == 0 or "KRYTYCZNY" in (r.error or "")]
        if hard_failures:
            print(f"\nZakończono z błędami: {len(hard_failures)} moduł(ów).")
            return 1

    print(f"\nGotowe: {len(results) - len(failed)}/{len(results)} modułów zakończonych poprawnie.")
    save_last_import()
    return 0


if __name__ == "__main__":
    sys.exit(run())
