## Architecture

> **Stan na 2026-09-21 (produkcja):** Home = **Freestyle** albo **plan** (D018). Logowanie ćwiczeń: tryb **Zbiorczo** albo **Per seria** (**D016**, PR #17). Schemat DB bez zmian.

### Produkcja web

Jedyna właściwa wersja: **https://stravio-kappa.vercel.app/**

### Monorepo Layout

```
apps/mobile/          ← Expo universal app (Android APK + Vercel web SPA)
  app/
    (tabs)/index.tsx  ← Home: Freestyle | Wybierz plan
    (tabs)/settings/  ← m.in. domyślny tryb wypełniania serii
    plans/index.tsx   ← Lista planów (arkusze ≠ „Freestyle”)
    sheet/[id].tsx    ← Edytor planu: cele serii×powt., reorder, duplikat, start
    workout/[id].tsx  ← Aktywna sesja + logowanie ćwiczeń
    workout/summary/  ← Podsumowanie po „Zakończ”
  src/
    api/              ← Supabase client + React Query hooks
    components/       ← ExercisePicker, ExerciseLogForm, OverflowMenu, ui/*
    lib/              ← ensureFreestyleSheet, saveExerciseLogBatch, appPreferences, …
    contexts/         ← AuthContext
packages/shared/
  exerciseCatalog.ts  ← Katalog PPL (43 ćwiczenia)
  muscleGroups.ts     ← Tagi partii (D019): primary 1.0 / secondary 0.5
  muscleVolume.ts     ← Sumy ważonych serii per partia (tydzień / zakres)
  workoutCalculations.ts ← Epley 1RM, volumeFromSets, stats sesji
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

W sesji — ExerciseLogForm:
  ├─ tryb „Zbiorczo”  → N identycznych serii (D011 UX)
  └─ tryb „Per seria” → osobne kg/powt. (lub czas) na wiersz (D016)
       (domyślne w Ustawieniach; przełącznik na karcie; rampa wymusza Per seria)
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
| `app/sheet/[id].tsx` | Edytor planu (cele, reorder, duplikat) + start/kontynuacja sesji |
| `lib/addCatalogExercise.ts` | Dodaje ćwiczenie do arkusza |
| `lib/saveExerciseLogBatch.ts` | Zapis serii (mogą mieć różne kg/powt.) + uwagi |
| `lib/appPreferences.ts` | m.in. `exerciseLogFillMode`: `batch` \| `per-set` |
| `components/ExerciseLogForm.tsx` | Formularz: Zbiorczo / Per seria, uwagi, live 1RM/objętość |
| `components/ExercisePicker.tsx` | Modal katalogu (filtry push/pull/legs/abs) |

### Database (Supabase Postgres)

7 tabel, RLS — bez zmian schematu:

| Table | Rola |
|-------|------|
| `workout_sheets` | `"Freestyle"` (ukryty kontener) **oraz** nazwane plany użytkownika |
| `exercises` | Ćwiczenia na arkuszu (plan albo zbierane we freestyle) |
| `exercise_sets` | Szablony serii (cele planu: liczba × powtórzenia) |
| `workout_sessions` | Sesja; `completed_at` null = w trakcie |
| `session_set_logs` | Faktyczne wykonanie (źródło prawdy; możliwa rampa) |
| `session_exercise_notes` | Uwagi per ćwiczenie w sesji |
| `profiles` | Profil użytkownika |

### Kalkulacje

- **UI:** Epley 1RM — `epley1rm()` / `bestEpley1rmFromSets()`; objętość = `exerciseVolumeFromSets()` (suma serii)
- **Importer Sheets:** Brzycki; **Volume** = Σ(kg×powt.); Ciezar/Powt./1RM = seria z najlepszym Brzycki; PR = max kg w sesji (D016)

### Auth

`AuthContext` + `AuthGate` w `app/_layout.tsx`. Token: SecureStore (native) / localStorage (web).

### Styling

NativeWind v4, tokeny w `tailwind.config.js`. Komponenty UI: `src/components/ui/` (`Toast`, `Badge`, `BottomSheet`, `Pills`, …).

### Shared Types

`packages/shared/src/index.ts` — import jako `@bhmt3wp/shared`.

### Integracja Jarvis

Po zakończeniu sesji dane trafiają do importu siłowni (`Silownia_import`): **Split** = nazwa arkusza (`Freestyle` albo nazwa planu), ćwiczenia i serie z `session_set_logs`. Ręczny sync: Edge Function `sync-sheets` (Ustawienia). Cron: GitHub Actions `jarvis-import.yml`.
