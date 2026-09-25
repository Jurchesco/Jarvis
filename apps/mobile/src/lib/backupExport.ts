import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  isProgressionRule,
  type BackupBodyMeasurement,
  type BackupBodyProfile,
  type BackupExercise,
  type BackupExerciseProgression,
  type BackupGarminActivity,
  type BackupGarminDaily,
  type BackupGarminForma,
  type BackupGarminSleep,
  type BackupSession,
  type BackupSheet,
  type JarvisBackupV3,
  type ProgressionRule,
} from "@bhmt3wp/shared";
import { supabase } from "./supabase";

const PAGE = 1000;
const IN_CHUNK = 100;

async function getUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await fetchPage(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE) break;
    offset += PAGE;
  }
  return rows;
}

async function fetchInChunks<T>(
  ids: string[],
  fetchChunk: (
    chunk: string[],
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  if (ids.length === 0) return [];
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    const part = await fetchAllPages((from, to) => fetchChunk(chunk, from, to));
    rows.push(...part);
  }
  return rows;
}

async function fetchProfile(userId: string): Promise<BackupBodyProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, height_cm, sex, goal_weight_kg, birth_year")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    // Columns may not exist until body_and_health.sql is applied
    if (/column|does not exist/i.test(error.message)) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  return {
    displayName: (data.display_name as string | null) ?? null,
    heightCm: (data.height_cm as number | null) ?? null,
    sex:
      data.sex === "male" || data.sex === "female" || data.sex === "other"
        ? data.sex
        : null,
    goalWeightKg: (data.goal_weight_kg as number | null) ?? null,
    birthYear: (data.birth_year as number | null) ?? null,
  };
}

async function fetchBodyMeasurements(userId: string): Promise<BackupBodyMeasurement[]> {
  try {
    const rows = await fetchAllPages((from, to) =>
      supabase
        .from("body_measurements")
        .select("*")
        .eq("user_id", userId)
        .order("measured_at", { ascending: false })
        .range(from, to),
    );
    return rows.map((row) => ({
      measuredAt: row.measured_at as string,
      weightKg: Number(row.weight_kg),
      bodyFatPct: (row.body_fat_pct as number | null) ?? null,
      muscleMassKg: (row.muscle_mass_kg as number | null) ?? null,
      waterPct: (row.water_pct as number | null) ?? null,
      boneMassKg: (row.bone_mass_kg as number | null) ?? null,
      bmi: (row.bmi as number | null) ?? null,
      visceralFat: (row.visceral_fat as number | null) ?? null,
      bmr: (row.bmr as number | null) ?? null,
      lbmKg: (row.lbm_kg as number | null) ?? null,
      proteinPct: (row.protein_pct as number | null) ?? null,
      impedance: (row.impedance as number | null) ?? null,
      comment: (row.comment as string | null) ?? null,
      source: row.source === "openscale" ? "openscale" : "manual",
    }));
  } catch {
    return [];
  }
}

async function softFetchTable<T>(
  table: string,
  userId: string,
  map: (row: Record<string, unknown>) => T,
): Promise<T[]> {
  try {
    const rows = await fetchAllPages((from, to) =>
      supabase.from(table).select("*").eq("user_id", userId).range(from, to),
    );
    return rows.map((row) => map(row as Record<string, unknown>));
  } catch {
    return [];
  }
}

/** Builds a full local backup of the signed-in user's plans + history + body/Garmin. */
export async function buildJarvisBackup(): Promise<JarvisBackupV3> {
  const userId = await getUserId();

  const sheetRows = await fetchAllPages((from, to) =>
    supabase
      .from("workout_sheets")
      .select("*")
      .eq("user_id", userId)
      .order("order_index", { ascending: true })
      .range(from, to),
  );

  const sheetIds = sheetRows.map((row) => row.id as string);
  const exerciseRows = await fetchInChunks(sheetIds, (chunk, from, to) =>
    supabase.from("exercises").select("*").in("sheet_id", chunk).order("order_index").range(from, to),
  );

  const exerciseIds = exerciseRows.map((row) => row.id as string);
  const setRows = await fetchInChunks(exerciseIds, (chunk, from, to) =>
    supabase
      .from("exercise_sets")
      .select("*")
      .in("exercise_id", chunk)
      .order("set_number")
      .range(from, to),
  );

  let progressionByExercise = new Map<string, BackupExerciseProgression>();
  if (exerciseIds.length > 0) {
    try {
      const progRows = await fetchInChunks(exerciseIds, (chunk, from, to) =>
        supabase.from("exercise_progression").select("*").in("exercise_id", chunk).range(from, to),
      );
      for (const row of progRows) {
        if (!isProgressionRule(row.rule)) continue;
        progressionByExercise.set(row.exercise_id as string, {
          rule: row.rule as ProgressionRule,
          stepKg: row.step_kg != null ? Number(row.step_kg) : null,
          repsMin: row.reps_min != null ? Number(row.reps_min) : null,
          repsMax: row.reps_max != null ? Number(row.reps_max) : null,
          stepSec: row.step_sec != null ? Number(row.step_sec) : null,
          greyskullAmrapBonus:
            row.greyskull_amrap_bonus != null ? Number(row.greyskull_amrap_bonus) : null,
        });
      }
    } catch {
      progressionByExercise = new Map();
    }
  }

  const setsByExercise = new Map<string, typeof setRows>();
  for (const set of setRows) {
    const list = setsByExercise.get(set.exercise_id as string) ?? [];
    list.push(set);
    setsByExercise.set(set.exercise_id as string, list);
  }

  const exercisesBySheet = new Map<string, BackupExercise[]>();
  for (const ex of exerciseRows) {
    const sets = (setsByExercise.get(ex.id as string) ?? []).map((set) => ({
      setNumber: set.set_number as number,
      reps: set.reps as number,
      weightKg: Number(set.weight_kg ?? 0),
      restTimeSec: set.rest_time_sec as number,
    }));
    const progression = progressionByExercise.get(ex.id as string) ?? null;
    const backupEx: BackupExercise = {
      id: ex.id as string,
      name: ex.name as string,
      notes: (ex.notes as string | null) ?? null,
      orderIndex: ex.order_index as number,
      sets,
      progression,
    };
    const list = exercisesBySheet.get(ex.sheet_id as string) ?? [];
    list.push(backupEx);
    exercisesBySheet.set(ex.sheet_id as string, list);
  }

  const sheets: BackupSheet[] = sheetRows.map((row) => {
    const rule = row.default_progression_rule;
    return {
      id: row.id as string,
      name: row.name as string,
      description: (row.description as string | null) ?? null,
      orderIndex: row.order_index as number,
      exercises: exercisesBySheet.get(row.id as string) ?? [],
      defaultProgressionRule: isProgressionRule(rule) ? rule : null,
      progressionDeload: row.progression_deload === true,
    };
  });

  const sessionRows = await fetchAllPages((from, to) =>
    supabase
      .from("workout_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .range(from, to),
  );

  const sessionIds = sessionRows.map((row) => row.id as string);
  const logRows = await fetchInChunks(sessionIds, (chunk, from, to) =>
    supabase
      .from("session_set_logs")
      .select("*")
      .in("session_id", chunk)
      .order("completed_at")
      .range(from, to),
  );

  const noteRows = await fetchInChunks(sessionIds, (chunk, from, to) =>
    supabase.from("session_exercise_notes").select("*").in("session_id", chunk).range(from, to),
  );

  const logsBySession = new Map<string, typeof logRows>();
  for (const log of logRows) {
    const list = logsBySession.get(log.session_id as string) ?? [];
    list.push(log);
    logsBySession.set(log.session_id as string, list);
  }

  const notesBySession = new Map<string, typeof noteRows>();
  for (const note of noteRows) {
    const list = notesBySession.get(note.session_id as string) ?? [];
    list.push(note);
    notesBySession.set(note.session_id as string, list);
  }

  const sessions: BackupSession[] = sessionRows.map((row) => {
    const logs = (logsBySession.get(row.id as string) ?? []).map((log) => ({
      exerciseId: log.exercise_id as string,
      setNumber: log.set_number as number,
      reps: log.reps as number,
      weightKg: Number(log.weight_kg ?? 0),
      completedAt: log.completed_at as string,
      effortScale:
        log.effort_scale === "rir" || log.effort_scale === "rpe" ? log.effort_scale : null,
      effortValue:
        log.effort_value != null && Number.isFinite(Number(log.effort_value))
          ? Number(log.effort_value)
          : null,
      isWarmup: log.is_warmup === true,
    }));
    const exerciseNotes = (notesBySession.get(row.id as string) ?? []).map((note) => ({
      exerciseId: note.exercise_id as string,
      notes: note.notes as string,
    }));
    return {
      id: row.id as string,
      sheetId: row.sheet_id as string,
      startedAt: row.started_at as string,
      completedAt: (row.completed_at as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
      logs,
      exerciseNotes,
    };
  });

  const [profile, bodyMeasurements, garminDaily, garminSleep, garminForma, garminActivities] =
    await Promise.all([
      fetchProfile(userId),
      fetchBodyMeasurements(userId),
      softFetchTable<BackupGarminDaily>("garmin_daily_stats", userId, (row) => ({
        day: String(row.day),
        totalSteps: (row.total_steps as number | null) ?? null,
        totalKilocalories: (row.total_kilocalories as number | null) ?? null,
        activeKilocalories: (row.active_kilocalories as number | null) ?? null,
        restingHeartRate: (row.resting_heart_rate as number | null) ?? null,
        averageStress: (row.average_stress as number | null) ?? null,
        bodyBatteryWake: (row.body_battery_wake as number | null) ?? null,
        bodyBatteryHigh: (row.body_battery_high as number | null) ?? null,
        bodyBatteryLow: (row.body_battery_low as number | null) ?? null,
      })),
      softFetchTable<BackupGarminSleep>("garmin_sleep_days", userId, (row) => ({
        day: String(row.day),
        sleepMinutes: (row.sleep_minutes as number | null) ?? null,
        sleepScore: (row.sleep_score as number | null) ?? null,
        deepMinutes: (row.deep_minutes as number | null) ?? null,
        lightMinutes: (row.light_minutes as number | null) ?? null,
        remMinutes: (row.rem_minutes as number | null) ?? null,
        awakeMinutes: (row.awake_minutes as number | null) ?? null,
        hrvLastNightAvg: (row.hrv_last_night_avg as number | null) ?? null,
        hasData: Boolean(row.has_data ?? true),
      })),
      softFetchTable<BackupGarminForma>("garmin_forma_days", userId, (row) => ({
        day: String(row.day),
        hrvLastNightAvg: (row.hrv_last_night_avg as number | null) ?? null,
        hrvStatus: (row.hrv_status as string | null) ?? null,
        restingHeartRate: (row.resting_heart_rate as number | null) ?? null,
        bodyBatteryWake: (row.body_battery_wake as number | null) ?? null,
        averageStress: (row.average_stress as number | null) ?? null,
      })),
      softFetchTable<BackupGarminActivity>("garmin_activities", userId, (row) => ({
        activityId: String(row.activity_id),
        startedAt: (row.started_at as string | null) ?? null,
        activityType: (row.activity_type as string | null) ?? null,
        activityName: (row.activity_name as string | null) ?? null,
        durationSec: (row.duration_sec as number | null) ?? null,
        distanceM: (row.distance_m as number | null) ?? null,
        calories: (row.calories as number | null) ?? null,
      })),
    ]);

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    sheets,
    sessions,
    profile,
    bodyMeasurements,
    garminDaily,
    garminSleep,
    garminForma,
    garminActivities,
  };
}

