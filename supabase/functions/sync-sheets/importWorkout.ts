import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { formatInTimeZone, fromZonedTime } from "npm:date-fns-tz@3";
import { subDays } from "npm:date-fns@3";
import {
  appendRows,
  batchUpdateRows,
  getOrCreateWorksheet,
  readWorksheetValues,
  writeHeaderRow,
} from "./googleSheets.ts";
import { getGoogleAccessToken, type ServiceAccount } from "./googleAuth.ts";

export const WORKSHEET_NAME = "Silownia_import";
const TIMEZONE = "Europe/Warsaw";
const PAGE_SIZE = 1000;
const IN_CHUNK = 200;

export const HEADERS = [
  "Data",
  "Split",
  "Cwiczenie",
  "Set",
  "Ciezar (kg)",
  "Powtorzenia",
  "Est. 1RM",
  "Volume",
  "PR",
  "Bol / Niggle",
  "Uwagi",
  "Czas serii",
];

type SetLog = {
  session_id: string;
  exercise_id: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  completed_at: string;
};

type SessionRow = {
  id: string;
  user_id: string;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
  sheet_id: string;
  workout_sheets: { name: string } | null;
};

export type ImportStats = {
  updated: number;
  appended: number;
  skippedOutOfRange: number;
  seriesInRange: number;
  exerciseRows: number;
};

function brzycki1rm(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  return Math.round((weight / (1.0278 - 0.0278 * reps)) * 10) / 10;
}

function makeKey(row: (string | number)[]): string {
  return [row[0], row[2]].map(String).join("|");
}

function formatDatetimeWarsaw(iso: string): string {
  return formatInTimeZone(iso, TIMEZONE, "yyyy-MM-dd HH:mm:ss");
}

function dateKeyWarsaw(iso: string): string {
  return formatInTimeZone(iso, TIMEZONE, "yyyy-MM-dd");
}

function localDateBoundsUtc(startKey: string, endKey: string): { gte: string; lte: string } {
  const gte = fromZonedTime(`${startKey}T00:00:00`, TIMEZONE).toISOString();
  const lte = fromZonedTime(`${endKey}T23:59:59.999`, TIMEZONE).toISOString();
  return { gte, lte };
}

function dateRangeKeys(days: number): { startKey: string; endKey: string } {
  const now = new Date();
  const endKey = formatInTimeZone(now, TIMEZONE, "yyyy-MM-dd");
  const zonedNow = fromZonedTime(
    `${endKey}T12:00:00`,
    TIMEZONE,
  );
  const startKey = formatInTimeZone(subDays(zonedNow, days - 1), TIMEZONE, "yyyy-MM-dd");
  return { startKey, endKey };
}

async function fetchSetLogsPaginated(
  supabase: SupabaseClient,
  filters: { gte?: string; lte?: string; lt?: string },
): Promise<SetLog[]> {
  const rows: SetLog[] = [];
  let offset = 0;
  const select =
    "session_id, exercise_id, set_number, reps, weight_kg, completed_at";

  while (true) {
    let query = supabase
      .from("session_set_logs")
      .select(select)
      .order("completed_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (filters.gte) query = query.gte("completed_at", filters.gte);
    if (filters.lte) query = query.lte("completed_at", filters.lte);
    if (filters.lt) query = query.lt("completed_at", filters.lt);

    const { data, error } = await query;
    if (error) throw new Error(`session_set_logs: ${error.message}`);
    const batch = (data ?? []) as SetLog[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows;
}

async function fetchByIds<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  idColumn: string,
  ids: string[],
): Promise<T[]> {
  if (ids.length === 0) return [];
  const rows: T[] = [];
  for (let offset = 0; offset < ids.length; offset += IN_CHUNK) {
    const chunk = ids.slice(offset, offset + IN_CHUNK);
    const { data, error } = await supabase.from(table).select(select).in(idColumn, chunk);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
  }
  return rows;
}

function buildMaxWeightBeforeRange(logs: SetLog[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const log of logs) {
    const weight = log.weight_kg ?? 0;
    const prev = map.get(log.exercise_id) ?? 0;
    if (weight > prev) map.set(log.exercise_id, weight);
  }
  return map;
}

export async function runWorkoutImport(options: {
  supabaseUrl: string;
  serviceRoleKey: string;
  spreadsheetId: string;
  serviceAccount: ServiceAccount;
  userId: string;
  days: number;
}): Promise<ImportStats> {
  const supabase = createClient(options.supabaseUrl, options.serviceRoleKey);

  const { startKey: startStr, endKey: endStr } = dateRangeKeys(options.days);
  const { gte: rangeStartUtc, lte: rangeEndUtc } = localDateBoundsUtc(startStr, endStr);

  const priorLogs = await fetchSetLogsPaginated(supabase, { lt: rangeStartUtc });
  const priorSessionIds = [...new Set(priorLogs.map((l) => l.session_id))];
  const priorSessions = await fetchByIds<SessionRow>(
    supabase,
    "workout_sessions",
    "id, user_id",
    "id",
    priorSessionIds,
  );
  const userPriorSessionIds = new Set(
    priorSessions.filter((s) => s.user_id === options.userId).map((s) => s.id),
  );
  const userPriorLogs = priorLogs.filter((l) => userPriorSessionIds.has(l.session_id));
  const maxWeightByExercise = buildMaxWeightBeforeRange(userPriorLogs);

  const logs = await fetchSetLogsPaginated(supabase, {
    gte: rangeStartUtc,
    lte: rangeEndUtc,
  });

  if (logs.length === 0 && userPriorLogs.length === 0) {
    throw new Error("Brak zalogowanych serii — zakończ trening z zapisanymi seriami.");
  }

  const sessionIds = [...new Set(logs.map((l) => l.session_id))];
  const exerciseIds = [...new Set(logs.map((l) => l.exercise_id))];

  const sessionsList = await fetchByIds<SessionRow>(
    supabase,
    "workout_sessions",
    "id, user_id, started_at, completed_at, notes, sheet_id, workout_sheets(name)",
    "id",
    sessionIds,
  );
  const sessions = new Map(
    sessionsList.filter((s) => s.user_id === options.userId).map((s) => [s.id, s]),
  );

  const exercisesList = await fetchByIds<{ id: string; name: string }>(
    supabase,
    "exercises",
    "id, name",
    "id",
    exerciseIds,
  );
  const exercises = new Map(exercisesList.map((e) => [e.id, e.name]));

  const notesList = await fetchByIds<{
    session_id: string;
    exercise_id: string;
    notes: string;
  }>(supabase, "session_exercise_notes", "session_id, exercise_id, notes", "session_id", [
    ...sessions.keys(),
  ]);
  const exerciseNotes = new Map(
    notesList.map((n) => [`${n.session_id}:${n.exercise_id}`, n.notes]),
  );

  const rowsToUpsert: (string | number)[][] = [];
  let skippedOutOfRange = 0;

  type ExerciseGroup = {
    sessionId: string;
    exerciseId: string;
    logs: SetLog[];
  };
  const groups = new Map<string, ExerciseGroup>();

  for (const log of logs) {
    const session = sessions.get(log.session_id);
    if (!session) continue;

    const dateStr = dateKeyWarsaw(session.started_at);
    if (dateStr < startStr || dateStr > endStr) {
      skippedOutOfRange++;
      continue;
    }

    const groupKey = `${log.session_id}:${log.exercise_id}`;
    const existing = groups.get(groupKey);
    if (existing) {
      existing.logs.push(log);
    } else {
      groups.set(groupKey, {
        sessionId: log.session_id,
        exerciseId: log.exercise_id,
        logs: [log],
      });
    }
  }

  for (const group of groups.values()) {
    const session = sessions.get(group.sessionId);
    if (!session) continue;

    const sortedLogs = [...group.logs].sort((a, b) => a.set_number - b.set_number);
    const setCount = sortedLogs.length;
    const first = sortedLogs[0];
    const weight = first.weight_kg ?? 0;
    const reps = first.reps ?? 0;
    const exerciseId = group.exerciseId;

    const prevMax = maxWeightByExercise.get(exerciseId) ?? 0;
    const isPr = weight > 0 && weight > prevMax;
    if (weight > prevMax) maxWeightByExercise.set(exerciseId, weight);

    const dataValue = formatDatetimeWarsaw(session.started_at);
    const splitName = session.workout_sheets?.name ?? "Brak";
    const exerciseName = exercises.get(exerciseId) ?? "Nieznane cwiczenie";
    const noteKey = `${group.sessionId}:${exerciseId}`;
    const volume = weight * reps * setCount;

    rowsToUpsert.push([
      dataValue,
      splitName,
      exerciseName,
      setCount,
      weight,
      reps,
      brzycki1rm(weight, reps),
      volume,
      isPr ? "Tak" : "",
      exerciseNotes.get(noteKey) ?? "",
      session.notes ?? "",
      "",
    ]);
  }

  if (rowsToUpsert.length === 0) {
    throw new Error(`Brak serii w zakresie ${startStr}–${endStr} — zakończ trening i spróbuj ponownie.`);
  }

  const accessToken = await getGoogleAccessToken(options.serviceAccount);
  await getOrCreateWorksheet(accessToken, options.spreadsheetId, WORKSHEET_NAME);

  let values = await readWorksheetValues(accessToken, options.spreadsheetId, WORKSHEET_NAME);
  if (values.length === 0 || values[0].slice(0, HEADERS.length).join("|") !== HEADERS.join("|")) {
    await writeHeaderRow(accessToken, options.spreadsheetId, WORKSHEET_NAME, HEADERS);
    values = [HEADERS];
  }

  const existingRows = new Map<string, number>();
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row?.[0]?.trim()) continue;
    const padded = [...row, ...Array(Math.max(0, HEADERS.length - row.length)).fill("")].slice(
      0,
      HEADERS.length,
    );
    existingRows.set(makeKey(padded), i + 1);
  }

  const pendingUpdates: Array<{ rowNumber: number; values: (string | number)[] }> = [];
  const appendedRows: (string | number)[][] = [];

  for (const row of rowsToUpsert) {
    const key = makeKey(row);
    const existing = existingRows.get(key);
    if (existing != null) {
      pendingUpdates.push({ rowNumber: existing, values: row });
    } else {
      appendedRows.push(row);
    }
  }

  await batchUpdateRows(accessToken, options.spreadsheetId, WORKSHEET_NAME, pendingUpdates);
  await appendRows(accessToken, options.spreadsheetId, WORKSHEET_NAME, appendedRows);

  return {
    updated: pendingUpdates.length,
    appended: appendedRows.length,
    skippedOutOfRange,
    seriesInRange: logs.filter((l) => sessions.has(l.session_id)).length,
    exerciseRows: rowsToUpsert.length,
  };
}
