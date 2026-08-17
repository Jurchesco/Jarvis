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
- **Freestyle trening** — Home: jeden przycisk „Rozpocznij trening”; ćwiczenia wybierane na bieżąco z katalogu (`ExercisePicker`)
- **Katalog ćwiczeń PPL** — `packages/shared/src/exerciseCatalog.ts` (43 ćwiczenia, push/pull/legs/abs)
- **Logowanie zbiorcze** — `ExerciseLogForm`: serie + ciężar + powtórzenia + uwagi w jednym formularzu; zapis wielu serii naraz (`saveExerciseLogBatch.ts`)
- **Kalkulacje na żywo** — `workoutCalculations.ts`: Est. 1RM (Epley), objętość; statystyki sesji w nagłówku treningu (ćwiczenia, serie, objętość, czas, naj. 1RM, powtórzenia)
- **OverflowMenu** — menu ⋮ w historii (usuwanie sesji bez long-press)
- **`ensureFreestyleSheet`** — jeden techniczny arkusz `"Freestyle"` na użytkownika (wymóg schematu Supabase)
- **Edycja historii** — szczegóły sesji: edycja dat start/koniec (`EditSessionDateSheet`, `CalendarPicker`), edycja/usuwanie ćwiczeń, dodawanie ćwiczeń do ukończonego treningu
- **Silownia_import — stabilny upsert** — kolumny `Session ID` / `Exercise ID`; klucz `session_id|exercise_id` w `workout.py` i `importWorkout.ts`
- `vercel.json`, `docs/`, `.gitignore` entries, `LICENSE` (wcześniejsze)

### Changed
- **Model produktu v1** — plany/splitty (PUSH/PULL/…) **wyłączone z UI**; gotowe programy zaplanowane jako osobna zakładka w przyszłości
- **Home** — z „Moje plany” na ekran startowy z CTA freestyle (bez FAB, bez drag&drop planów)
- **`app/workout/[id].tsx`** — przebudowany flow treningu (Perplexity-like); nagłówek „Freestyle”
- **`app/sheet/[id].tsx`** — przekierowanie na Home (ekran planów nieużywany)
- **Tab bar** — `backgroundColor: #0b1220` (spójny z tokenem `background`)
- **ScreenHeader** — `leading-tight` na tytułach
- **Importer / Gem** — kolumna Split w Sheets dla sesji freestyle = `"Freestyle"`
- **Historia UI** — wyśrodkowany tytuł ćwiczenia, kafelki statystyk (1RM, objętość), kosz/edycja w nagłówku karty, przycisk „Wróć” do listy
- **API client**: Supabase JS; UUID IDs; auth UX (wcześniejsze zmiany)

### Fixed
- **Reset formularza ćwiczenia** — wpisane wartości nie znikały przy ticku licznika czasu sesji (usunięty `useEffect` nadpisujący `initialDraft`)
- **Duplikaty w Silownia_import** — ponowny sync po edycji sesji dopisywał wiersze zamiast aktualizować (klucz `Data|Cwiczenie` + lokalizacja PL)

### Removed
- **Program PPL (seed)** — `seedPplProgram.ts`, przycisk seed na Home
- **Auto-tworzenie 4 splitów** — `ensureSplitSheets.ts`
- **Rest timer** — tymczasowo wyłączony z UI (decyzja produktowa; może wrócić w Ustawieniach)
- **Long-press delete** — na Home (plany usunięte); w Historii zastąpione menu ⋮
- SQLite / Fastify / duplikat „Utwórz plan” (wcześniejsze)

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
