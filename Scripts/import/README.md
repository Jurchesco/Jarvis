# Jarvis Import

Jeden folder, wszystkie importery: Garmin, openScale, JJ Workout Tool → **Supabase (źródło prawdy)** + Google Sheets (mirror).

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

### Supabase (waga + Garmin)

Po migracji `supabase/body_and_health.sql` ustaw:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (service_role)
- `JJ_WORKOUT_USER_ID` — UUID właściciela z `auth.users`

Bez `JJ_WORKOUT_USER_ID` importer nadal pisze do Sheets, a upsert do bazy jest pomijany.

## Moduły

| Moduł | Źródło | Sheets | Supabase |
|-------|--------|--------|----------|
| sen | Garmin | Sen | `garmin_sleep_days` |
| dzien | Garmin | Dzien | `garmin_daily_stats` |
| forma | Garmin | Forma | `garmin_forma_days` |
| aktywnosci | Garmin | Aktywnosci | `garmin_activities` |
| cialo | openScale backup | Cialo | `body_measurements` |
| silownia | JJ Workout Tool | Silownia_import | (odczyt z bazy) |

`cialo` bierze **najnowszy** zip z folderu: `openScale.db_auto_backup.zip` albo `openscale_backup_<timestamp>.zip`. Importuje pomiary od `IMPORT_START_DATE`.

Na CI udostępnij folder `Jarvis/openScale` na `garmin-importer@veo-experiments-463809.iam.gserviceaccount.com`.

## Flagi

| Flaga | Opis |
|-------|------|
| *(brak)* | Interaktywny prompt — wpisz liczbę dni |
| `--days N` | Pomiń prompt, importuj N dni |
| `--all` | Import od `IMPORT_START_DATE` do dziś |
| `--no-prompt` | Bez promptu, użyj `DEFAULT_DAYS` z `.env` |
| `--only a,b` | Tylko wybrane moduły |
| `--skip a,b` | Pomiń moduły |
| `--sort-only` | Posortuj zakładki po dacie (bez importu) |

Hermes / eksport AI: `docs/jarvis/HERMES_SUPABASE.md`.
