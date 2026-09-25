import type { JarvisBackup } from "@bhmt3wp/shared";
import { isProgressionRule, summarizeBackup } from "@bhmt3wp/shared";
import { supabase } from "./supabase";

export type BackupImportResult = {
  sheetsCreated: number;
  exercisesCreated: number;
  sessionsCreated: number;
  logsCreated: number;
  summary: ReturnType<typeof summarizeBackup>;
};

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function getUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

function isSchemaMissingError(message: string): boolean {
  return /relation|does not exist|column|schema cache/i.test(message);
}

/**
 * Imports a backup as **new** rows (IDs remapped).
 * Does not delete existing data — safe merge / restore onto empty or existing account.
 */
export async function importJarvisBackup(backup: JarvisBackup): Promise<BackupImportResult> {
  const userId = await getUserId();
  const summary = summarizeBackup(backup);

  const sheetIdMap = new Map<string, string>();
  const exerciseIdMap = new Map<string, string>();

  let sheetsCreated = 0;
  let exercisesCreated = 0;
  let sessionsCreated = 0;
  let logsCreated = 0;

  const sortedSheets = [...backup.sheets].sort((a, b) => a.orderIndex - b.orderIndex);

  for (const sheet of sortedSheets) {
    const newSheetId = newId();
    sheetIdMap.set(sheet.id, newSheetId);

    const sheetPayload: Record<string, unknown> = {
      id: newSheetId,
      user_id: userId,
      name: sheet.name,
      description: sheet.description,
      order_index: sheet.orderIndex,
    };
    if (isProgressionRule(sheet.defaultProgressionRule)) {
      sheetPayload.default_progression_rule = sheet.defaultProgressionRule;
    }
    if (typeof sheet.progressionDeload === "boolean") {
      sheetPayload.progression_deload = sheet.progressionDeload;
    }

    let { error: sheetError } = await supabase.from("workout_sheets").insert(sheetPayload);
    if (sheetError && isSchemaMissingError(sheetError.message)) {
      delete sheetPayload.default_progression_rule;
      delete sheetPayload.progression_deload;
      ({ error: sheetError } = await supabase.from("workout_sheets").insert(sheetPayload));
    }
    if (sheetError) throw new Error(`Plan „${sheet.name}”: ${sheetError.message}`);
    sheetsCreated += 1;

    const sortedExercises = [...sheet.exercises].sort((a, b) => a.orderIndex - b.orderIndex);
    for (const exercise of sortedExercises) {
      const newExerciseId = newId();
      exerciseIdMap.set(exercise.id, newExerciseId);

      const { error: exError } = await supabase.from("exercises").insert({
        id: newExerciseId,
        sheet_id: newSheetId,
        name: exercise.name,
        notes: exercise.notes,
        order_index: exercise.orderIndex,
      });
      if (exError) throw new Error(`Ćwiczenie „${exercise.name}”: ${exError.message}`);
      exercisesCreated += 1;

      if (exercise.sets.length > 0) {
        const setPayload = exercise.sets.map((set) => ({
          exercise_id: newExerciseId,
          set_number: set.setNumber,
          reps: set.reps,
          weight_kg: set.weightKg,
          rest_time_sec: set.restTimeSec,
        }));
        const { error: setError } = await supabase.from("exercise_sets").insert(setPayload);
        if (setError) throw new Error(`Serie „${exercise.name}”: ${setError.message}`);
      }

      if (exercise.progression && isProgressionRule(exercise.progression.rule)) {
        const { error: progError } = await supabase.from("exercise_progression").upsert({
          exercise_id: newExerciseId,
          rule: exercise.progression.rule,
          step_kg: exercise.progression.stepKg ?? null,
          reps_min: exercise.progression.repsMin ?? null,
          reps_max: exercise.progression.repsMax ?? null,
          step_sec: exercise.progression.stepSec ?? null,
          greyskull_amrap_bonus: exercise.progression.greyskullAmrapBonus ?? null,
          updated_at: new Date().toISOString(),
        });
        if (progError && !isSchemaMissingError(progError.message)) {
          throw new Error(`Progresja „${exercise.name}”: ${progError.message}`);
        }
      }
    }
  }

  for (const session of backup.sessions) {
    const mappedSheetId = sheetIdMap.get(session.sheetId);
    if (!mappedSheetId) continue;

    const newSessionId = newId();
    const { error: sessionError } = await supabase.from("workout_sessions").insert({
      id: newSessionId,
      user_id: userId,
      sheet_id: mappedSheetId,
      started_at: session.startedAt,
      completed_at: session.completedAt,
      notes: session.notes,
    });
    if (sessionError) throw new Error(`Sesja: ${sessionError.message}`);
    sessionsCreated += 1;

    const logPayload = session.logs
      .map((log) => {
        const mappedExerciseId = exerciseIdMap.get(log.exerciseId);
        if (!mappedExerciseId) return null;
        const row: Record<string, unknown> = {
          session_id: newSessionId,
          exercise_id: mappedExerciseId,
          set_number: log.setNumber,
          reps: log.reps,
          weight_kg: log.weightKg,
          completed_at: log.completedAt,
        };
        if (log.effortScale === "rir" || log.effortScale === "rpe") {
          row.effort_scale = log.effortScale;
          row.effort_value =
            log.effortValue != null && Number.isFinite(log.effortValue) ? log.effortValue : null;
        }
        if (log.isWarmup === true) {
          row.is_warmup = true;
        }
        return row;
      })
      .filter((row): row is Record<string, unknown> => row != null);

    if (logPayload.length > 0) {
      const CHUNK = 200;
      for (let i = 0; i < logPayload.length; i += CHUNK) {
        const chunk = logPayload.slice(i, i + CHUNK);
        let { error: logError } = await supabase.from("session_set_logs").insert(chunk);
        if (logError && isSchemaMissingError(logError.message)) {
          const stripped = chunk.map((row) => {
            const next = { ...row };
            delete next.is_warmup;
            return next;
          });
          ({ error: logError } = await supabase.from("session_set_logs").insert(stripped));
        }
        if (logError) throw new Error(`Serie sesji: ${logError.message}`);
        logsCreated += chunk.length;
      }
    }

    const notePayload = session.exerciseNotes
      .map((note) => {
        const mappedExerciseId = exerciseIdMap.get(note.exerciseId);
        if (!mappedExerciseId || !note.notes?.trim()) return null;
        return {
          session_id: newSessionId,
          exercise_id: mappedExerciseId,
          notes: note.notes,
        };
      })
      .filter((row): row is { session_id: string; exercise_id: string; notes: string } => row != null);

    if (notePayload.length > 0) {
      const { error: noteError } = await supabase.from("session_exercise_notes").insert(notePayload);
      if (noteError) throw new Error(`Notatki: ${noteError.message}`);
    }
  }

  return {
    sheetsCreated,
    exercisesCreated,
    sessionsCreated,
    logsCreated,
    summary,
  };
}
