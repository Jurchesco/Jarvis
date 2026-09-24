-- ============================================
-- Body profile + health journal (openScale / Garmin)
-- Run in Supabase SQL Editor after schema.sql
-- Supabase = source of truth; Sheets stays a mirror.
-- ============================================

-- Profiles: optional anthropometrics for AI / context
alter table public.profiles
  add column if not exists height_cm double precision
    check (height_cm is null or (height_cm >= 50 and height_cm <= 300));

alter table public.profiles
  add column if not exists sex text
    check (sex is null or sex in ('male', 'female', 'other'));

alter table public.profiles
  add column if not exists goal_weight_kg double precision
    check (goal_weight_kg is null or (goal_weight_kg >= 20 and goal_weight_kg <= 400));

alter table public.profiles
  add column if not exists birth_year integer
    check (birth_year is null or (birth_year >= 1920 and birth_year <= 2100));

comment on column public.profiles.height_cm is 'Height in cm for BMI / coach context';
comment on column public.profiles.sex is 'male | female | other — optional';
comment on column public.profiles.goal_weight_kg is 'Target body weight kg';
comment on column public.profiles.birth_year is 'Approximate age for BMR context';

-- Allow users to insert their own profile row (edge cases / repair)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'Users can insert own profile'
  ) then
    create policy "Users can insert own profile"
      on public.profiles for insert
      with check (auth.uid() = id);
  end if;
end $$;

-- ============================================
-- Body measurements (manual + openScale import)
-- ============================================
create table if not exists public.body_measurements (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  measured_at     timestamptz not null,
  weight_kg       double precision not null
    check (weight_kg > 0 and weight_kg < 500),
  body_fat_pct    double precision,
  muscle_mass_kg  double precision,
  water_pct       double precision,
  bone_mass_kg    double precision,
  bmi             double precision,
  visceral_fat    double precision,
  bmr             double precision,
  lbm_kg          double precision,
  protein_pct     double precision,
  impedance       double precision,
  comment         text,
  source          text not null default 'manual'
    check (source in ('manual', 'openscale')),
  created_at      timestamptz not null default now(),
  unique (user_id, measured_at, source)
);

create index if not exists idx_body_measurements_user_time
  on public.body_measurements(user_id, measured_at desc);

alter table public.body_measurements enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'body_measurements' and policyname = 'Users can view own body measurements'
  ) then
    create policy "Users can view own body measurements"
      on public.body_measurements for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'body_measurements' and policyname = 'Users can insert own body measurements'
  ) then
    create policy "Users can insert own body measurements"
      on public.body_measurements for insert with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'body_measurements' and policyname = 'Users can update own body measurements'
  ) then
    create policy "Users can update own body measurements"
      on public.body_measurements for update using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'body_measurements' and policyname = 'Users can delete own body measurements'
  ) then
    create policy "Users can delete own body measurements"
      on public.body_measurements for delete using (auth.uid() = user_id);
  end if;
end $$;

-- ============================================
-- Garmin daily stats (Dzien)
-- ============================================
create table if not exists public.garmin_daily_stats (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references auth.users(id) on delete cascade,
  day                         date not null,
  total_steps                 integer,
  total_kilocalories          integer,
  active_kilocalories         integer,
  bmr_kilocalories            integer,
  average_stress              integer,
  max_stress                  integer,
  resting_heart_rate          integer,
  body_battery_wake           integer,
  body_battery_high           integer,
  body_battery_low            integer,
  moderate_intensity_min      integer,
  vigorous_intensity_min      integer,
  min_heart_rate              integer,
  min_avg_heart_rate          integer,
  max_heart_rate              integer,
  average_spo2                double precision,
  lowest_spo2                 double precision,
  avg_waking_respiration      double precision,
  lowest_respiration          double precision,
  note                        text,
  imported_at                 timestamptz not null default now(),
  unique (user_id, day)
);

create index if not exists idx_garmin_daily_user_day
  on public.garmin_daily_stats(user_id, day desc);

alter table public.garmin_daily_stats enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'garmin_daily_stats' and policyname = 'Users can view own garmin daily'
  ) then
    create policy "Users can view own garmin daily"
      on public.garmin_daily_stats for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'garmin_daily_stats' and policyname = 'Users can insert own garmin daily'
  ) then
    create policy "Users can insert own garmin daily"
      on public.garmin_daily_stats for insert with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'garmin_daily_stats' and policyname = 'Users can update own garmin daily'
  ) then
    create policy "Users can update own garmin daily"
      on public.garmin_daily_stats for update using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'garmin_daily_stats' and policyname = 'Users can delete own garmin daily'
  ) then
    create policy "Users can delete own garmin daily"
      on public.garmin_daily_stats for delete using (auth.uid() = user_id);
  end if;
end $$;

-- ============================================
-- Garmin sleep (Sen) — numeric core + raw JSON for extras
-- ============================================
create table if not exists public.garmin_sleep_days (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  day                     date not null,
  sleep_window            text,
  sleep_minutes           integer,
  time_in_bed_minutes     integer,
  sleep_score             integer,
  sleep_qualifier         text,
  deep_minutes            integer,
  light_minutes           integer,
  rem_minutes             integer,
  awake_minutes           integer,
  awake_count             integer,
  restless_moments        integer,
  average_stress          integer,
  avg_sleep_hr            integer,
  resting_hr              integer,
  avg_respiration         double precision,
  lowest_respiration      double precision,
  hrv_last_night_avg      double precision,
  hrv_status              text,
  hrv_weekly_avg          double precision,
  hrv_last_night_5min_high double precision,
  body_battery_wake       integer,
  body_battery_low        integer,
  body_battery_during_sleep integer,
  has_data                boolean not null default true,
  note                    text,
  imported_at             timestamptz not null default now(),
  unique (user_id, day)
);

create index if not exists idx_garmin_sleep_user_day
  on public.garmin_sleep_days(user_id, day desc);

alter table public.garmin_sleep_days enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'garmin_sleep_days' and policyname = 'Users can view own garmin sleep'
  ) then
    create policy "Users can view own garmin sleep"
      on public.garmin_sleep_days for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'garmin_sleep_days' and policyname = 'Users can insert own garmin sleep'
  ) then
    create policy "Users can insert own garmin sleep"
      on public.garmin_sleep_days for insert with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'garmin_sleep_days' and policyname = 'Users can update own garmin sleep'
  ) then
    create policy "Users can update own garmin sleep"
      on public.garmin_sleep_days for update using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'garmin_sleep_days' and policyname = 'Users can delete own garmin sleep'
  ) then
    create policy "Users can delete own garmin sleep"
      on public.garmin_sleep_days for delete using (auth.uid() = user_id);
  end if;
end $$;

-- ============================================
-- Garmin forma / HRV readiness (Forma)
-- ============================================
create table if not exists public.garmin_forma_days (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  day                     date not null,
  hrv_last_night_avg      double precision,
  hrv_weekly_avg          double precision,
  hrv_status              text,
  hrv_baseline_low        double precision,
  hrv_baseline_high       double precision,
  resting_heart_rate      integer,
  resting_hr_7d_avg       integer,
  body_battery_wake       integer,
  average_stress          integer,
  active_kilocalories     integer,
  moderate_intensity_min  integer,
  vigorous_intensity_min  integer,
  note                    text,
  imported_at             timestamptz not null default now(),
  unique (user_id, day)
);

create index if not exists idx_garmin_forma_user_day
  on public.garmin_forma_days(user_id, day desc);

alter table public.garmin_forma_days enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'garmin_forma_days' and policyname = 'Users can view own garmin forma'
  ) then
    create policy "Users can view own garmin forma"
      on public.garmin_forma_days for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'garmin_forma_days' and policyname = 'Users can insert own garmin forma'
  ) then
    create policy "Users can insert own garmin forma"
      on public.garmin_forma_days for insert with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'garmin_forma_days' and policyname = 'Users can update own garmin forma'
  ) then
    create policy "Users can update own garmin forma"
      on public.garmin_forma_days for update using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'garmin_forma_days' and policyname = 'Users can delete own garmin forma'
  ) then
    create policy "Users can delete own garmin forma"
      on public.garmin_forma_days for delete using (auth.uid() = user_id);
  end if;
end $$;

-- ============================================
-- Garmin activities (Aktywnosci)
-- ============================================
create table if not exists public.garmin_activities (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  activity_id           text not null,
  started_at            timestamptz,
  activity_type         text,
  activity_name         text,
  duration_sec          integer,
  distance_m            double precision,
  calories              integer,
  elevation_gain_m      double precision,
  elevation_loss_m      double precision,
  avg_hr                integer,
  max_hr                integer,
  min_hr                integer,
  avg_speed_mps         double precision,
  max_speed_mps         double precision,
  training_effect_aerobic double precision,
  training_effect_anaerobic double precision,
  training_load         integer,
  vo2_max               double precision,
  device_label          text,
  note                  text,
  raw                   jsonb,
  imported_at           timestamptz not null default now(),
  unique (user_id, activity_id)
);

create index if not exists idx_garmin_activities_user_time
  on public.garmin_activities(user_id, started_at desc);

alter table public.garmin_activities enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'garmin_activities' and policyname = 'Users can view own garmin activities'
  ) then
    create policy "Users can view own garmin activities"
      on public.garmin_activities for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'garmin_activities' and policyname = 'Users can insert own garmin activities'
  ) then
    create policy "Users can insert own garmin activities"
      on public.garmin_activities for insert with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'garmin_activities' and policyname = 'Users can update own garmin activities'
  ) then
    create policy "Users can update own garmin activities"
      on public.garmin_activities for update using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'garmin_activities' and policyname = 'Users can delete own garmin activities'
  ) then
    create policy "Users can delete own garmin activities"
      on public.garmin_activities for delete using (auth.uid() = user_id);
  end if;
end $$;
