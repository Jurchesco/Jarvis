-- RIR / RPE per seria (opcjonalne). Skala zapamiętana na serii.
-- Uruchom w Supabase SQL Editor (lub jako migracja).

alter table public.session_set_logs
  add column if not exists effort_scale text
    check (effort_scale is null or effort_scale in ('rir', 'rpe'));

alter table public.session_set_logs
  add column if not exists effort_value double precision
    check (
      effort_value is null
      or (
        effort_scale = 'rir' and effort_value >= 0 and effort_value <= 10
      )
      or (
        effort_scale = 'rpe' and effort_value >= 1 and effort_value <= 10
      )
    );

comment on column public.session_set_logs.effort_scale is 'Optional effort scale: rir | rpe';
comment on column public.session_set_logs.effort_value is 'RIR 0–10 or RPE 1–10; null = not logged';
