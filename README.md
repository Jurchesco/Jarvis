# JJ Workout Tool

Spersonalizowany tracker treningowy w ekosystemie **Jarvis**: loguj sesje (freestyle albo plan), synchronizuj do Google Sheets → Hermes / Gem.

**Wersja UI 1.0.0** · Web: **https://stravio-kappa.vercel.app/**

---

## O projekcie

JJ Workout Tool to tracker treningowy na Android, iOS i Web (fork open-source; produkt użytkownika = **Jarvis**).

<p align="center">
  <img src="docs/screenshots/login.png" width="200" alt="Login" />
  <img src="docs/screenshots/home.png" width="200" alt="Home" />
  <img src="docs/screenshots/sheet.png" width="200" alt="Sheet Detail" />
  <img src="docs/screenshots/workout.png" width="200" alt="Workout" />
</p>

> **Screenshots**: Place your screenshots in `docs/screenshots/` with the names referenced above.

---

## Vision

**Current product model (2026-09-21):** freestyle-first (**D009**) + optional catalog plans (**D018**) + set logging **batch or per-set** (**D016**)

- Start **Freestyle** with one tap — pick exercises from the catalog during the session
- Or **choose a plan** (`/plans`) — named sheets built from the catalog; start with exercises already on screen
- Plans are a **stack route**, not a bottom-tab item
- Log sets **collectively** (same kg/reps × N) or **per set** (ramp) — toggle on the form / Settings
- Every account is stored as athlete (`allievo`); no role UI
- Data syncs to Supabase; Jarvis pipeline exports to Google Sheets (`Silownia_import`)
- Daily coach: **Hermes**; Gem instructions = backup (`docs/jarvis/GEM_INSTRUKCJA.md`) — **D017**

## Features

- **Freestyle workouts** — One-tap start; add exercises from the PPL catalog on the fly
- **Catalog plans** — Create/edit named plans, start a session from a plan
- **Set logging modes** — **Batch** (identical sets) or **Per set** (ramp); preference remembered (D016)
- **Live session stats** — Volume, time, best est. 1RM, set count in the workout header
- **Exercise catalog** — Push / Pull / Legs / Core filters + custom exercise names
- **Session History** — Calendar with workout days, session detail review
- **Statistics** — Volume and frequency charts
- **Previous session hints** — Last weight/reps when logging an exercise
- **Exercise notes** — Per-exercise notes during a session
- **Sheets sync** — Manual sync from Settings (`sync-sheets`) + hourly GitHub Actions import
- **Authentication** — Email/password with persistent sessions
- **Cross-Platform** — Android (APK) and Web (Vercel — kappa)
- **Per-User Data Isolation** — Supabase RLS

*Backlog:* rest timer overlay, muscle-group weekly volume, JSON backup, PowerSync — see `docs/jj-workout-tool/TODO.md` (D019)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Native 0.76 · Expo 52 · expo-router 4 |
| Styling | NativeWind v4 (Tailwind CSS) |
| State | @tanstack/react-query v5 |
| Backend | Supabase (Auth + Postgres + RLS) |
| Build | EAS Build (Android) · Expo Web Export (Vercel) |
| Monorepo | npm workspaces |

---

## APK

APK (historical / Expo): https://expo.dev/accounts/beccio00/projects/jj-workout-tool/builds/04e946f6-f2de-4e1e-a55e-8dc337c0ec70

## Web App

Jedyna właściwa wersja produkcyjna: **https://stravio-kappa.vercel.app/**

(Inne aliasy Vercel nie są kanonem Jarvisa.)

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- [EAS CLI](https://docs.expo.dev/eas/) (`npm install -g eas-cli`)
- A [Supabase](https://supabase.com) project

### Setup

```bash
# 1. Clone and install
git clone https://github.com/Jurchesco/Jarvis.git
cd Jarvis
# lokalnie często: JJ-Workout-Tool/ (junction / clone)
npm install

# 2. Set up Supabase
#    - Create a new Supabase project
#    - Go to SQL Editor → paste and run supabase/schema.sql
#    - Go to Authentication → Providers → Email → disable "Confirm email"

# 3. Configure Supabase credentials
#    Copy apps/mobile/.env.example to apps/mobile/.env
#    and set EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

### Run Locally (Web)

```bash
npm run web -w apps/mobile
```

Open http://localhost:8081 in your browser.

### Run Locally (Device/Emulator)

```bash
npm run dev -w apps/mobile
```

### Build Android APK (v1 artifact)

```bash
eas build --platform android --profile preview
```

The APK will be saved in the current directory as `build-*.apk`.

### Build iOS Artifact

```bash
eas build --platform ios --profile production
```

Note: iOS builds require Apple credentials configured in EAS.

### Download Builds From Expo

After an EAS build finishes, artifacts are downloadable from the Expo dashboard:

1. Open your Expo project on expo.dev.
2. Go to Build and open the completed job.
3. Download artifacts:
  - Android preview profile -> APK
  - Android production profile -> AAB
  - iOS production profile -> IPA

You can also list and open build links from CLI:

```bash
eas build:list
```

### Publish Update via Expo

```bash
eas update --branch production --message "v1 release"
```

### Deploy to Vercel

```bash
# Option 1: Vercel CLI
npm install -g vercel
vercel --prod

# Option 2: Connect your GitHub repo to the Vercel Dashboard
# It will auto-detect vercel.json and build on every push
```

---

## Project Structure

```
Jarvis / JJ-Workout-Tool/
├── apps/
│   ├── mobile/              # Expo universal app (Android + Web)
│   │   ├── app/             # File-based routes (expo-router)
│   │   │   ├── (tabs)/      # Home (Freestyle | Plan), Historia, Stats, Ustawienia
│   │   │   ├── plans/       # Lista planów (stack)
│   │   │   ├── auth/        # Login & signup
│   │   │   ├── sheet/       # Edytor planu + start sesji
│   │   │   ├── workout/     # Aktywna sesja + summary
│   │   │   ├── history/     # Session history + detail
│   │   │   └── _layout.tsx  # Root layout (auth gate, providers)
│   │   └── src/
│   │       ├── api/         # Supabase API client + React Query hooks
│   │       ├── components/  # ExercisePicker, ExerciseLogForm, ui/*
│   │       ├── contexts/    # AuthContext
│   │       └── lib/         # ensureFreestyleSheet, saveExerciseLogBatch, …
├── packages/
│   ├── shared/              # Types + exerciseCatalog + workoutCalculations
│   └── react-native-worklets-stub/
├── supabase/
│   ├── schema.sql
│   └── functions/sync-sheets/
├── Scripts/import/          # jarvis_import → Google Sheets
├── docs/                    # Architecture, decisions, changelog, TODO, Jarvis
└── vercel.json
```

---

## Database Schema

The Supabase Postgres database has 7 tables:

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (role, display name) — role currently defaulted to `allievo` |
| `workout_sheets` | `"Freestyle"` (hidden) **and** named user plans |
| `exercises` | Exercises within a sheet |
| `exercise_sets` | Template sets (reps, weight, rest time) |
| `workout_sessions` | Actual workout logs |
| `session_set_logs` | What you actually did per set |
| `session_exercise_notes` | Notes per exercise during a session |

All tables have Row Level Security (RLS) policies ensuring users only access their own data.

---

## Screenshots

Place your app screenshots in `docs/screenshots/`:

| File | Screen |
|------|--------|
| `login.png` | Login screen |
| `signup.png` | Signup screen |
| `home.png` | Home (Freestyle \| Plan) |
| `sheet.png` | Plan editor |
| `workout.png` | Active workout session |
| `history.png` | History calendar view |
| `session.png` | Session detail review |

---

## Documentation

See **[docs/README.md](docs/README.md)** for the full index.

- [Jarvis ecosystem (PL)](docs/jarvis/ARCHITECTURE.md) — Data pipeline to Google Sheets + Hermes/Gem
- [Jarvis setup (PL)](docs/jarvis/SETUP.md) — Step-by-step configuration
- [**Plan naprawczy**](docs/jarvis/PLAN_NAPRAWCZY.md) — Audit remediation (task status)
- [Gem instructions (PL)](docs/jarvis/GEM_INSTRUKCJA.md) — System prompt (backup for Hermes)
- [Architecture](docs/jj-workout-tool/ARCHITECTURE.md) — App system design and data flow
- [Decisions](docs/jj-workout-tool/DECISIONS.md) — D001–D018
- [Changelog](docs/jj-workout-tool/CHANGELOG.md) — Version history
- [TODO](docs/jj-workout-tool/TODO.md) — App roadmap
- [Release Guide](docs/jj-workout-tool/RELEASE.md) — Build and publish flow for v1

## Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Open a pull request.

Example flow:

```bash
git checkout -b feat/my-change
git add .
git commit -m "feat: my change"
git push origin feat/my-change
```

## Versioning

This project follows Semantic Versioning.

- `v1.0.0`: first stable release
- `v1.0.1`: patch fixes
- `v1.1.0`: backward-compatible features
- `v2.0.0`: breaking changes

## License

This project is licensed under GNU Affero General Public License v3.0 (AGPL-3.0).
See [LICENSE](LICENSE).
