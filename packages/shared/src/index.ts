// ============================================
// Shared types for JJ Workout Tool
// ============================================

// --- User / Auth ---
export type UserRole = "coach" | "allievo";

export interface UserProfile {
  id: string;
  role: UserRole;
  displayName: string | null;
  heightCm?: number | null;
  sex?: "male" | "female" | "other" | null;
  goalWeightKg?: number | null;
  birthYear?: number | null;
  createdAt: string;
  updatedAt: string;
}

// --- Workout Sheet (Scheda) ---
export interface WorkoutSheet {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  /** Lower value = higher in the list (0 = first row). */
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
  /** Present on list responses (`sheets.list`) for plan-card badges. */
  exerciseCount?: number;
}

export interface CreateWorkoutSheetInput {
  name: string;
  description?: string;
}

export interface UpdateWorkoutSheetInput {
  name?: string;
  description?: string;
  orderIndex?: number;
}

// --- Exercise ---
export interface Exercise {
  id: string;
  sheetId: string;
  name: string;
  notes: string | null;
  orderIndex: number;
  createdAt: string;
}

export interface CreateExerciseInput {
  sheetId: string;
  name: string;
  notes?: string;
  orderIndex?: number;
}

export interface UpdateExerciseInput {
  name?: string;
  notes?: string;
  orderIndex?: number;
}

// --- Exercise Set ---
export interface ExerciseSet {
  id: string;
  exerciseId: string;
  setNumber: number;
  reps: number;
  weightKg: number;
  restTimeSec: number;
}

export interface CreateExerciseSetInput {
  exerciseId: string;
  setNumber: number;
  reps: number;
  weightKg: number;
  restTimeSec: number;
}

export interface UpdateExerciseSetInput {
  setNumber?: number;
  reps?: number;
  weightKg?: number;
  restTimeSec?: number;
}

// --- Workout Session (log of an actual workout) ---
export interface WorkoutSession {
  id: string;
  userId: string;
  sheetId: string;
  startedAt: string;
  completedAt: string | null;
  notes: string | null;
}

export interface CreateWorkoutSessionInput {
  sheetId: string;
  notes?: string;
}

export interface UpdateWorkoutSessionInput {
  startedAt?: string;
  completedAt?: string | null;
  notes?: string | null;
}

// --- Session Set Log (actual performance per set) ---
export interface SessionSetLog {
  id: string;
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  reps: number;
  weightKg: number;
  completedAt: string;
  /** Optional RIR/RPE scale for this set. */
  effortScale?: "rir" | "rpe" | null;
  /** RIR 0–10 or RPE 1–10. */
  effortValue?: number | null;
}

export interface CreateSessionSetLogInput {
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  reps: number;
  weightKg: number;
  effortScale?: "rir" | "rpe" | null;
  effortValue?: number | null;
}

export interface DeleteSessionSetLogInput {
  sessionId: string;
  exerciseId: string;
  setNumber: number;
}

// --- Session Exercise Note (notes for exercise during workout) ---
export interface SessionExerciseNote {
  id: string;
  sessionId: string;
  exerciseId: string;
  notes: string;
  updatedAt: string;
}

export interface UpsertSessionExerciseNoteInput {
  sessionId: string;
  exerciseId: string;
  notes: string;
}

// --- API Response wrappers ---
export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
  message: string;
}

// --- Full sheet with nested exercises and sets ---
export interface WorkoutSheetFull extends WorkoutSheet {
  exercises: ExerciseFull[];
}

export interface ExerciseFull extends Exercise {
  sets: ExerciseSet[];
}

// --- History types ---
export interface WorkoutSessionWithSheet extends WorkoutSession {
  sheetName: string;
}

export interface SessionExerciseGroup {
  exerciseId: string;
  exerciseName: string;
  sets: SessionSetLog[];
}

export interface SessionDetailFull extends WorkoutSession {
  sheetName: string;
  logs: SessionSetLog[];
  exercises: SessionExerciseGroup[];
}

// --- Exercise catalog (PPL preset library) ---
export type { CatalogExercise, WorkoutSplit } from "./exerciseCatalog";
export {
  EXERCISE_CATALOG,
  PPL_SHEET_TEMPLATES,
  SPLIT_LABELS,
  WORKOUT_SPLITS,
  catalogExerciseCount,
  getCatalogExercisesForSplit,
  inferSplitFromSheetName,
  isTimeBasedExercise,
  normalizeExerciseName,
  searchCatalogExercises,
} from "./exerciseCatalog";
// --- Full exercise library (dataset + CDN media) ---
export type { LibraryBodyPart, LibraryExercise, LibrarySearchOpts } from "./exerciseLibrary";
export {
  EXERCISE_GIF_BASE,
  EXERCISE_IMG_BASE,
  EXERCISE_LIBRARY,
  EXERCISE_MEDIA_COMMIT,
  GYM_VISUAL_ATTRIBUTION,
  LIBRARY_BODY_PARTS,
  LIBRARY_BODY_PART_LABELS,
  equipmentOf,
  getLibraryExerciseById,
  getLibraryExerciseByName,
  isLibraryTimeBased,
  libraryDisplayName,
  libraryExerciseCount,
  libraryGifUrl,
  libraryThumbUrl,
  mapTargetToMuscle,
  muscleTagsFromLibraryExercise,
  normalizeLibraryName,
  searchLibraryExercises,
} from "./exerciseLibrary";
export type { MuscleGroup, MuscleTags } from "./muscleGroups";
export {
  MUSCLE_GROUPS,
  MUSCLE_LABELS,
  PRIMARY_SET_WEIGHT,
  SECONDARY_SET_WEIGHT,
  assertCatalogMuscleCoverage,
  getMuscleTagsForExercise,
} from "./muscleGroups";
export type { MuscleVolumeRow, MuscleVolumeSessionLike } from "./muscleVolume";
export {
  computeMuscleSetVolume,
  computeMuscleSetVolumeForWeek,
  endOfWeekExclusive,
  formatWeightedSets,
  isTimestampInWeek,
  startOfWeekMonday,
} from "./muscleVolume";
export {
  bestEpley1rmFromSets,
  computeSessionLiveStats,
  epley1rm,
  exerciseVolume,
  exerciseVolumeFromSets,
  formatDuration,
  formatVolumeKg,
  formatWeightKg,
  sessionDurationSec,
  setVolume,
} from "./workoutCalculations";
export type { SessionLiveStats } from "./workoutCalculations";
export {
  EPLEY_MAX_REPS_FOR_1RM,
  computeExerciseRecords,
  detectSessionPrs,
  epley1rmForRecord,
  formatRecordDate,
  sessionBestEst1rm,
  sessionMaxWeightKg,
} from "./exerciseRecords";
export type {
  ExerciseRecord,
  ExerciseSetRecord,
  RecordExerciseLike,
  RecordSessionLike,
  RecordSetLike,
  SessionPrHit,
} from "./exerciseRecords";
export {
  EFFORT_SCALE_OPTIONS,
  clampEffortValue,
  effortFromLogFields,
  formatEffortLabel,
  parseEffortInput,
} from "./effort";
export type { EffortScale, EffortValue } from "./effort";
export {
  PROGRESSION_RULE_OPTIONS,
  computeNextTargets,
  defaultStepKgForExercise,
  formatProgressionTargetChip,
  isProgressionRule,
  resolveStepKg,
  sessionMissedTargets,
} from "./progression";
export type {
  ProgressionConfig,
  ProgressionResult,
  ProgressionRule,
  ProgressionSetLike,
  ProgressionTarget,
} from "./progression";
export {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  isJarvisBackup,
  parseJarvisBackupJson,
  summarizeBackup,
} from "./backup";
export type {
  BackupBodyMeasurement,
  BackupBodyProfile,
  BackupExercise,
  BackupExerciseNote,
  BackupExerciseSet,
  BackupGarminActivity,
  BackupGarminDaily,
  BackupGarminForma,
  BackupGarminSleep,
  BackupSession,
  BackupSetLog,
  BackupSheet,
  JarvisBackup,
  JarvisBackupV1,
  JarvisBackupV2,
} from "./backup";
export {
  BODY_SEX_OPTIONS,
  computeBmi,
  formatBodyWeightKg,
} from "./body";
export type {
  BodyMeasurement,
  BodyMeasurementSource,
  BodyProfileFields,
  BodySex,
  CreateBodyMeasurementInput,
} from "./body";
export {
  AI_CONTEXT_ALLOWLIST,
  buildAiContextCsv,
  buildAiContextJson,
} from "./aiContextExport";
export type {
  AiContextAllowlistKey,
  AiContextBundle,
  AiContextOptions,
} from "./aiContextExport";
export {
  computeMonthBestStreak,
  computeWorkoutStreak,
} from "./workoutStreak";
export {
  buildSessionSummaryInsights,
} from "./sessionSummary";
export type {
  SessionComparison,
  SessionSummaryInsights,
  SessionSummaryLike,
  RankedExerciseVolume,
} from "./sessionSummary";
