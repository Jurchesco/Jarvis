import type { JarvisBackupV1 } from "@bhmt3wp/shared";
import { summarizeBackup } from "@bhmt3wp/shared";
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

/**
 * Imports a backup as **new** rows (IDs remapped).
 * Does not delete existing data — safe merge / restore onto empty or existing account.
 */
export async function importJarvisBackup(backup: JarvisBackupV1): Promise<BackupImportResult> {
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

    const { error: sheetError } = await supabase.from("workout_sheets").insert({
      id: newSheetId,
      user_id: userId,
      name: sheet.name,
      description: sheet.description,
      order_index: sheet.orderIndex,
    });
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
    }
  }

  // Sessions that reference sheets not in this backup (orphan) are skipped.
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
        return row;
      })
      .filter((row): row is Record<string, unknown> => row != null);

    if (logPayload.length > 0) {
      // Chunk inserts to stay under PostgREST limits
      const CHUNK = 200;
      for (let i = 0; i < logPayload.length; i += CHUNK) {
        const chunk = logPayload.slice(i, i + CHUNK);
        const { error: logError } = await supabase.from("session_set_logs").insert(chunk);
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
