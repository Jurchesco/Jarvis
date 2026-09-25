/**
 * Automatic load progression for plan sessions (D021).
 * OpenGym-inspired rules; own implementation (no AGPL copy).
 */

import { getMuscleTagsForExercise, type MuscleGroup } from "./muscleGroups";
import { isTimeBasedExercise } from "./exerciseCatalog";

export type ProgressionRule = "none" | "linear" | "double";

export const PROGRESSION_RULE_OPTIONS: {
  value: ProgressionRule;
  label: string;
  hint: string;
}[] = [
  { value: "none", label: "Brak", hint: "Tylko poprzednia sesja / szablon" },
  { value: "linear", label: "Linear", hint: "Pełne serie → +kg" },
  { value: "double", label: "Double", hint: "Najpierw reps w zakresie, potem +kg" },
];

export type ProgressionSetLike = {
  setNumber: number;
  weightKg: number;
  reps: number;
};

export type ProgressionConfig = {
  rule: ProgressionRule;
  /** Explicit step; null/undefined = auto from muscle tags. */
  stepKg?: number | null;
  /** Double progression lower bound (inclusive). */
  repsMin?: number | null;
  /** Double progression upper bound (inclusive). */
  repsMax?: number | null;
};

export type ProgressionTarget = {
  setNumber: number;
  weightKg: number;
  reps: number;
};

export type ProgressionResult = {
  targets: ProgressionTarget[];
  reason: string;
  advanced: boolean;
  /** Effective rule after timed/bodyweight guards. */
  appliedRule: ProgressionRule;
};

const LOWER_BODY: ReadonlySet<MuscleGroup> = new Set([
  "quads",
  "hamstrings",
  "glutes",
  "calves",
]);

export function defaultStepKgForExercise(exerciseName: string): number {
  const tags = getMuscleTagsForExercise(exerciseName);
  if (tags && LOWER_BODY.has(tags.primary)) return 5;
  return 2.5;
}

export function resolveStepKg(
  exerciseName: string,
  stepKg?: number | null,
): number {
  if (stepKg != null && Number.isFinite(stepKg) && stepKg > 0) return stepKg;
  return defaultStepKgForExercise(exerciseName);
}

function roundKg(value: number): number {
  // Prefer 0.5 kg plate-friendly rounding.
  return Math.round(value * 2) / 2;
}

function sortBySetNumber<T extends { setNumber: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.setNumber - b.setNumber);
}

function normalizeDoubleRange(
  repsMin: number | null | undefined,
  repsMax: number | null | undefined,
  fallbackReps: number,
): { min: number; max: number } {
  const base = Math.max(1, Math.round(fallbackReps) || 8);
  let min = repsMin != null && repsMin > 0 ? Math.round(repsMin) : Math.max(1, base - 2);
  let max = repsMax != null && repsMax > 0 ? Math.round(repsMax) : base;
  if (max <= min) max = min + 2;
  return { min, max };
}

/**
 * Missed = fewer working sets than planned, or any set below target reps
 * at (or below) the target weight for that set index.
 */
export function sessionMissedTargets(
  planned: ProgressionSetLike[],
  logged: ProgressionSetLike[],
): boolean {
  if (planned.length === 0) return false;
  if (logged.length < planned.length) return true;

  const bySet = new Map(logged.map((row) => [row.setNumber, row]));
  for (const plan of planned) {
    const done = bySet.get(plan.setNumber);
    if (!done) return true;
    if (done.reps < plan.reps) return true;
  }
  return false;
}

function allSetsHitReps(
  planned: ProgressionSetLike[],
  logged: ProgressionSetLike[],
  minReps: number,
): boolean {
  if (logged.length < planned.length) return false;
  const bySet = new Map(logged.map((row) => [row.setNumber, row]));
  for (const plan of planned) {
    const done = bySet.get(plan.setNumber);
    if (!done || done.reps < minReps) return false;
  }
  return true;
}

function buildTargetsFromWeightReps(
  planned: ProgressionSetLike[],
  weightKg: number,
  reps: number,
): ProgressionTarget[] {
  const source = planned.length > 0 ? planned : [{ setNumber: 1, weightKg, reps }];
  return source.map((row, i) => ({
    setNumber: row.setNumber || i + 1,
    weightKg: roundKg(weightKg),
    reps: Math.max(1, Math.round(reps)),
  }));
}

function targetsFromLogged(logged: ProgressionSetLike[]): ProgressionTarget[] {
  return sortBySetNumber(logged).map((row) => ({
    setNumber: row.setNumber,
    weightKg: roundKg(row.weightKg),
    reps: Math.max(1, Math.round(row.reps)),
  }));
}

function targetsFromPlanned(planned: ProgressionSetLike[]): ProgressionTarget[] {
  return sortBySetNumber(planned).map((row) => ({
    setNumber: row.setNumber,
    weightKg: roundKg(row.weightKg),
    reps: Math.max(1, Math.round(row.reps) || 1),
  }));
}

/**
 * Compute next-session targets for one exercise.
 * Reads previous logs + optional plan templates; never mutates storage.
 */
export function computeNextTargets(input: {
  exerciseName: string;
  config: ProgressionConfig;
  /** Template sets from the plan (count + baseline reps; kg often 0). */
  plannedSets: ProgressionSetLike[];
  /** Logged sets from the last completed session for this exercise. */
  previousLogs: ProgressionSetLike[];
  /** When false, force none (global pref / Freestyle). */
  enabled?: boolean;
}): ProgressionResult {
  const {
    exerciseName,
    config,
    plannedSets,
    previousLogs,
    enabled = true,
  } = input;

  const planned = sortBySetNumber(plannedSets);
  const logged = sortBySetNumber(previousLogs);

  if (!enabled || config.rule === "none" || isTimeBasedExercise(exerciseName)) {
    if (logged.length > 0) {
      return {
        targets: targetsFromLogged(logged),
        reason: isTimeBasedExercise(exerciseName)
          ? "Ćwiczenie na czas — bez auto-awansu kg (powtórz poprzedni wynik)."
          : "Bez reguły — cele z poprzedniej sesji.",
        advanced: false,
        appliedRule: "none",
      };
    }
    if (planned.length > 0) {
      return {
        targets: targetsFromPlanned(planned),
        reason: "Brak historii — cele z szablonu planu.",
        advanced: false,
        appliedRule: "none",
      };
    }
    return {
      targets: [],
      reason: "Brak historii i szablonu.",
      advanced: false,
      appliedRule: "none",
    };
  }

  if (logged.length === 0) {
    if (planned.length > 0) {
      return {
        targets: targetsFromPlanned(planned),
        reason: "Pierwsza sesja z tym ćwiczeniem — start od szablonu planu.",
        advanced: false,
        appliedRule: config.rule,
      };
    }
    return {
      targets: [],
      reason: "Brak poprzedniej sesji — ustaw ciężar ręcznie.",
      advanced: false,
      appliedRule: config.rule,
    };
  }

  // Baseline prescription for "did we hit last time?": prefer last logged as targets,
  // using planned set count / reps when we need a structure for miss detection.
  const baselineReps =
    planned[0]?.reps > 0
      ? planned[0].reps
      : logged.reduce((min, row) => Math.min(min, row.reps), logged[0].reps);
  const baselineWeight =
    logged.reduce((min, row) => Math.min(min, row.weightKg), logged[0].weightKg) ||
    logged[0].weightKg;

  const workingPlan: ProgressionSetLike[] =
    planned.length > 0
      ? planned.map((row, i) => ({
          setNumber: row.setNumber,
          weightKg: logged[i]?.weightKg ?? logged[logged.length - 1]?.weightKg ?? baselineWeight,
          reps: row.reps > 0 ? row.reps : baselineReps,
        }))
      : logged.map((row) => ({
          setNumber: row.setNumber,
          weightKg: row.weightKg,
          reps: baselineReps,
        }));

  const missed = sessionMissedTargets(workingPlan, logged);
  const step = resolveStepKg(exerciseName, config.stepKg);

  if (config.rule === "linear") {
    if (missed) {
      return {
        targets: buildTargetsFromWeightReps(workingPlan, baselineWeight, baselineReps),
        reason: "Niepełne powtórzenia — ten sam ciężar i powtórzenia.",
        advanced: false,
        appliedRule: "linear",
      };
    }
    const nextKg = roundKg(baselineWeight + step);
    return {
      targets: buildTargetsFromWeightReps(workingPlan, nextKg, baselineReps),
      reason: `Wszystkie serie zaliczone — +${step} kg (teraz ${nextKg} kg).`,
      advanced: true,
      appliedRule: "linear",
    };
  }

  // double
  const { min, max } = normalizeDoubleRange(
    config.repsMin,
    config.repsMax,
    baselineReps,
  );
  // Floor for "did you complete the work?" is repsMin — hitting the bottom of
  // the range is success; only falling below min (or missing sets) is a miss.
  const doublePlan = workingPlan.map((row) => ({
    ...row,
    reps: min,
  }));

  if (sessionMissedTargets(doublePlan, logged)) {
    return {
      targets: buildTargetsFromWeightReps(doublePlan, baselineWeight, min),
      reason: `Niepełny zakres ${min}–${max} — zostań przy ${baselineWeight} kg × ${min}.`,
      advanced: false,
      appliedRule: "double",
    };
  }

  if (allSetsHitReps(doublePlan, logged, max)) {
    const nextKg = roundKg(baselineWeight + step);
    return {
      targets: buildTargetsFromWeightReps(doublePlan, nextKg, min),
      reason: `Cel ${max} powt. osiągnięty — +${step} kg, wróć do ${min} powt. (${nextKg} kg).`,
      advanced: true,
      appliedRule: "double",
    };
  }

  // Hit at least min; bump reps toward max (use min of logged reps + 1, capped).
  const lowestLogged = logged.reduce((m, row) => Math.min(m, row.reps), logged[0].reps);
  const nextReps = Math.min(max, Math.max(min, lowestLogged + 1));
  return {
    targets: buildTargetsFromWeightReps(doublePlan, baselineWeight, nextReps),
    reason: `Zakres ${min}–${max}: zostań przy ${baselineWeight} kg, cel ${nextReps} powt.`,
    advanced: true,
    appliedRule: "double",
  };
}

export function formatProgressionTargetChip(
  targets: ProgressionTarget[],
  timeBased = false,
): string {
  if (targets.length === 0) return "";
  const parts = targets.slice(0, 4).map((t) =>
    timeBased
      ? t.weightKg > 0
        ? `${t.weightKg}kg · ${t.reps}s`
        : `${t.reps}s`
      : `${t.weightKg}×${t.reps}`,
  );
  const extra = targets.length > 4 ? ` +${targets.length - 4}` : "";
  return `Cel · ${parts.join(" · ")}${extra}`;
}

export function isProgressionRule(value: unknown): value is ProgressionRule {
  return value === "none" || value === "linear" || value === "double";
}
