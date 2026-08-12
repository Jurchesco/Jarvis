# Edge Function: `sync-sheets`

Ręczna synchronizacja treningów JJ Workout Tool → **Twój** arkusz Google (`Silownia_import`).

> **Faza testów osobistych:** jeden `GOOGLE_SHEET_ID` + opcjonalnie `JJ_WORKOUT_ALLOWED_USER_ID` w sekretach Supabase. Bez wyboru pliku w UI.

## Sekrety (Supabase Dashboard → Project Settings → Edge Functions → Secrets)

| Sekret | Opis |
|--------|------|
| `GOOGLE_SHEET_ID` | ID Twojego arkusza (ten sam co w `Scripts/import/.env`) |
| `GOOGLE_SERVICE_ACCOUNT_JSON_B64` | **Zalecane:** cały `google-service-account.json` zakodowany Base64 ( robi `deploy.ps1` ) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | *(legacy)* surowy JSON — na Windows często się psuje; użyj B64 |
| `JJ_WORKOUT_ALLOWED_USER_ID` | *(opcjonalnie)* UUID Twojego konta z Supabase Auth — blokuje sync dla innych użytkowników |
| `SYNC_DEFAULT_DAYS` | *(opcjonalnie)* domyślnie `30` — ile dni wstecz importować |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` są ustawiane automatycznie przez Supabase.

## Deploy

```bash
# Zainstaluj CLI: https://supabase.com/docs/guides/cli
supabase login
supabase link --project-ref TWOJ_PROJECT_REF

supabase secrets set GOOGLE_SHEET_ID="..."
# Windows — użyj deploy.ps1 (Base64). Ręcznie tylko naprawa sekretu:
# powershell -File supabase/functions/sync-sheets/set-google-secret.ps1
supabase secrets set JJ_WORKOUT_ALLOWED_USER_ID="twoj-uuid-z-auth"

supabase functions deploy sync-sheets
```

## Test lokalny (opcjonalnie)

```bash
supabase functions serve sync-sheets --env-file supabase/.env.local
```

Plik `supabase/.env.local` (nie commituj):

```
GOOGLE_SHEET_ID=...
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
JJ_WORKOUT_ALLOWED_USER_ID=...
SYNC_DEFAULT_DAYS=30
```

Wywołanie:

```bash
curl -X POST "http://localhost:54321/functions/v1/sync-sheets" \
  -H "Authorization: Bearer TWOJ_JWT_UZYTKOWNIKA" \
  -H "Content-Type: application/json" \
  -d '{"days":30}'
```

## Zachowanie

- Weryfikuje JWT użytkownika (musi być zalogowany w JJ Workout Tool).
- Pobiera serie z Supabase (service role), filtruje po `user_id`.
- Upsert do `Silownia_import` — ta sama logika co `Scripts/import/jarvis_import/importers/workout.py`.
- Strefa czasowa: `Europe/Warsaw`.

## Twój UUID (JJ_WORKOUT_ALLOWED_USER_ID)

W Supabase Dashboard → Authentication → Users → skopiuj UUID swojego konta.

Lub w aplikacji (po zalogowaniu): Ustawienia → Konto — możesz dodać wyświetlanie UUID w przyszłości.
