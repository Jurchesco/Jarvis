# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies (run from repo root)
npm install

# Start the app (Expo dev server — mobile + web)
npm run dev                          # or: npm run dev:mobile
npm run web -w apps/mobile           # web only at http://localhost:8081

# Run on device/emulator
npm run dev -w apps/mobile           # Expo Go / dev client
npm run android -w apps/mobile       # direct Android build
npm run ios -w apps/mobile           # direct iOS build

# EAS builds
eas build --platform android --profile preview   # APK
eas build --platform ios --profile production    # IPA
eas update --branch production --message "..."   # OTA update

# TypeScript check
npx tsc --noEmit -p apps/mobile/tsconfig.json
npx tsc --noEmit -p packages/shared/tsconfig.json
```

There are no automated tests in this project.

## Documentation

Use `./docs/*` as the canonical source for product/project documentation. Keep this file concise and avoid duplicating long-form content that already exists there.

**Live web (only):** https://stravio-kappa.vercel.app/ — ignore other Vercel aliases.

Product snapshot (2026-09-22): Home = Freestyle **or** catalog plan (`/plans`, D018). Set logging = **batch or per-set** (D016, on kappa). Stats = muscle set-volume (D019 §3). Coach = Hermes; Gem = backup (D017). Next backlog: rest timer overlay (D019).

**Cloud Agents / E2E:** see `AGENTS.md` — test account via env secrets `JJ_TEST_EMAIL` + `JJ_TEST_PASSWORD` (never commit passwords).

- `AGENTS.md` — Cloud Agent E2E + local Supabase notes
- `docs/README.md` — documentation index
- `docs/jj-workout-tool/ARCHITECTURE.md` — app architecture (Freestyle + plans + D016)
- `docs/jj-workout-tool/CHANGELOG.md` — release-by-release change history
- `docs/jj-workout-tool/DECISIONS.md` — D001–D019
- `docs/jj-workout-tool/RELEASE.md` — release process and checklist
- `docs/jj-workout-tool/TODO.md` — prioritized app roadmap
- `docs/jarvis/PLAN_NAPRAWCZY.md` — Jarvis ecosystem remediation plan
- `.cursor/rules/jarvis-canonical-app.mdc` — canonical URL + conflict rules for agents

## Environment Setup

Copy `apps/mobile/.env.example` to `apps/mobile/.env` and fill in:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `EXPO_PUBLIC_SUPABASE_ANON_KEY`)

In Supabase: run `supabase/schema.sql` in the SQL Editor, then disable "Confirm email" under Authentication → Providers → Email.