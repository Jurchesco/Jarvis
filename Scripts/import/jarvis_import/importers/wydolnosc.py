"""Import metryk wydolnościowych/treningowych z zegarka Garmin do zakładki `Wydolnosc`.

Zbiera dane, których nie ma w zakładkach Dzien/Forma/Sen/Aktywnosci:
- VO2max (bieg / kolarstwo) i wiek sprawnościowy,
- Status treningowy oraz obciążenie (ostre/przewlekłe, ACWR, balans tlenowy/beztlenowy),
- Gotowość treningowa (Training Readiness), czas regeneracji, tygodniowa HRV,
- Wynik wytrzymałości (Endurance) i podbiegów (Hill),
- Aklimatyzacja wysokościowa/cieplna,
- Predykcje czasów (5K / 10K / półmaraton / maraton).

Wszystkie endpointy Garmina są opcjonalne dla danego profilu (np. brak biegania →
brak predykcji), dlatego każdy jest pobierany odpornie: błąd jednego nie kasuje
pozostałych metryk dla danego dnia.
"""

from __future__ import annotations

from datetime import datetime

from ..dates import IMPORT_TIMESTAMP_HEADER, date_key, format_day_with_time, now_in_tz
from ..garmin import GarminClient, iter_days
from ..sheets import ImportResult, batch_update_rows, get_existing_rows_by_key
from ..sort_sheets import sort_worksheet_by_name
from . import ImportContext

WORKSHEET_NAME = "Wydolnosc"

HEADERS = [
    IMPORT_TIMESTAMP_HEADER,        # 0
    "VO2max (bieg)",                # 1
    "VO2max (kolarstwo)",           # 2
    "Wiek sprawnościowy",           # 3
    "Status treningowy",            # 4
    "Feedback statusu",             # 5
    "Obciążenie 7-dniowe",          # 6
    "Load tunnel min",              # 7
    "Load tunnel max",              # 8
    "Obciążenie ostre",             # 9
    "Obciążenie przewlekłe",        # 10
    "ACWR",                         # 11
    "ACWR status",                  # 12
    "Obc. mies. tlenowe niskie",    # 13
    "Obc. mies. tlenowe wysokie",   # 14
    "Obc. mies. beztlenowe",        # 15
    "Balans obciążenia",            # 16
    "Gotowość treningowa",          # 17
    "Poziom gotowości",             # 18
    "Feedback gotowości",           # 19
    "Czas regeneracji [h]",         # 20
    "HRV śr. tygodniowa",           # 21
    "Wynik wytrzymałości",          # 22
    "Wynik podbiegów",              # 23
    "Aklimatyzacja wysok. [%]",     # 24
    "Aklimatyzacja cieplna [%]",    # 25
    "Predykcja 5K",                 # 26
    "Predykcja 10K",                # 27
    "Predykcja półmaraton",         # 28
    "Predykcja maraton",            # 29
    "Notatka",                      # 30
]

NOTE_COLUMN = len(HEADERS) - 1  # 30
LAST_COLUMN = "AE"  # 31. kolumna


TRAINING_STATUS_PL = {
    "NO_STATUS": "Brak statusu",
    "DETRAINING": "Roztrenowanie",
    "RECOVERY": "Regeneracja",
    "MAINTAINING": "Utrzymanie",
    "PRODUCTIVE": "Produktywny",
    "PEAKING": "Szczyt formy",
    "OVERREACHING": "Przeciążenie",
    "UNPRODUCTIVE": "Nieproduktywny",
    "STRAINED": "Nadmierny wysiłek",
}


def value_or_blank(value):
    return "" if value is None else value


def round_or_blank(value, digits=1):
    if value is None or value == "":
        return ""
    try:
        return round(float(value), digits)
    except (TypeError, ValueError):
        return ""


def int_or_blank(value):
    if value is None or value == "":
        return ""
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return ""


def format_seconds(seconds):
    """Sekundy → 'M:SS' (poniżej godziny) lub 'H:MM:SS'."""
    if seconds is None or seconds == "":
        return ""
    try:
        total = int(round(float(seconds)))
    except (TypeError, ValueError):
        return ""
    if total <= 0:
        return ""
    hours = total // 3600
    minutes = (total % 3600) // 60
    secs = total % 60
    if hours:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


def status_phrase_to_pl(phrase):
    if not phrase:
        return ""
    key = str(phrase).rsplit("_", 1)[0] if str(phrase)[-1:].isdigit() else str(phrase)
    return TRAINING_STATUS_PL.get(key, phrase)


def first_dict(value):
    """Bezpiecznie zwróć słownik z odpowiedzi list-lub-dict (pierwszy element listy)."""
    if isinstance(value, dict):
        return value
    if isinstance(value, list) and value and isinstance(value[0], dict):
        return value[0]
    return {}


def first_device_value(mapping):
    """Mapy Garmina są kluczowane deviceId — wybierz urządzenie główne lub pierwsze."""
    if not isinstance(mapping, dict):
        return {}
    dict_values = [v for v in mapping.values() if isinstance(v, dict)]
    for value in dict_values:
        if value.get("primaryTrainingDevice"):
            return value
    return dict_values[0] if dict_values else {}


def build_row(
    day,
    *,
    max_metrics=None,
    training_status=None,
    training_readiness=None,
    endurance=None,
    hill=None,
    race=None,
    fitnessage=None,
    existing_note="",
    imported_at: datetime | None = None,
    tz=None,
):
    # --- VO2max + wiek sprawnościowy (get_max_metrics → lista) ---
    mm = first_dict(max_metrics)
    mm_generic = mm.get("generic") or {}
    mm_cycling = mm.get("cycling") or {}
    heat = mm.get("heatAltitudeAcclimation") or {}
    vo2_run = mm_generic.get("vo2MaxPreciseValue") or mm_generic.get("vo2MaxValue")
    vo2_cyc = mm_cycling.get("vo2MaxPreciseValue") or mm_cycling.get("vo2MaxValue")

    # --- Status treningowy + obciążenie (get_training_status) ---
    status = training_status if isinstance(training_status, dict) else {}
    ts = status.get("mostRecentTrainingStatus") or {}
    ts_dev = first_device_value(ts.get("latestTrainingStatusData") or {})
    acute = ts_dev.get("acuteTrainingLoadDTO") or {}
    balance = status.get("mostRecentTrainingLoadBalance") or {}
    bal_dev = first_device_value(balance.get("metricsTrainingLoadBalanceDTOMap") or {})
    status_feedback = ts_dev.get("trainingStatusFeedbackPhrase")

    # VO2max z training_status jako zapas, jeśli max_metrics puste
    if vo2_run is None:
        status_vo2 = (status.get("mostRecentVO2Max") or {}).get("generic") or {}
        vo2_run = status_vo2.get("vo2MaxPreciseValue") or status_vo2.get("vo2MaxValue")

    # --- Wiek sprawnościowy (get_fitnessage_data → biologicalAge) ---
    fa = fitnessage if isinstance(fitnessage, dict) else {}
    fitness_age = fa.get("biologicalAge")
    if fitness_age is None:
        fitness_age = mm_generic.get("fitnessAge")

    # --- Gotowość treningowa (get_training_readiness → lista) ---
    tr = first_dict(training_readiness)
    recovery_minutes = tr.get("recoveryTime")
    recovery_hours = round(recovery_minutes / 60, 1) if isinstance(recovery_minutes, (int, float)) else ""

    # --- Wytrzymałość / podbiegi ---
    es = endurance if isinstance(endurance, dict) else {}
    endurance_score = es.get("overallScore")
    if endurance_score is None:
        endurance_score = (es.get("enduranceScoreDTO") or {}).get("overallScore")

    hs = hill if isinstance(hill, dict) else {}
    hill_score = hs.get("overallScore")
    if hill_score is None:
        hill_list = hs.get("hillScoreDTOList") or []
        if hill_list and isinstance(hill_list[-1], dict):
            hill_score = hill_list[-1].get("overallScore")

    # --- Predykcje czasów (get_race_predictions) ---
    rp = first_dict(race) if isinstance(race, list) else (race if isinstance(race, dict) else {})

    return [
        format_day_with_time(day, imported_at, tz=tz),
        round_or_blank(vo2_run, 1),
        round_or_blank(vo2_cyc, 1),
        round_or_blank(fitness_age, 1),
        status_phrase_to_pl(status_feedback),
        value_or_blank(status_feedback),
        int_or_blank(ts_dev.get("weeklyTrainingLoad")),
        int_or_blank(ts_dev.get("loadTunnelMin")),
        int_or_blank(ts_dev.get("loadTunnelMax")),
        int_or_blank(acute.get("dailyTrainingLoadAcute")),
        int_or_blank(acute.get("dailyTrainingLoadChronic")),
        round_or_blank(acute.get("dailyAcuteChronicWorkloadRatio"), 2),
        value_or_blank(acute.get("acwrStatus")),
        int_or_blank(bal_dev.get("monthlyLoadAerobicLow")),
        int_or_blank(bal_dev.get("monthlyLoadAerobicHigh")),
        int_or_blank(bal_dev.get("monthlyLoadAnaerobic")),
        value_or_blank(bal_dev.get("trainingBalanceFeedbackPhrase")),
        int_or_blank(tr.get("score")),
        value_or_blank(tr.get("level")),
        value_or_blank(tr.get("feedbackShort")),
        recovery_hours,
        int_or_blank(tr.get("hrvWeeklyAverage")),
        int_or_blank(endurance_score),
        int_or_blank(hill_score),
        int_or_blank(heat.get("acclimationPercentage")),
        int_or_blank(heat.get("heatAcclimationPercentage")),
        format_seconds(rp.get("time5K")),
        format_seconds(rp.get("time10K")),
        format_seconds(rp.get("timeHalfMarathon")),
        format_seconds(rp.get("timeMarathon")),
        existing_note,
    ]


def _safe(label, fn, *args, default=None):
    """Wywołaj endpoint Garmina, zwracając `default` przy błędzie (bez przerywania dnia)."""
    try:
        return fn(*args)
    except Exception as error:  # noqa: BLE001 - świadomie łykamy, log wystarczy
        print(f"    [{label}] pominięto: {type(error).__name__}: {error}")
        return default


def import_wydolnosc(ctx: ImportContext, garmin: GarminClient) -> ImportResult:
    print(f"\n[WYDOLNOSC] Zakres: {ctx.start_date} – {ctx.end_date}")
    worksheet = ctx.sheets.get_or_create_worksheet(WORKSHEET_NAME, HEADERS)
    existing_rows = get_existing_rows_by_key(worksheet, note_column=NOTE_COLUMN, key_normalizer=date_key)
    api = garmin.api
    tz = ctx.config.timezone

    appended_rows = []
    pending_updates: list[tuple[int, list]] = []

    for day, _ in iter_days(ctx.start_date, ctx.end_date):
        print(f"  Pobieram {day}...")
        existing = existing_rows.get(day, {})
        existing_note = existing.get("note", "")

        max_metrics = _safe("max_metrics", api.get_max_metrics, day)
        training_status = _safe("training_status", api.get_training_status, day)
        training_readiness = _safe("training_readiness", api.get_training_readiness, day)
        endurance = _safe("endurance", api.get_endurance_score, day)
        hill = _safe("hill", api.get_hill_score, day)
        race = _safe("race", api.get_race_predictions, day, day, "daily")
        fitnessage = _safe("fitnessage", api.get_fitnessage_data, day)

        row_values = build_row(
            day,
            max_metrics=max_metrics,
            training_status=training_status,
            training_readiness=training_readiness,
            endurance=endurance,
            hill=hill,
            race=race,
            fitnessage=fitnessage,
            existing_note=existing_note,
            imported_at=now_in_tz(tz),
            tz=tz,
        )

        if day in existing_rows:
            pending_updates.append((existing_rows[day]["row_number"], row_values))
        else:
            appended_rows.append(row_values)

        garmin.pause()

    batch_update_rows(worksheet, pending_updates, LAST_COLUMN)
    updated_count = len(pending_updates)

    if appended_rows:
        worksheet.append_rows(appended_rows, value_input_option="USER_ENTERED")

    sorted_rows = sort_worksheet_by_name(worksheet, WORKSHEET_NAME)
    print(f"  Gotowe: zaktualizowano {updated_count}, dopisano {len(appended_rows)}, posortowano {sorted_rows} wierszy")
    return ImportResult("wydolnosc", updated=updated_count, appended=len(appended_rows))
