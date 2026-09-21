# AGENTS.md

Instrukcje dla **Cursor Cloud Agents** (i innych agentów) pracujących w tym repo.  
Ludzki indeks produktu: `README.md`, `CLAUDE.md`, `docs/README.md`.

---

## Co to jest

Monorepo npm workspaces: Expo app w `apps/mobile` (web + Android/iOS), typy w `packages/shared`, import Jarvis w `Scripts/import`, Edge Function `supabase/functions/sync-sheets`.

**Produkcja web (kanon):** https://stravio-kappa.vercel.app/  
Inne aliasy Vercel nie są kanonem — patrz `.cursor/rules/jarvis-canonical-app.mdc`.

---

## Standardowe komendy

```bash
npm install                          # root
npm run web -w apps/mobile           # http://localhost:8081
npx tsc --noEmit -p apps/mobile/tsconfig.json
npx tsc --noEmit -p packages/shared/tsconfig.json
```

Brak automatycznych testów jednostkowych w projekcie — E2E = ręcznie / computer-use agenta.

---

## E2E na żywym Supabase (preferowane)

Użytkownik ma **osobne konto testowe**. Agent **nie** używa prywatnego konta właściciela.

### Sekrety środowiska Cloud (dashboard)

Dodaj w Cursor → Cloud Agents → Environment → Secrets (nazwy **dokładnie** takie):

| Sekret | Opis |
|--------|------|
| `JJ_TEST_EMAIL` | email konta testowego |
| `JJ_TEST_PASSWORD` | hasło konta testowego |
| `EXPO_PUBLIC_SUPABASE_URL` | URL projektu Supabase (ten sam co produkcja / `.env.example`) |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable/anon key (publiczny, OK w env) |

Opcjonalnie (jeśli publishable nie wystarczy w danym projekcie): `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

**Zakaz:** commitować hasła / service_role do gita, `AGENTS.md`, PR, screenshotów z widocznym hasłem.

### Jak agent ma testować

1. Upewnij się, że sekrety są w env (`echo` tylko czy zmienne **istnieją**, nigdy nie wypisuj wartości haseł w logach/PR).
2. Skonfiguruj `apps/mobile/.env` (gitignored) z `EXPO_PUBLIC_SUPABASE_*` z sekretów / `.env.example`.
3. `npm install` → `npm run web -w apps/mobile` **albo** testuj bezpośrednio na https://stravio-kappa.vercel.app/ / preview Vercel PR.
4. Zaloguj się przez UI: `JJ_TEST_EMAIL` + `JJ_TEST_PASSWORD`.
5. Scenariusze minimalne po zmianach treningu:
   - Home → Freestyle (lub plan) → dodaj ćwiczenie
   - Tryb **Zbiorczo**: N × te same kg/powt. → zapisz
   - Tryb **Per seria**: różne kg/powt. (rampa) → zapisz → sprawdź tabelę na karcie
   - Zakończ trening / Historia — serie widoczne poprawnie
6. Po teście: wyloguj się; nie zmieniaj hasła konta; nie kasuj cudzych danych produkcyjnych poza kontem testowym.

Jeśli sekrety `JJ_TEST_*` **brak** — nie zgaduj haseł; poproś użytkownika o dodanie ich w Environment Secrets albo ogranicz się do `tsc` / review kodu / preview bez logowania.

---

## Alternatywa: lokalny Supabase (gdy nie ma konta testowego)

Hosted projekt często ma **Confirm email** → nowy signup w Cloud VM bez skrzynki nie przejdzie. Wtedy:

1. Docker + Supabase CLI, lokalny stack (`supabase start` poza niepełnym `supabase/config.toml` w repo — użyj scratch dir).
2. Zaaplikuj: `supabase/schema.sql`, migracje, `supabase/security_hardening_*.sql`.
3. **GRANT-y** na lokalnym DB (inaczej `permission denied for table workout_sheets` po loginie):

```sql
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;
```

4. `apps/mobile/.env` → `http://127.0.0.1:54321` + lokalny publishable key ze `supabase start`.
5. Restart Expo po zmianie `.env`.

Importer Garmin/Google Sheets **nie** jest wymagany do testów UI apki.

---

## Docs produktowe (konflikt)

Źródło prawdy: kod `main` + kappa + Obsidian użytkownika > zaległe docs.  
Decyzje: `docs/jj-workout-tool/DECISIONS.md` (D016 = Zbiorczo|Per seria; D018 = plany; D019 = backlog FORGE).
