import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type BackupExercise,
  type BackupSession,
  type BackupSheet,
  type JarvisBackupV1,
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

/** Builds a full local backup of the signed-in user's plans + history. */
export async function buildJarvisBackup(): Promise<JarvisBackupV1> {
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
    const backupEx: BackupExercise = {
      id: ex.id as string,
      name: ex.name as string,
      notes: (ex.notes as string | null) ?? null,
      orderIndex: ex.order_index as number,
      sets,
    };
    const list = exercisesBySheet.get(ex.sheet_id as string) ?? [];
    list.push(backupEx);
    exercisesBySheet.set(ex.sheet_id as string, list);
  }

  const sheets: BackupSheet[] = sheetRows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    orderIndex: row.order_index as number,
    exercises: exercisesBySheet.get(row.id as string) ?? [],
  }));

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

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    sheets,
    sessions,
  };
}
