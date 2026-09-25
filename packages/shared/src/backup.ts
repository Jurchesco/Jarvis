/**
 * Lokalny backup JSON — treningi + opcjonalnie profil / waga / wycinek Garmin.
 * v1 = tylko sheets+sessions
 * v2 = + body / health allowlist
 * v3 = + progression rules + isWarmup on set logs
 */

import type { ProgressionRule } from "./progression";

export const BACKUP_FORMAT = "jarvis-workout-backup" as const;
export const BACKUP_VERSION = 3 as const;

export type BackupExerciseSet = {
  setNumber: number;
  reps: number;
  weightKg: number;
  restTimeSec: number;
};

export type BackupExerciseProgression = {
  rule: ProgressionRule;
  stepKg?: number | null;
  repsMin?: number | null;
  repsMax?: number | null;
  stepSec?: number | null;
  greyskullAmrapBonus?: number | null;
};

export type BackupExercise = {
  /** Stable within this file; remapped on import. */
  id: string;
  name: string;
  notes: string | null;
  orderIndex: number;
  sets: BackupExerciseSet[];
  /** D021 per-exercise override (v3+). */
  progression?: BackupExerciseProgression | null;
};

export type BackupSheet = {
  id: string;
  name: string;
  description: string | null;
  orderIndex: number;
  exercises: BackupExercise[];
  /** D021 sheet default (v3+). */
  defaultProgressionRule?: ProgressionRule | null;
  progressionDeload?: boolean;
};

export type BackupSetLog = {
  exerciseId: string;
  setNumber: number;
  reps: number;
  weightKg: number;
  completedAt: string;
  effortScale?: "rir" | "rpe" | null;
  effortValue?: number | null;
  /** Warm-up — excluded from progression / 1RM (v3+). */
  isWarmup?: boolean;
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

export type BackupBodyProfile = {
  displayName: string | null;
  heightCm: number | null;
  sex: "male" | "female" | "other" | null;
  goalWeightKg: number | null;
  birthYear: number | null;
};

export type BackupBodyMeasurement = {
  measuredAt: string;
  weightKg: number;
  bodyFatPct?: number | null;
  muscleMassKg?: number | null;
  waterPct?: number | null;
  boneMassKg?: number | null;
  bmi?: number | null;
  visceralFat?: number | null;
  bmr?: number | null;
  lbmKg?: number | null;
  proteinPct?: number | null;
  impedance?: number | null;
  comment?: string | null;
  source: "manual" | "openscale";
};

export type BackupGarminDaily = {
  day: string;
  totalSteps?: number | null;
  totalKilocalories?: number | null;
  activeKilocalories?: number | null;
  restingHeartRate?: number | null;
  averageStress?: number | null;
  bodyBatteryWake?: number | null;
  bodyBatteryHigh?: number | null;
  bodyBatteryLow?: number | null;
};

export type BackupGarminSleep = {
  day: string;
  sleepMinutes?: number | null;
  sleepScore?: number | null;
  deepMinutes?: number | null;
  lightMinutes?: number | null;
  remMinutes?: number | null;
  awakeMinutes?: number | null;
  hrvLastNightAvg?: number | null;
  hasData?: boolean;
};

export type BackupGarminForma = {
  day: string;
  hrvLastNightAvg?: number | null;
  hrvStatus?: string | null;
  restingHeartRate?: number | null;
  bodyBatteryWake?: number | null;
  averageStress?: number | null;
};

export type BackupGarminActivity = {
  activityId: string;
  startedAt: string | null;
  activityType: string | null;
  activityName: string | null;
  durationSec: number | null;
  distanceM: number | null;
  calories: number | null;
};

export type JarvisBackupV1 = {
  format: typeof BACKUP_FORMAT;
  version: 1;
  exportedAt: string;
  sheets: BackupSheet[];
  sessions: BackupSession[];
};

export type JarvisBackupV2 = {
  format: typeof BACKUP_FORMAT;
  version: 2;
  exportedAt: string;
  sheets: BackupSheet[];
  sessions: BackupSession[];
  profile?: BackupBodyProfile | null;
  bodyMeasurements?: BackupBodyMeasurement[];
  garminDaily?: BackupGarminDaily[];
  garminSleep?: BackupGarminSleep[];
  garminForma?: BackupGarminForma[];
  garminActivities?: BackupGarminActivity[];
};

export type JarvisBackupV3 = {
  format: typeof BACKUP_FORMAT;
  version: 3;
  exportedAt: string;
  sheets: BackupSheet[];
  sessions: BackupSession[];
  profile?: BackupBodyProfile | null;
  bodyMeasurements?: BackupBodyMeasurement[];
  garminDaily?: BackupGarminDaily[];
  garminSleep?: BackupGarminSleep[];
  garminForma?: BackupGarminForma[];
  garminActivities?: BackupGarminActivity[];
};

export type JarvisBackup = JarvisBackupV1 | JarvisBackupV2 | JarvisBackupV3;

export function isJarvisBackup(value: unknown): value is JarvisBackup {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  const versionOk = obj.version === 1 || obj.version === 2 || obj.version === 3;
  return (
    obj.format === BACKUP_FORMAT &&
    versionOk &&
    typeof obj.exportedAt === "string" &&
    Array.isArray(obj.sheets) &&
    Array.isArray(obj.sessions)
  );
}

export function parseJarvisBackupJson(raw: string): JarvisBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Plik nie jest prawidłowym JSON.");
  }
  if (!isJarvisBackup(parsed)) {
    throw new Error(
      "To nie jest backup Jarvis (oczekiwany format jarvis-workout-backup v1/v2/v3).",
    );
  }
  return parsed;
}

export function summarizeBackup(backup: JarvisBackup): {
  sheets: number;
  exercises: number;
  sessions: number;
  logs: number;
  bodyMeasurements: number;
} {
  const exercises = backup.sheets.reduce((sum, sheet) => sum + sheet.exercises.length, 0);
  const logs = backup.sessions.reduce((sum, session) => sum + session.logs.length, 0);
  const bodyMeasurements =
    (backup.version === 2 || backup.version === 3) && Array.isArray(backup.bodyMeasurements)
      ? backup.bodyMeasurements.length
      : 0;
  return {
    sheets: backup.sheets.length,
    exercises,
    sessions: backup.sessions.length,
    logs,
    bodyMeasurements,
  };
}
