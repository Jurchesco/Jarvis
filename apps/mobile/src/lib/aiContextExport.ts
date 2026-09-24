import {
  AI_CONTEXT_ALLOWLIST,
  buildAiContextCsv,
  buildAiContextJson,
  type AiContextAllowlistKey,
  type AiContextBundle,
  type AiContextOptions,
} from "@bhmt3wp/shared";
import { supabase } from "./supabase";

function sinceIso(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - Math.max(1, days) + 1);
  return d.toISOString();
}

function sinceDay(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - Math.max(1, days) + 1);
  return d.toISOString().slice(0, 10);
}

async function requireUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

async function softQuery(run: () => PromiseLike<{
  data: Record<string, unknown>[] | null;
  error: { message: string } | null;
}>): Promise<Record<string, unknown>[]> {
  try {
    const { data, error } = await run();
    if (error) {
      if (/relation|does not exist|column/i.test(error.message)) return [];
      throw new Error(error.message);
    }
    return data ?? [];
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (/relation|does not exist|column/i.test(msg)) return [];
    throw error;
  }
}

/** Builds allowlisted AI context for the last N days. */
export async function buildAiContextBundle(
  options: Partial<AiContextOptions> = {},
): Promise<AiContextBundle> {
  const days = options.days ?? 30;
  const include: AiContextAllowlistKey[] = options.include?.length
    ? options.include
    : [...AI_CONTEXT_ALLOWLIST];
  const userId = await requireUserId();
  const fromIso = sinceIso(days);
  const fromDay = sinceDay(days);

  const bundle: AiContextBundle = {
    exportedAt: new Date().toISOString(),
    days,
    include,
  };

  if (include.includes("profile")) {
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, height_cm, sex, goal_weight_kg, birth_year")
      .eq("id", userId)
      .maybeSingle();
    if (!error && data) {
      bundle.profile = {
        display_name: data.display_name,
        height_cm: data.height_cm,
        sex: data.sex,
        goal_weight_kg: data.goal_weight_kg,
        birth_year: data.birth_year,
      };
    } else {
      bundle.profile = null;
    }
  }

  if (include.includes("bodyweight")) {
    bundle.bodyMeasurements = await softQuery(() =>
      supabase
        .from("body_measurements")
        .select("measured_at, weight_kg, body_fat_pct, muscle_mass_kg, water_pct, bmi, source")
        .eq("user_id", userId)
        .gte("measured_at", fromIso)
        .order("measured_at", { ascending: false }),
    );
  }

  if (include.includes("training")) {
    const sessions = await softQuery(() =>
      supabase
        .from("workout_sessions")
        .select("id, started_at, completed_at, notes, sheet_id")
        .eq("user_id", userId)
        .gte("started_at", fromIso)
        .order("started_at", { ascending: false }),
    );
    const sessionIds = sessions.map((s) => String(s.id));
    let logs: Record<string, unknown>[] = [];
    if (sessionIds.length) {
      const { data } = await supabase
        .from("session_set_logs")
        .select(
          "session_id, exercise_id, set_number, reps, weight_kg, completed_at, effort_scale, effort_value",
        )
        .in("session_id", sessionIds.slice(0, 200))
        .order("completed_at");
      logs = (data as Record<string, unknown>[] | null) ?? [];
    }
    bundle.sessions = sessions.map((s) => ({
      ...s,
      sets: logs.filter((l) => l.session_id === s.id).length,
    }));
  }

  if (include.includes("sleep")) {
    bundle.sleep = await softQuery(() =>
      supabase
        .from("garmin_sleep_days")
        .select(
          "day, sleep_minutes, sleep_score, deep_minutes, light_minutes, rem_minutes, awake_minutes, hrv_last_night_avg, has_data",
        )
        .eq("user_id", userId)
        .gte("day", fromDay)
        .order("day", { ascending: false }),
    );
  }

  if (include.includes("daily")) {
    bundle.daily = await softQuery(() =>
      supabase
        .from("garmin_daily_stats")
        .select(
          "day, total_steps, total_kilocalories, active_kilocalories, resting_heart_rate, average_stress, body_battery_wake, body_battery_high, body_battery_low",
        )
        .eq("user_id", userId)
        .gte("day", fromDay)
        .order("day", { ascending: false }),
    );
  }

  if (include.includes("forma")) {
    bundle.forma = await softQuery(() =>
      supabase
        .from("garmin_forma_days")
        .select(
          "day, hrv_last_night_avg, hrv_status, resting_heart_rate, body_battery_wake, average_stress",
        )
        .eq("user_id", userId)
        .gte("day", fromDay)
        .order("day", { ascending: false }),
    );
  }

  if (include.includes("activities")) {
    bundle.activities = await softQuery(() =>
      supabase
        .from("garmin_activities")
        .select(
          "activity_id, started_at, activity_type, activity_name, duration_sec, distance_m, calories",
        )
        .eq("user_id", userId)
        .gte("started_at", fromIso)
        .order("started_at", { ascending: false }),
    );
  }

  return bundle;
}

export async function exportAiContextFile(
  options: Partial<AiContextOptions> = {},
  format: "csv" | "json" = "csv",
): Promise<{ content: string; filename: string; mime: string }> {
  const bundle = await buildAiContextBundle(options);
  const day = bundle.exportedAt.slice(0, 10);
  if (format === "json") {
    return {
      content: buildAiContextJson(bundle),
      filename: `jarvis-ai-context-${day}.json`,
      mime: "application/json",
    };
  }
  return {
    content: buildAiContextCsv(bundle),
    filename: `jarvis-ai-context-${day}.csv`,
    mime: "text/csv;charset=utf-8",
  };
}
