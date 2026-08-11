# Przygotowanie sekretów GitHub Actions

Skrypt pomocniczy — generuje wartości do wklejenia w **Settings → Secrets and variables → Actions** w **prywatnym** repozytorium GitHub.

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
| `SUPABASE_URL` | URL projektu Supabase |
| `SUPABASE_SECRET_KEY` | Klucz `service_role` |
| `OPENSCALE_DRIVE_FILE_ID` | ID pliku backupu openScale na Google Drive |
| `GARMINCONNECT_ZIP` | (opcjonalnie) Base64 archiwum `.garminconnect/` |

## Google Drive — openScale

1. W Google Drive znajdź plik `openScale.db_auto_backup.zip`.
2. Kliknij **Udostępnij** → dodaj email Service Account (`client_email` z JSON).
3. ID pliku z URL: `https://drive.google.com/file/d/`**TUTAJ**`/view`

## Włącz Google Drive API

W [Google Cloud Console](https://console.cloud.google.com) w tym samym projektu co Service Account:
**APIs & Services → Enable APIs → Google Drive API**

## Po konfiguracji

1. **Private** repo na GitHubie.
2. Wklej sekrety w Settings → Secrets → Actions.
3. **Actions → Jarvis Import → Run workflow** (test ręczny).
4. Harmonogram: niedziela 09:00 CET (cron w workflow).

## Prywatność

- Repo musi być **private**.
- Sekrety nie trafiają do kodu ani publicznych logów (GitHub je maskuje).
- Job działa na serwerze GitHub — jeśli chcesz uniknąć tego całkowicie, użyj self-hosted runnera (patrz główna dokumentacja).
