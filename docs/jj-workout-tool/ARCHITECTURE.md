## Architecture

> **Stan na 2026-08-12:** aplikacja działa w trybie **freestyle** — logowanie ćwiczeń w trakcie sesji. Moduł planów treningowych w UI jest wyłączony (schemat DB bez zmian).

### Monorepo Layout

```
apps/mobile/          ← Expo universal app (Android APK + Vercel web SPA)
  app/
    (tabs)/index.tsx  ← Home: „Rozpocznij trening” (freestyle)
    workout/[id].tsx  ← Aktywna sesja + logowanie ćwiczeń
    sheet/[id].tsx    ← Redirect → Home (plany wyłączone)
  src/
    api/              ← Supabase client + React Query hooks
    components/       ← ExercisePicker, ExerciseLogForm, OverflowMenu, ui/*
    lib/              ← ensureFreestyleSheet, saveExerciseLogBatch, addCatalogExercise
    contexts/         ← AuthContext
packages/shared/
  exerciseCatalog.ts  ← Katalog PPL (43 ćwiczenia)
  workoutCalculations.ts ← Epley 1RM, objętość, statystyki sesji
supabase/             ← Postgres schema + RLS
Scripts/import/       ← Jarvis → Google Sheets (Split = „Freestyle”)
```

> Root-level symlinks (`app/`, `src/`, …) — patrz D006 w `DECISIONS.md` (EAS build).

### User Flow (freestyle)

```
Home
  └─ „Rozpocznij trening”
       └─ ensureFreestyleSheet() → workout_sessions (sheet_id = Freestyle)
            └─ workout/[sessionId]
                 ├─ ExercisePicker → exercises + exercise_sets (on save)
                 ├─ ExerciseLogForm → session_set_logs (N serii naraz)
                 └─ „Zakończ” → completed_at → Historia / import Jarvis
```

### Data Flow

1. Screen → React Query hook (`hooks.ts`)
2. Hook → `api.*` (`client.ts`) → Supabase (RLS per user)
3. Mutacja invaliduje cache (`["sheets"]`, `["sessions", id]`, …)

### Kluczowe pliki treningu

| Plik | Rola |
|------|------|
| `lib/ensureFreestyleSheet.ts` | Tworzy/znajduje arkusz `"Freestyle"` |
| `lib/addCatalogExercise.ts` | Dodaje ćwiczenie do arkusza (0 serii szablonu w freestyle) |
| `lib/saveExerciseLogBatch.ts` | Zapis N serii + logi sesji + uwagi |
| `components/ExerciseLogForm.tsx` | Formularz: serie, kg, powt., uwagi, live 1RM/objętość |
| `components/ExercisePicker.tsx` | Modal katalogu (filtry push/pull/legs/abs) |

### Database (Supabase Postgres)

7 tabel, RLS — bez zmian schematu:

| Table | Rola w freestyle |
|-------|------------------|
| `workout_sheets` | Jeden rekord `"Freestyle"` / user (kontener ćwiczeń) |
| `exercises` | Ćwiczenia dodane w trakcie sesji (`sheet_id` → Freestyle) |
| `exercise_sets` | Szablony serii (tworzone przy zapisie logu) |
| `workout_sessions` | Sesja; `completed_at` null = w trakcie |
| `session_set_logs` | Faktyczne wykonanie (źródło prawdy dla historii i importu) |
| `session_exercise_notes` | Uwagi per ćwiczenie w sesji |
| `profiles` | Profil użytkownika |

### Kalkulacje

- **UI:** Epley 1RM — `epley1rm()` w `workoutCalculations.ts` (jak dziennik Perplexity PWA)
- **Importer Sheets:** Brzycki — `workout.py` (zgodnie z `GEM_INSTRUKCJA.md`)

### Auth

`AuthContext` + `AuthGate` w `app/_layout.tsx`. Token: SecureStore (native) / localStorage (web).

### Styling

NativeWind v4, tokeny w `tailwind.config.js`. Komponenty UI: `src/components/ui/`.

### Shared Types

`packages/shared/src/index.ts` — import jako `@bhmt3wp/shared`.

### Integracja Jarvis

Po zakończeniu sesji dane trafiają do importu siłowni (`Silownia_import`): Split = nazwa arkusza (`Freestyle`), ćwiczenia i serie z `session_set_logs`.
