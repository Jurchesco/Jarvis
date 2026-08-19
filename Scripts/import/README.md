# Jarvis Import

Jeden folder, wszystkie importery: Garmin, openScale, JJ Workout Tool → Google Sheets.

## Uruchomienie

```bash
cd Scripts/import
run.bat
```

Przy starcie skrypt **zapyta z klawiatury**, ile dni wstecz importować (Enter = domyślnie 7).

Alternatywnie z linii poleceń:

```bash
run.bat --days 14
run.bat --days 30 --only sen,dzien,forma,aktywnosci
run.bat --no-prompt --days 7          # bez pytania (harmonogram zadań)
```

Skrót z katalogu `Scripts/`:

```bash
Scripts\run.bat
```

## Pierwsza konfiguracja

```bash
cd Scripts/import
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Edytuj `.env` — minimum `GOOGLE_SHEET_ID`. Reszta opcjonalna.

### Pliki credentials (w tym samym folderze)

| Plik | Opis |
|------|------|
| `google-service-account.json` | Klucz Google Service Account |
| `.garminconnect/` | Tokeny Garmin (tworzone przy pierwszym logowaniu) |
| `.env` | Konfiguracja (Supabase, openScale backup / Drive) |

## Moduły

| Moduł | Źródło | Zakładka |
|-------|--------|----------|
| sen | Garmin | Sen |
| dzien | Garmin | Dzien |
| forma | Garmin | Forma |
| aktywnosci | Garmin | Aktywnosci |
| cialo | openScale backup | Cialo |
| silownia | JJ Workout Tool | Silownia_import |

`cialo` importuje **auto-backup** `openScale.db_auto_backup.zip` (nie ręczny `openscale_backup_<timestamp>.zip`). Wszystkie pomiary od `IMPORT_START_DATE`. Harmonogram co godzinę (`DEFAULT_DAYS=1`) nie gubi wczorajszych ważeń, gdy auto-backup spóźni się o dzień.

Na CI plik musi być udostępniony Service Accountowi `garmin-importer@veo-experiments-463809.iam.gserviceaccount.com`. Udostępnij **folder** `Jarvis/openScale` oraz sam `openScale.db_auto_backup.zip`.

## Flagi

| Flaga | Opis |
|-------|------|
| *(brak)* | Interaktywny prompt — wpisz liczbę dni |
| `--days N` | Pomiń prompt, importuj N dni |
| `--all` | Import od `IMPORT_START_DATE` do dziś (ignoruje `--days`) |
| `--no-prompt` | Bez promptu, użyj `DEFAULT_DAYS` z `.env` |
| `--only a,b` | Tylko wybrane moduły |
| `--skip a,b` | Pomiń moduły |
| `--sort-only` | Posortuj zakładki po dacie (bez importu) |

## Kody wyjścia i podsumowanie

Po imporcie skrypt wypisuje status każdego modułu:

| Etykieta | Znaczenie |
|----------|-----------|
| `[OK]` | Dane zaimportowane |
| `[SKIP]` | Moduł pominięty — brak danych lub brak opcjonalnej konfiguracji (exit code nadal `0`) |
| `[ERROR]` | Twardy błąd — exit code `1` |

Przykłady miękkiego pominięcia: brak serii w JJ Workout Tool, brak `SUPABASE_*`, brak backupu openScale, brak serii w wybranym zakresie `--days`.

## Struktura folderu

```
import/
├── run.bat                  ← uruchom to
├── .env                     ← konfiguracja
├── google-service-account.json
├── .garminconnect/
├── jarvis_import/           ← kod Pythona
│   └── importers/
├── requirements.txt
└── venv/
```

## Harmonogram zadań Windows

```
C:\Jarvis\Scripts\import\run.bat --no-prompt --days 7
```
