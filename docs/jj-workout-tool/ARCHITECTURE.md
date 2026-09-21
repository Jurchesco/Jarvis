## Architecture

> **Stan na 2026-09-21:** Home oferuje **Freestyle** albo **plan z katalogu** (PR #13, `8d9c407`). Freestyle zostaje domyślnym, szybkim flow; plany to osobny stack `/plans` (nie zakładka tab bara). Schemat DB bez zmian.

### Produkcja web

Jedyna właściwa wersja: **https://stravio-kappa.vercel.app/**

### Monorepo Layout

```
apps/mobile/          ← Expo universal app (Android APK + Vercel web SPA)
  app/
    (tabs)/index.tsx  ← Home: Freestyle | Wybierz plan
    plans/index.tsx   ← Lista planów (arkusze ≠ „Freestyle”)
    sheet/[id].tsx    ← Edytor planu: katalog, kolejność, start sesji
    workout/[id].tsx  ← Aktywna sesja + logowanie ćwiczeń
    workout/summary/  ← Podsumowanie po „Zakończ”
  src/
    api/              ← Supabase client + React Query hooks
    components/       ← ExercisePicker, ExerciseLogForm, OverflowMenu, ui/*
    lib/              ← ensureFreestyleSheet, saveExerciseLogBatch, addCatalogExercise
    contexts/         ← AuthContext
packages/shared/
  exerciseCatalog.ts  ← Katalog PPL (43 ćwiczenia)
  workoutCalculations.ts ← Epley 1RM, objętość, statystyki sesji
supabase/             ← Postgres schema + RLS + Edge Function sync-sheets
Scripts/import/       ← Jarvis → Google Sheets (Split = nazwa arkusza)
```

> Root-level symlinks (`app/`, `src/`, …) — patrz D006 w `DECISIONS.md` (EAS build).

### User Flow

```
Home
  ├─ „Freestyle”
  │    └─ ensureFreestyleSheet() → session (sheet = Freestyle)
  │         └─ workout/[sessionId]  (ćwiczenia z katalogu w trakcie)
  └─ „Wybierz plan” → /plans
       ├─ Nowy plan → sheet/[id] (układ z katalogu)
       └─ Istniejący plan → sheet/[id]
            └─ „Rozpocznij plan” → session z ćwiczeniami już na ekranie
                 └─ workout/[sessionId] → „Zakończ” → summary → Historia / import
```

### Data Flow

1. Screen → React Query hook (`hooks.ts`)
2. Hook → `api.*` (`client.ts`) → Supabase (RLS per user)
3. Mutacja invaliduje cache (`["sheets"]`, `["sessions", id]`, …)

### Kluczowe pliki treningu

| Plik | Rola |
|------|------|
| `lib/ensureFreestyleSheet.ts` | Tworzy/znajduje arkusz `"Freestyle"`; helper `isFreestyleSheetName` |
| `app/plans/index.tsx` | Lista planów (filtr bez Freestyle), tworzenie/usuwanie |
| `app/sheet/[id].tsx` | Edytor planu + start/kontynuacja sesji |
| `lib/addCatalogExercise.ts` | Dodaje ćwiczenie do arkusza (planowanie: domyślnie 3 serie szablonu; w sesji: 1) |
| `lib/saveExerciseLogBatch.ts` | Zapis N serii + logi sesji + uwagi |
| `components/ExerciseLogForm.tsx` | Formularz: serie, kg, powt., uwagi, live 1RM/objętość (D011) |
| `components/ExercisePicker.tsx` | Modal katalogu (filtry push/pull/legs/abs) |

### Database (Supabase Postgres)

7 tabel, RLS — bez zmian schematu:

| Table | Rola |
|-------|------|
| `workout_sheets` | `"Freestyle"` (ukryty kontener) **oraz** nazwane plany użytkownika |
| `exercises` | Ćwiczenia na arkuszu (plan albo zbierane we freestyle) |
| `exercise_sets` | Szablony serii |
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

NativeWind v4, tokeny w `tailwind.config.js`. Komponenty UI: `src/components/ui/` (`Toast`, `Badge`, `BottomSheet`, `Pills`, …).

### Shared Types

`packages/shared/src/index.ts` — import jako `@bhmt3wp/shared`.

### Integracja Jarvis

Po zakończeniu sesji dane trafiają do importu siłowni (`Silownia_import`): **Split** = nazwa arkusza (`Freestyle` albo nazwa planu), ćwiczenia i serie z `session_set_logs`. Ręczny sync: Edge Function `sync-sheets` (Ustawienia). Cron: GitHub Actions `jarvis-import.yml`.
