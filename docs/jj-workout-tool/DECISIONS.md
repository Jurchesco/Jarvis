# Technical Decisions

Record of key technical decisions made during development.

---

## D001: Monorepo with npm workspaces

**Date**: 2026-03-09
**Status**: Active

We use npm workspaces (not Turborepo/Nx) for simplicity. The monorepo has:
- `apps/mobile` – Expo universal app
- `packages/shared` – Shared TypeScript types
- `packages/react-native-worklets-stub` – NativeWind compat shim

---

## D002: NativeWind v4 for styling

**Date**: 2026-03-09
**Status**: Active

NativeWind lets us use Tailwind CSS classes in React Native. Requires:
- `nativewind/babel` preset in babel config
- `nativewind/metro` wrapper in metro config
- `react-native-worklets-stub` no-op plugin (RN 0.76.6 compat)
- `nativewind-env.d.ts` for TypeScript className support

---

## D003: Supabase instead of custom backend

**Date**: 2026-03-10
**Status**: Active

**Context**: The app needs auth, cloud database, and per-user data isolation.

**Decision**: Use Supabase (Auth + Postgres + RLS) instead of self-hosted Fastify + SQLite.

**Pros**:
- No server to maintain
- Built-in auth with multiple providers
- RLS policies for security without backend code
- Real-time subscriptions available for future use
- Free tier sufficient for early development

**Cons**:
- Vendor lock-in (mitigated: standard Postgres, can self-host Supabase)
- No offline support without additional tooling (future: PowerSync)
- Latency for every operation (no local cache currently)

---

## D004: Expo universal app (no separate web framework)

**Date**: 2026-03-10
**Status**: Active

**Context**: Need both mobile (Android APK) and web app.

**Decision**: Use Expo's built-in web support (`expo export --platform web`) instead of a separate Next.js/Vite app.

**Pros**:
- Single codebase for mobile + web
- No UI code duplication
- React Native Web handles component mapping
- Simple static deploy to Vercel

**Cons**:
- Web bundle is larger than a native web app would be (~1.3 MB JS)
- Some React Native components may not map perfectly to web
- SEO not important for this app (SPA is fine)

---

## D005: UUID primary keys everywhere

**Date**: 2026-03-10
**Status**: Active

**Context**: Supabase uses UUID PKs by default. Local SQLite used auto-increment integers.

**Decision**: Switch all TypeScript interfaces to `string` IDs (UUID). Drop local SQLite as primary data store.

**Trade-offs**:
- Route params no longer need `parseInt()`
- UUIDs are longer but globally unique (important for eventual sync)

---

## D006: EAS builds from monorepo root

**Date**: 2026-03-10
**Status**: Active (build workaround)

**Context**: EAS always runs from the npm workspace root, not from `apps/mobile/`.

**Decision**: Create root-level configs + symlinks so EAS can find everything:
- Root `app.json` with full Expo config (asset paths adjusted to `./apps/mobile/assets/`)
- Root `metro.config.js` and `babel.config.js`
- Root `eas.json` for build profiles
- Symlinks: `app → apps/mobile/app`, `src → apps/mobile/src`, etc.

**Note**: The `app` symlink at root (pointing to `apps/mobile/app`) exists for this reason. It is NOT a source folder — `apps/` contains the actual code.

---

## D007: Keep APK files in repo

**Date**: 2026-03-10
**Status**: Active

APK files are kept in `apps/mobile/` as version snapshots:
- `build-*.apk` files serve as historical versions
- `.gitignore` excludes them from git (they're too large)
- Useful for quick testing without rebuilding

---

## D008: Role kept in schema, hidden in v1 UX

**Date**: 2026-03-10
**Status**: Active

**Current v1 behavior**:
- Signup always writes `allievo` in user metadata.
- `profiles.role` is still stored in Postgres with CHECK constraint compatibility.
- The UI does not show or let users choose roles.

Role is kept in schema to avoid breaking existing data and to support future multi-role features.

---

## D009: Freestyle-first (plany w UI wyłączone)

**Date**: 2026-08-12
**Status**: Active

**Context**: Użytkownik loguje treningi jak w dzienniku Perplexity — wybór ćwiczeń w trakcie sesji, bez wcześniejszego planowania arkusza.

**Decision**:
- Home = jeden CTA „Rozpocznij trening”.
- Ćwiczenia z katalogu (`EXERCISE_CATALOG`) dodawane w `app/workout/[id].tsx`.
- Jeden techniczny arkusz `"Freestyle"` na użytkownika (`ensureFreestyleSheet.ts`) — wymagany przez FK `workout_sessions.sheet_id` i `exercises.sheet_id`.
- Gotowe **plany treningowe** (PPL, szablony) → **osobna zakładka** w przyszłości, nie blokują freestyle.

**UI planów** (`app/sheet/[id].tsx`) przekierowuje na Home.

---

## D010: Epley 1RM w UI, Brzycki w imporcie

**Date**: 2026-08-12
**Status**: Active

**Context**: Dziennik Perplexity (PWA) liczy Est. 1RM wzorem **Epley** (`ciężar × (1 + powt./30)`). Importer Jarvis / Gem używają **Brzyckiego** w kolumnie `Est. 1RM` w Google Sheets.

**Decision**:
- UI treningu (`packages/shared/src/workoutCalculations.ts`): **Epley** — zgodność z oczekiwanym UX w aplikacji.
- Eksport (`Scripts/import/jarvis_import/importers/workout.py`): **Brzycki** — bez zmian, spójność z `GEM_INSTRUKCJA.md`.
- Wartości w UI i w Sheets **mogą się różnić** dla tej samej serii; oba liczone z surowego ciężaru i powtórzeń.

---

## D011: Logowanie zbiorcze serii (nie wiersz po wierszu)

**Date**: 2026-08-12
**Status**: Active

**Decision**: Użytkownik podaje **liczbę serii**, **ciężar**, **powtórzenia** (lub czas dla ćwiczeń izometrycznych) i **uwagi** w jednym formularzu (`ExerciseLogForm`). Zapis tworzy N wpisów `session_set_logs` + szablony `exercise_sets` (`saveExerciseLogBatch.ts`).

**Rest timer** tymczasowo **wyłączony** z UI — może wrócić jako opcja w Ustawieniach.

---

## D012: Ręczny sync do Google Sheets — Edge Function (testy osobiste)

**Date**: 2026-08-12  
**Status**: Active (wymaga deploy + sekretów)

**Context**: Testy na własnych treningach; dane do arkusza Jarvis / Gema. Sekrety Google i service role nie mogą trafić do klienta.

**Decision**:
- Edge Function `sync-sheets` — port `workout.py` → zakładka `Silownia_import`.
- Jeden `GOOGLE_SHEET_ID` w sekretach (osobisty arkusz, nie SaaS).
- Opcjonalny `JJ_WORKOUT_ALLOWED_USER_ID` — tylko właściciel wywołuje sync.
- GitHub Actions co godzinę pozostaje jako automatyczny backup.

**Future**: OAuth Google (własny arkusz), eksport CSV z Ustawień.

---

## D013: Agregacja importu + rebrand JJ Workout Tool v1.0

**Date**: 2026-08-13  
**Status**: Active

**Context**: Sync do `Silownia_import` tworzył osobny wiersz na każdą serię. Użytkownik preferuje jeden wiersz na ćwiczenie w sesji.

**Decision**:
- Import (`importWorkout.ts`, `workout.py`): grupowanie po `session_id:exercise_id`; kolumna **Set** = liczba serii; **Volume** = ciężar × powtórzenia × serie; ciężar/powt. z pierwszej serii (logowanie zbiorcze); klucz upsert historycznie = `Data|Cwiczenie` (zastąpiony przez **D015**).
- **Nazwa produktu**: **JJ Workout Tool**, wersja **1.0.0** w UI (`branding.ts`, `app.json`).

---

## D014: Pełny rebrand nazewnictwa (katalogi, kod, docs)

**Date**: 2026-08-13  
**Status**: Active

**Decision**:
- Katalog projektu: **`JJ-Workout-Tool/`** (docelowo; junction gdy folder zablokowany przez IDE).
- Dokumentacja aplikacji: `docs/jj-workout-tool/` (było `docs/stravio/`).
- Importer Python: `workout.py` / `import_workout()`; Edge Function: `importWorkout.ts` / `runWorkoutImport()`.
- Expo: `slug` + `scheme` = `jj-workout-tool`, bundle/package = `com.jjworkout.tool`.
- Sekret Supabase: **`JJ_WORKOUT_ALLOWED_USER_ID`**; fallback na stary `STRAVIO_ALLOWED_USER_ID` w Edge Function.

---

## D015: Stabilny klucz upsert Silownia_import (Session ID + Exercise ID)

**Date**: 2026-08-17  
**Status**: Active

**Context**: Edycja daty startu sesji lub ponowny import przy lokalizacji PL arkusza powodował dopisywanie duplikatów zamiast aktualizacji wierszy (`Data|Cwiczenie` nie jest stabilny).

**Decision**:
- Kolumny **`Session ID`** i **`Exercise ID`** w `Silownia_import` (techniczne; Gem ignoruje).
- Klucz upsert: `session_id|exercise_id`; fallback na znormalizowany `Data|Cwiczenie` dla starych wierszy bez ID.
- Normalizacja daty w kluczu legacy: ISO + format PL (`15.08.2026` → `2026-08-15`) w `dates.py` / `importWorkout.ts`.
- Zakres zapisu w Sheets: kolumny A–N.

---

## Future Decisions (TODO)

- **PowerSync**: Offline-first sync between local SQLite and Supabase
- **Multi-role model**: Re-introduce role-specific flows only when assignment and permissions are fully designed
- **Push notifications**: Workout reminders via Expo notifications
- **Data export**: CSV/PDF export of workout history
