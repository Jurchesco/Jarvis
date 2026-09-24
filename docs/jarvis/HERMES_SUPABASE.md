# Hermes / Gem — źródło danych (Supabase + eksport)

**Stan (2026-09):** Supabase jest **źródłem prawdy** dla treningów, wagi (`body_measurements`) i Garminu (`garmin_*`). Google Sheets pozostaje **mirror** dla Hermesa/Gema na okres przejściowy.

## Co czytać dziś

| Kanał | Kiedy |
|-------|--------|
| Google Sheets (jak dotychczas) | Hermes skill / Gem z podpiętym arkuszem — bez zmian w promptcie |
| Eksport CSV/JSON z aplikacji | Ustawienia → Backup → „Kontekst AI (30 dni)” — allowlista pól |
| Pełny backup JSON v2 | Ustawienia → Eksportuj backup (plany + sesje + profil + waga + Garmin) |

## Migracja SQL (wymagana raz)

W Supabase SQL Editor uruchom:

1. `supabase/schema.sql` (jeśli świeży projekt)
2. `supabase/body_and_health.sql` — profil ciała, pomiary, tabele Garmin + RLS

## Importer → baza

W `Scripts/import/.env`:

```
SUPABASE_URL=...
SUPABASE_SECRET_KEY=...   # service_role
JJ_WORKOUT_USER_ID=<uuid właściciela z auth.users>
```

Po imporcie Garmin/openScale dane trafiają **do Sheets i do Supabase**. Brak `JJ_WORKOUT_USER_ID` = tylko Sheets (soft skip).

## Allowlista kontekstu AI

Nigdy nie wysyłaj całej bazy do modelu. Eksport apki obejmuje wyłącznie:

`profile` · `bodyweight` · `training` · `sleep` · `daily` · `forma` · `activities`

okno czasowe (domyślnie 30 dni).

## Docelowo (Hermes na homelabie)

1. Hermes pobiera allowlistowany JSON/CSV z eksportu albo czyta Supabase przez service role (ten sam filtr user_id + okno dni).
2. Gem może zostać na Sheets dopóki mirror jest świeży.
3. **In-app AI Coach** (jak OpenGym) = osobny epik: consent UI, joby, apply/revert planu — nie w tej fazie.

## openScale

Nie portujemy kodu openScale (**GPL-3.0**). Waga: ręczny weigh-in w JJ + import backupu SQLite → `body_measurements` (istniejący importer Pythona).
