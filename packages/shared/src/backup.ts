/**
 * Lokalny backup JSON (D019 §4) — nie zastępuje Sheets.
 */

export const BACKUP_FORMAT = "jarvis-workout-backup" as const;
export const BACKUP_VERSION = 1 as const;

export type BackupExerciseSet = {
  setNumber: number;
  reps: number;
  weightKg: number;
  restTimeSec: number;
};

export type BackupExercise = {
  /** Stable within this file; remapped on import. */
  id: string;
  name: string;
  notes: string | null;
  orderIndex: number;
  sets: BackupExerciseSet[];
};

export type BackupSheet = {
  id: string;
  name: string;
  description: string | null;
  orderIndex: number;
  exercises: BackupExercise[];
};

export type BackupSetLog = {
  exerciseId: string;
  setNumber: number;
  reps: number;
  weightKg: number;
  completedAt: string;
  effortScale?: "rir" | "rpe" | null;
  effortValue?: number | null;
};

export type BackupExerciseNote = {
  exerciseId: string;
  notes: string;
};

export type BackupSession = {
  id: string;
  sheetId: string;
  startedAt: string;
  completedAt: string | null;
  notes: string | null;
  logs: BackupSetLog[];
  exerciseNotes: BackupExerciseNote[];
};

export type JarvisBackupV1 = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  sheets: BackupSheet[];
  sessions: BackupSession[];
};

export type JarvisBackup = JarvisBackupV1;

export function isJarvisBackup(value: unknown): value is JarvisBackupV1 {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    obj.format === BACKUP_FORMAT &&
    obj.version === BACKUP_VERSION &&
    typeof obj.exportedAt === "string" &&
    Array.isArray(obj.sheets) &&
    Array.isArray(obj.sessions)
  );
}

export function parseJarvisBackupJson(raw: string): JarvisBackupV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Plik nie jest prawidłowym JSON.");
  }
  if (!isJarvisBackup(parsed)) {
    throw new Error("To nie jest backup Jarvis (oczekiwany format jarvis-workout-backup v1).");
  }
  return parsed;
}

export function summarizeBackup(backup: JarvisBackupV1): {
  sheets: number;
  exercises: number;
  sessions: number;
  logs: number;
} {
  const exercises = backup.sheets.reduce((sum, sheet) => sum + sheet.exercises.length, 0);
  const logs = backup.sessions.reduce((sum, session) => sum + session.logs.length, 0);
  return {
    sheets: backup.sheets.length,
    exercises,
    sessions: backup.sessions.length,
    logs,
  };
}
