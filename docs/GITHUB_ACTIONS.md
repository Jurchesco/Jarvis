# Przygotowanie sekretów GitHub Actions

Skrypt pomocniczy — generuje wartości do wklejenia w **Settings → Secrets and variables → Actions** w repozytorium GitHub (zalecane: **private**).

## Uruchomienie (PowerShell)

```powershell
cd Scripts\import
.\scripts\prepare_github_secrets.ps1
```

Skrypt wyświetli listę sekretów i zapisze pliki tymczasowe w `%TEMP%\jarvis-github-secrets\` (usuń je po skopiowaniu).

## Wymagane sekrety

| Secret | Opis |
|--------|------|
| `GOOGLE_SHEET_ID` | ID arkusza Google Sheets |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | **Cała** zawartość pliku `google-service-account.json` |
| `SUPABASE_URL` | URL projektu Supabase (ten sam co Stravio) |
| `SUPABASE_SECRET_KEY` | Klucz `service_role` (nie `anon`!) |
| `OPENSCALE_DRIVE_FILE_ID` | ID pliku backupu openScale na Google Drive |
| `GARMINCONNECT_ZIP` | Base64 archiwum folderu `.garminconnect/` (wymagany dla modułów Garmin w chmurze) |

## Google Drive — openScale

1. W Google Drive znajdź plik `openScale.db_auto_backup.zip`.
2. Kliknij **Udostępnij** → dodaj email Service Account (`client_email` z JSON).
3. ID pliku z URL: `https://drive.google.com/file/d/`**TUTAJ**`/view`

## Włącz Google Drive API

W [Google Cloud Console](https://console.cloud.google.com) w tym samym projekcie co Service Account:
**APIs & Services → Enable APIs → Google Drive API**

Bez tego moduł `cialo` zwróci błąd API (403 / API not enabled).

## Po konfiguracji

1. Repo na GitHubie (zalecane **private**).
2. Wklej sekrety w Settings → Secrets → Actions.
3. **Actions → Jarvis Import → Run workflow** — test ręczny z `days: 7`.
4. Harmonogram: **co godzinę** (`cron: 0 * * * *` w workflow). Runy z harmonogramu importują **dzisiejszy dzień** (`DEFAULT_DAYS: 1`).

### Pełny import od początku

W **Run workflow** zaznacz checkbox **„Importuj wszystko od początku”** — ignoruje pole „dni” i pobiera dane od `IMPORT_START_DATE` (domyślnie `2026-07-09`, pierwszy wiersz w arkuszu *Dzien*).

Pełny import może trwać **kilka godzin** (Garmin: jedno zapytanie na dzień × moduł). Timeout joba: 360 min. Przy pierwszym pełnym imporcie rozważ `--skip silownia` jeśli Stravio jest puste.

Lokalnie: `run.bat --no-prompt --all`

### Dostosowanie częstotliwości

Edytuj `.github/workflows/jarvis-import.yml`:

| Cel | Cron (UTC) |
|-----|------------|
| Co godzinę (domyślnie) | `0 * * * *` |
| Co 6 godzin | `0 */6 * * *` |
| Raz dziennie o 06:00 UTC | `0 6 * * *` |
| Raz w tygodniu (niedziela 08:00 UTC) | `0 8 * * 0` |

Przy częstym harmonogramie trzymaj `DEFAULT_DAYS` nisko (1–2), żeby nie obciążać Garmin API. Ręczny run nadal może użyć `days: 7` lub więcej.

**Uwagi:**

- Na **prywatnym** repo harmonogram może się opóźniać o kilka–kilkanaście minut (limit GitHub).
- Publiczne repo: harmonogram zwykle punktualniejszy, minuty Actions bez limitu.
- Free tier prywatnego repo: ~2000 min/mies. — import co godzinę (~720 min) mieści się w limicie.

## Interpretacja wyniku workflow

Importer wypisuje podsumowanie:

| Etykieta | Znaczenie | Wpływ na job |
|----------|-----------|--------------|
| `[OK]` | Moduł zaimportował / zaktualizował dane | sukces |
| `[SKIP]` | Brak danych lub brak opcjonalnej konfiguracji (np. pusta `silownia`, brak openScale) | **sukces** |
| `[ERROR]` | Twardy błąd (credentials, API, wyjątek) | **fail** (exit code 1) |

Typowy pierwszy run bez treningów w Stravio:

```
[OK] sen: ...
[OK] dzien: ...
[SKIP] silownia: Brak zalogowanych serii w Stravio — pominięto
Gotowe: 5/6 modułów zakończonych poprawnie.
```

Job powinien być **zielony**.

## Prywatność

- Repo **private** — workflow i kod importu nie są publiczne.
- Sekrety nie trafiają do kodu ani logów (GitHub je maskuje).
- Job działa na serwerze GitHub — jeśli chcesz uniknąć tego całkowicie, użyj self-hosted runnera lub harmonogramu Windows (`run.bat --no-prompt`).
