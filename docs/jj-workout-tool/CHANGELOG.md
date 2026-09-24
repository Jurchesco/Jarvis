## [1.0.0] - 2026-08-13

Oficjalna pierwsza wersja **JJ Workout Tool** — spersonalizowane narzędzie (fork open-source workout tracker).

### Added
- **Branding v1.0** — nazwa wyświetlana „JJ Workout Tool”, wersja `1.0.0` w aplikacji i `app.json`
- **Integracja Google Sheets** — ręczny sync z Ustawień (`sync-sheets` Edge Function → `Silownia_import`)

### Changed
- **Import do Sheets** — **1 wiersz = 1 ćwiczenie w sesji** (kolumna `Set` = liczba serii, `Volume` = ciężar × powt. × serie); klucz upsert: Data + Ćwiczenie
- **Pełny rebrand** — katalog `docs/jj-workout-tool/`, importer `workout.py`, Edge Function `importWorkout.ts`, slug `jj-workout-tool`, bundle `com.jjworkout.tool`
- **Sekret sync** — `JJ_WORKOUT_ALLOWED_USER_ID` (stary `STRAVIO_ALLOWED_USER_ID` nadal działa)

---

## [Unreleased]

### Added
- **Ghost „Poprzednio” (D019 §5)** — kolumna z poprzednimi kg×powt. przy logowaniu per seria; podpowiedzi widoczne nawet gdy autofill jest wyłączony
- **Backup JSON (D019 §4)** — eksport/import planów + historii w Ustawieniach (web download / native Share; import pliku na web)
- **RIR / RPE per seria** — opcjonalne pole wysiłku (pref w Ustawieniach, domyślnie off); skala RIR 0–10 lub RPE 1–10; kolumna `Wysilek` w Silownia_import (reprezentatywna seria)
- **Edytor planów (D018)** — cele serii×powt. (`exercise_sets`), reorder ↑↓, duplikat planu; seed formularza sesji z template gdy brak „Ostatnio”
- **D019 §5 — UX sesji** — pasek postępu % serii; chip „Ostatnio…”; toast z tonażem; wake lock (pref)
- **Baza ćwiczeń 1324 + GIF (CDN)** — ekran `/exercises`, picker z thumbs; dane MIT (`exercises-dataset`); media © Gym visual via jsDelivr (NOTICE); **nazwy PL** (`nPl`) w UI i przy zapisie
- **D019 — rest timer overlay** — pasek po zapisie ćwiczenia (−15s / +30s / Pomiń); pref + podgląd w Ustawieniach
- **D019 §3 — objętość per partia** — tagi mięśniowe w katalogu; Stats: serie ważone (główna 1,0 / pomocnicza 0,5); zakres „Ten tydzień” lub „W zakresie”
- **D016 — logowanie per seria** — wiersze kg/powt. (lub czas); tryb **Zbiorczo | Per seria** (pref + Ustawienia); Volume w Sheets = suma serii (PR #17)
- **Plany z katalogu (D018 / PR #13)** — Home: Freestyle | Wybierz plan; stack `/plans`; edytor `sheet/[id]`; start sesji z ćwiczeniami planu
- **Freestyle trening** — szybki start; ćwiczenia z katalogu w trakcie sesji (`ExercisePicker`)
- **Katalog ćwiczeń PPL** — `packages/shared/src/exerciseCatalog.ts` (43 ćwiczenia, push/pull/legs/abs)
- **Logowanie zbiorcze (D011)** — `ExerciseLogForm`: serie + ciężar + powtórzenia + uwagi; `saveExerciseLogBatch.ts`
- **Kalkulacje na żywo** — `workoutCalculations.ts`: Est. 1RM (Epley), objętość; stats w nagłówku sesji
- **OverflowMenu** — menu ⋮ w historii
- **`ensureFreestyleSheet`** — techniczny arkusz `"Freestyle"` (FK schematu)
- **Edycja historii** — daty sesji, edycja/usuwanie/dodawanie ćwiczeń po zakończeniu
- **Silownia_import — stabilny upsert (D015)** — `Session ID` / `Exercise ID`; klucz `session_id|exercise_id`
- **UI-D** — komponenty `Toast`, `Badge` (PR #4)
- `vercel.json`, `docs/`, `.gitignore` entries, `LICENSE` (wcześniejsze)

### Changed
- **UI-D QA (2026-09-22)** — toast błędów zapisu też na web (nie tylko Alert); toast sukcesu/błędu przy edycji w Historii; Badge liczby ćwiczeń na `/plans`; Badge ćwiczeń/serii na liście Historii (zgodne z Home)
- **Model produktu** — freestyle-first (**D009**) + plany obok freestyle (**D018**); bez seed PPL / auto-splitów; plany **nie** są zakładką tab bara
- **D016 / import Silownia** — Volume = suma serii; Ciezar/Powt./1RM = seria z najlepszym Brzycki; PR = max ciężar w sesji
- **Home** — dwa CTA: Freestyle | Wybierz plan
- **`app/sheet/[id].tsx`** — przywrócony edytor planu (wcześniej redirect Home)
- **Produkcja web** — kanon: **https://stravio-kappa.vercel.app/**
- **Tab bar** — `backgroundColor: #0b1220`
- **ScreenHeader** — `leading-tight` na tytułach
- **Importer** — kolumna Split = nazwa arkusza (`Freestyle` albo nazwa planu)
- **Historia UI** — kafelki 1RM/objętość, menu ⋮
- **Cron import** — `DEFAULT_DAYS=3` (od 2026-09-07)
- **API client**: Supabase JS; UUID IDs; auth UX (wcześniejsze zmiany)

### Fixed
- **Reset formularza ćwiczenia** — wartości nie znikały przy ticku licznika sesji
- **Duplikaty w Silownia_import** — upsert po `session_id|exercise_id` (+ legacy Data|Ćwiczenie)
- **openScale** — MeasurementType.identity (schema 16+); wybór najnowszego zip po dacie

### Removed
- **Program PPL (seed)** — `seedPplProgram.ts`
- **Auto-tworzenie 4 splitów** — `ensureSplitSheets.ts`
- **Rest timer** — wyłączony z UI (może wrócić jako overlay / pref)
- **Long-press delete** — w Historii zastąpione menu ⋮
- SQLite / Fastify (wcześniejsze)

---

## [0.3.0] - 2026-03-10

### Added
- **Supabase Auth**: Login/signup screens with email + password
- **Role system**: DB role field retained for compatibility, with `allievo` as current default UX
- **Auth context**: `AuthProvider` + `useAuth()` hook with persistent sessions
- **Auth gate**: Auto-redirect to login if not authenticated
- **Profile display**: User avatar and name on home screen
- **Supabase schema**: `supabase/schema.sql` with 7 tables, RLS policies, triggers
- **expo-secure-store**: Secure token storage on native devices

---

## [0.2.0] - 2026-03-09

### Added
- **Workout sessions**: Start workout from sheet, log sets in real-time
- **Session history**: Calendar view with workout day highlights
- **Session detail**: Review completed workout (exercises, sets, weights)
- **Rest timer**: Countdown between sets with skip option *(obecnie wyłączony w UI)*
- **Previous session hints**: Shows last session's weight/reps during workout
- **Exercise notes**: Per-exercise notes during workout (auto-copied from template)
- **Weight sync**: KG changes during workout auto-update the sheet template

---

## [0.1.0] - 2026-03-09

### Added
- Initial project setup: Expo + NativeWind monorepo
- **Workout sheets**: Create, view, delete sheets
- **Exercises**: Add exercises to sheets with ordering
- **Exercise sets**: Add/edit/delete sets (weight, reps, rest time)
- **Local SQLite storage**: expo-sqlite + drizzle-orm for offline data
- **Fastify backend**: REST API for web development
- **Dark theme**: Custom dark gym-themed design
- First APK build (86 MB)
