-- D021 complete: warm-up flag + progression rules in Postgres (sync across devices).
-- Run in Supabase SQL Editor after body_and_health / effort migrations.

-- ---------------------------------------------------------------------------
-- 1. Warm-up sets (excluded from progression + Est. 1RM / PR weight)
-- ---------------------------------------------------------------------------
alter table public.session_set_logs
  add column if not exists is_warmup boolean not null default false;

comment on column public.session_set_logs.is_warmup is
  'Warm-up set — excluded from progression targets and Est. 1RM / PR calculations';

-- ---------------------------------------------------------------------------
-- 2. Sheet-level progression defaults
-- ---------------------------------------------------------------------------
alter table public.workout_sheets
  add column if not exists default_progression_rule text;

alter table public.workout_sheets
  add column if not exists progression_deload boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'workout_sheets_default_progression_rule_check'
  ) then
    alter table public.workout_sheets
      add constraint workout_sheets_default_progression_rule_check
      check (
        default_progression_rule is null
        or default_progression_rule in ('none', 'linear', 'double', 'greyskull', 'time')
      );
  end if;
end $$;

update public.workout_sheets
set default_progression_rule = 'linear'
where default_progression_rule is null;

comment on column public.workout_sheets.default_progression_rule is
  'D021 default progression rule for exercises on this plan';
comment on column public.workout_sheets.progression_deload is
  'D021 planned deload week — no auto-advance';

-- ---------------------------------------------------------------------------
-- 3. Per-exercise progression overrides
-- ---------------------------------------------------------------------------
create table if not exists public.exercise_progression (
  exercise_id uuid primary key references public.exercises(id) on delete cascade,
  rule text not null
    check (rule in ('none', 'linear', 'double', 'greyskull', 'time')),
  step_kg double precision,
  reps_min integer,
  reps_max integer,
  step_sec integer,
  greyskull_amrap_bonus integer,
  updated_at timestamptz not null default now()
);

create index if not exists idx_exercise_progression_rule
  on public.exercise_progression (rule);

alter table public.exercise_progression enable row level security;

drop policy if exists "Users can view own exercise progression" on public.exercise_progression;
create policy "Users can view own exercise progression"
  on public.exercise_progression for select
  using (
    exists (
      select 1
      from public.exercises e
      join public.workout_sheets ws on ws.id = e.sheet_id
      where e.id = exercise_id and ws.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own exercise progression" on public.exercise_progression;
create policy "Users can insert own exercise progression"
  on public.exercise_progression for insert
  with check (
    exists (
      select 1
      from public.exercises e
      join public.workout_sheets ws on ws.id = e.sheet_id
      where e.id = exercise_id and ws.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update own exercise progression" on public.exercise_progression;
create policy "Users can update own exercise progression"
  on public.exercise_progression for update
  using (
    exists (
      select 1
      from public.exercises e
      join public.workout_sheets ws on ws.id = e.sheet_id
      where e.id = exercise_id and ws.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete own exercise progression" on public.exercise_progression;
create policy "Users can delete own exercise progression"
  on public.exercise_progression for delete
  using (
    exists (
      select 1
      from public.exercises e
      join public.workout_sheets ws on ws.id = e.sheet_id
      where e.id = exercise_id and ws.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.exercise_progression to authenticated;
grant select, insert, update, delete on public.exercise_progression to service_role;
