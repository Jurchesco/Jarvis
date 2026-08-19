# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
`jj-workout-tool` is an npm-workspaces monorepo. The product is the **Expo universal app** in `apps/mobile` (React Native 0.76 / Expo 52, runs on web + Android/iOS) backed by **Supabase** (Auth + Postgres + RLS). `packages/shared` is source-only TS types. `Scripts/import` (Python "Jarvis" pipeline) and `supabase/functions/sync-sheets` (Deno) are optional/personal integrations that need external Google/Garmin credentials — not needed to run or test the app.

### Standard commands (already documented)
Dependency install, run, and build commands live in `README.md` and `CLAUDE.md`. In short: `npm install` at the repo root, `npm run web -w apps/mobile` (web on http://localhost:8081), and typecheck via `npx tsc --noEmit -p apps/mobile/tsconfig.json` / `-p packages/shared/tsconfig.json`. There are **no automated tests** in this project.

### Backend: use a LOCAL Supabase stack for end-to-end testing (non-obvious)
The committed `apps/mobile/.env.example` and `eas.json` point at a **hosted** Supabase project. That hosted project has **email confirmation enabled**, so you cannot complete a new-account signup → login → log-a-workout flow against it (no mailbox access). For real end-to-end testing, run a local Supabase stack, which has email confirmation disabled by default.

Local bring-up (Docker + Supabase CLI are pre-installed in the environment snapshot):
1. Start the Docker daemon (no systemd here): run `sudo dockerd` in a background/tmux session, then `sudo chmod 666 /var/run/docker.sock` if the socket is root-only. The daemon is configured for `fuse-overlayfs` with `containerd-snapshotter` disabled (required for Docker 29) in `/etc/docker/daemon.json`.
2. Start Supabase from a scratch dir outside the repo (the committed `supabase/config.toml` is edge-function-only and is NOT a full local config): `cd ~/local-supabase && supabase start`. This prints the API URL (`http://127.0.0.1:54321`), Studio (`http://127.0.0.1:54323`), DB port `54322`, and keys. Local keys are the fixed Supabase demo defaults, e.g. publishable key `sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH`.
3. Apply the schema to the local DB (container name starts with `supabase_db_`), in this order: `supabase/schema.sql`, `supabase/migration_workout_sheets_order_index.sql`, `supabase/security_hardening_2026-03-23.sql`. Example: `docker exec -i <db_container> psql -U postgres -d postgres < supabase/schema.sql`.
4. **GRANTS GOTCHA:** the local stack's default privileges on the `public` schema only grant `TRUNCATE/REFERENCES/TRIGGER` (not `SELECT/INSERT/UPDATE/DELETE`) to `anon`/`authenticated`, so the app fails with `permission denied for table workout_sheets` right after login. `schema.sql` has no explicit grants (the hosted project already has the full DML grants). After applying the schema, run against the local DB:
   ```sql
   grant usage on schema public to anon, authenticated, service_role;
   grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
   grant usage, select on all sequences in schema public to anon, authenticated, service_role;
   alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
   alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;
   ```
   RLS is still enabled, so per-row access is still enforced by the policies in `schema.sql`.
5. Point the app at the local stack via `apps/mobile/.env` (gitignored; copy from `.env.example` and override), then start the dev server:
   ```
   EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
   ```

### Run/restart notes
- Expo reads `.env` **at startup** — after editing `apps/mobile/.env`, stop and restart `npm run web -w apps/mobile` for changes to take effect.
- The web app runs in the browser and talks to `http://127.0.0.1:54321`; keep the local Supabase stack running while testing.
- For UI-only checks (rendering, navigation before auth) you can leave `.env` pointed at the hosted project, but new-account signup/login will be blocked by email confirmation.
