/**
 * Automatic load progression for plan sessions (D021).
 * OpenGym-inspired rules; own implementation (no AGPL copy).
 */

import { getMuscleTagsForExercise, type MuscleGroup } from "./muscleGroups";
import { isTimeBasedExercise } from "./exerciseCatalog";

export type ProgressionRule = "none" | "linear" | "double" | "greyskull" | "time";

export const PROGRESSION_RULE_OPTIONS: {
  value: ProgressionRule;
  label: string;
  hint: string;
}[] = [
  { value: "none", label: "Brak", hint: "Tylko poprzednia sesja / szablon" },
  { value: "linear", label: "Linear", hint: "Pełne serie → +kg" },
  { value: "double", label: "Double", hint: "Najpierw reps w zakresie, potem +kg" },
  {
    value: "greyskull",
    label: "Greyskull",
    hint: "Serie stałe + AMRAP; mocny top → 2× skok; 3× miss → −10%",
  },
  { value: "time", label: "Czas", hint: "Ćwiczenia na czas: +sekundy przy zaliczeniu" },
];

export type ProgressionSetLike = {
  setNumber: number;
  weightKg: number;
  reps: number;
};

export type ProgressionConfig = {
  rule: ProgressionRule;
  /** Explicit kg step; null/undefined = auto from muscle tags. */
  stepKg?: number | null;
  /** Double progression lower bound (inclusive). */
  repsMin?: number | null;
  /** Double progression upper bound (inclusive). */
  repsMax?: number | null;
  /** Seconds to add for timed progression (default 5). */
  stepSec?: number | null;
  /**
   * Extra AMRAP reps above target that trigger a double jump (Greyskull).
   * Default 2 (e.g. target 5 → AMRAP ≥ 7).
   */
  greyskullAmrapBonus?: number | null;
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

const DEFAULT_TIME_STEP_SEC = 5;
const DEFAULT_GREYSKULL_AMRAP_BONUS = 2;
const GREYSKULL_STALL_SESSIONS = 3;

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

export function resolveStepSec(stepSec?: number | null): number {
  if (stepSec != null && Number.isFinite(stepSec) && stepSec > 0) {
    return Math.round(stepSec);
  }
  return DEFAULT_TIME_STEP_SEC;
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

/** Greyskull: fixed sets share `reps`, last set is AMRAP (same floor reps). */
function buildGreyskullTargets(
  planned: ProgressionSetLike[],
  weightKg: number,
  fixedReps: number,
): ProgressionTarget[] {
  const source =
    planned.length > 0
      ? planned
      : [
          { setNumber: 1, weightKg, reps: fixedReps },
          { setNumber: 2, weightKg, reps: fixedReps },
          { setNumber: 3, weightKg, reps: fixedReps },
        ];
  return source.map((row, i) => ({
    setNumber: row.setNumber || i + 1,
    weightKg: roundKg(weightKg),
    reps: Math.max(1, Math.round(fixedReps)),
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

function fallbackNoneResult(
  exerciseName: string,
  logged: ProgressionSetLike[],
  planned: ProgressionSetLike[],
  reasonTimed: boolean,
): ProgressionResult {
  if (logged.length > 0) {
    return {
      targets: targetsFromLogged(logged),
      reason: reasonTimed
        ? "Ćwiczenie na czas — powtórz poprzedni wynik (wybierz regułę Czas, by awansować)."
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

/**
 * Whether a past session missed its Greyskull floor (same structure as current plan).
 * Used for 3× stall → 10% reset — recomputed from logs, no stored counters.
 */
export function greyskullSessionMissed(
  planned: ProgressionSetLike[],
  logged: ProgressionSetLike[],
  floorReps: number,
): boolean {
  const structure =
    planned.length > 0
      ? planned.map((row) => ({ ...row, reps: floorReps }))
      : logged.map((row) => ({ ...row, reps: floorReps }));
  return sessionMissedTargets(structure, logged);
}

function countTrailingGreyskullMisses(
  planned: ProgressionSetLike[],
  sessionsNewestFirst: ProgressionSetLike[][],
  floorReps: number,
): number {
  let n = 0;
  for (const logs of sessionsNewestFirst) {
    if (logs.length === 0) break;
    if (greyskullSessionMissed(planned, sortBySetNumber(logs), floorReps)) n += 1;
    else break;
  }
  return n;
}

function computeTimeProgression(input: {
  planned: ProgressionSetLike[];
  logged: ProgressionSetLike[];
  stepSec: number;
}): ProgressionResult {
  const { planned, logged, stepSec } = input;
  if (logged.length === 0) {
    if (planned.length > 0) {
      return {
        targets: targetsFromPlanned(planned),
        reason: "Pierwsza sesja timed — start od szablonu (sekundy).",
        advanced: false,
        appliedRule: "time",
      };
    }
    return {
      targets: [],
      reason: "Brak poprzedniego czasu — ustaw sekundy ręcznie.",
      advanced: false,
      appliedRule: "time",
    };
  }

  const floorSec =
    planned[0]?.reps > 0
      ? planned[0].reps
      : logged.reduce((min, row) => Math.min(min, row.reps), logged[0].reps);
  const weight =
    logged.reduce((min, row) => Math.min(min, row.weightKg), logged[0].weightKg) || 0;

  const timePlan =
    planned.length > 0
      ? planned.map((row, i) => ({
          setNumber: row.setNumber,
          weightKg: logged[i]?.weightKg ?? weight,
          reps: row.reps > 0 ? row.reps : floorSec,
        }))
      : logged.map((row) => ({
          setNumber: row.setNumber,
          weightKg: row.weightKg,
          reps: floorSec,
        }));

  if (sessionMissedTargets(timePlan, logged)) {
    return {
      targets: buildTargetsFromWeightReps(timePlan, weight, floorSec),
      reason: `Nie utrzymano ${floorSec}s — ten sam cel czasowy.`,
      advanced: false,
      appliedRule: "time",
    };
  }

  const nextSec = floorSec + stepSec;
  return {
    targets: buildTargetsFromWeightReps(timePlan, weight, nextSec),
    reason: `Utrzymano ${floorSec}s — cel +${stepSec}s (teraz ${nextSec}s).`,
    advanced: true,
    appliedRule: "time",
  };
}

function computeGreyskull(input: {
  exerciseName: string;
  planned: ProgressionSetLike[];
  logged: ProgressionSetLike[];
  step: number;
  amrapBonus: number;
  /** Newest-first prior sessions for this exercise (may include `logged` as [0]). */
  recentSessionsNewestFirst?: ProgressionSetLike[][];
}): ProgressionResult {
  const { planned, logged, step, amrapBonus, recentSessionsNewestFirst } = input;

  const floorReps =
    planned[0]?.reps > 0
      ? planned[0].reps
      : logged.reduce((min, row) => Math.min(min, row.reps), logged[0]?.reps ?? 5);

  const baselineWeight =
    logged.reduce((min, row) => Math.min(min, row.weightKg), logged[0].weightKg) ||
    logged[0].weightKg;

  const structure: ProgressionSetLike[] =
    planned.length >= 2
      ? planned.map((row, i) => ({
          setNumber: row.setNumber,
          weightKg: logged[i]?.weightKg ?? baselineWeight,
          reps: floorReps,
        }))
      : logged.length >= 2
        ? logged.map((row) => ({
            setNumber: row.setNumber,
            weightKg: row.weightKg,
            reps: floorReps,
          }))
        : [
            { setNumber: 1, weightKg: baselineWeight, reps: floorReps },
            { setNumber: 2, weightKg: baselineWeight, reps: floorReps },
            { setNumber: 3, weightKg: baselineWeight, reps: floorReps },
          ];

  const sessionsForStall =
    recentSessionsNewestFirst && recentSessionsNewestFirst.length > 0
      ? recentSessionsNewestFirst.map(sortBySetNumber)
      : [logged];

  const trailingMisses = countTrailingGreyskullMisses(
    structure,
    sessionsForStall,
    floorReps,
  );

  if (trailingMisses >= GREYSKULL_STALL_SESSIONS) {
    const resetKg = roundKg(baselineWeight * 0.9);
    return {
      targets: buildGreyskullTargets(structure, resetKg, floorReps),
      reason: `${GREYSKULL_STALL_SESSIONS}× miss z rzędu — reset do ${resetKg} kg (−10%) i buduj w górę.`,
      advanced: false,
      appliedRule: "greyskull",
    };
  }

  if (sessionMissedTargets(structure, logged)) {
    return {
      targets: buildGreyskullTargets(structure, baselineWeight, floorReps),
      reason: "Niepełne serie / AMRAP poniżej celu — ten sam ciężar.",
      advanced: false,
      appliedRule: "greyskull",
    };
  }

  const amrap = sortBySetNumber(logged)[logged.length - 1];
  const strongAmrap = amrap && amrap.reps >= floorReps + amrapBonus;
  const jump = strongAmrap ? step * 2 : step;
  const nextKg = roundKg(baselineWeight + jump);

  return {
    targets: buildGreyskullTargets(structure, nextKg, floorReps),
    reason: strongAmrap
      ? `AMRAP ${amrap.reps} (≥${floorReps + amrapBonus}) — podwójny skok +${jump} kg → ${nextKg} kg.`
      : `Serie zaliczone — +${jump} kg → ${nextKg} kg (ostatnia seria = AMRAP).`,
    advanced: true,
    appliedRule: "greyskull",
  };
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
  /**
   * Optional newest-first history (including the latest session) for Greyskull
   * stall detection. When omitted, only the latest session is considered.
   */
  recentSessionsNewestFirst?: ProgressionSetLike[][];
  /** When false, force none (global pref / Freestyle). */
  enabled?: boolean;
  /** Planned deload week — do not advance; keep previous/template targets. */
  deload?: boolean;
}): ProgressionResult {
  const {
    exerciseName,
    config,
    plannedSets,
    previousLogs,
    recentSessionsNewestFirst,
    enabled = true,
    deload = false,
  } = input;

  const planned = sortBySetNumber(plannedSets);
  const logged = sortBySetNumber(previousLogs);
  const timed = isTimeBasedExercise(exerciseName);

  if (deload) {
    if (logged.length > 0) {
      return {
        targets: targetsFromLogged(logged),
        reason: "Deload — bez awansu; cele z poprzedniej sesji tego planu.",
        advanced: false,
        appliedRule: config.rule,
      };
    }
    if (planned.length > 0) {
      return {
        targets: targetsFromPlanned(planned),
        reason: "Deload — cele z szablonu planu (bez awansu).",
        advanced: false,
        appliedRule: config.rule,
      };
    }
    return {
      targets: [],
      reason: "Deload — brak historii i szablonu.",
      advanced: false,
      appliedRule: config.rule,
    };
  }

  if (!enabled || config.rule === "none") {
    return fallbackNoneResult(exerciseName, logged, planned, timed);
  }

  // Timed work: only the dedicated time rule advances; others fall back to none.
  if (timed) {
    if (config.rule === "time") {
      return computeTimeProgression({
        planned,
        logged,
        stepSec: resolveStepSec(config.stepSec),
      });
    }
    return fallbackNoneResult(exerciseName, logged, planned, true);
  }

  // Non-timed + time rule → treat as none (rule meant for planks/holds).
  if (config.rule === "time") {
    return fallbackNoneResult(exerciseName, logged, planned, false);
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

  if (config.rule === "greyskull") {
    const bonus =
      config.greyskullAmrapBonus != null && config.greyskullAmrapBonus >= 0
        ? Math.round(config.greyskullAmrapBonus)
        : DEFAULT_GREYSKULL_AMRAP_BONUS;
    return computeGreyskull({
      exerciseName,
      planned,
      logged,
      step,
      amrapBonus: bonus,
      recentSessionsNewestFirst,
    });
  }

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
  const formatOne = (t: ProgressionTarget) =>
    timeBased
      ? t.weightKg > 0
        ? `${t.weightKg}kg · ${t.reps}s`
        : `${t.reps}s`
      : `${t.weightKg}×${t.reps}`;

  const first = formatOne(targets[0]);
  const uniform = targets.every((t) => formatOne(t) === first);
  if (uniform) {
    return targets.length > 1 ? `Cel · ${first} ×${targets.length}` : `Cel · ${first}`;
  }

  const parts = targets.slice(0, 3).map(formatOne);
  const extra = targets.length > 3 ? ` +${targets.length - 3}` : "";
  return `Cel · ${parts.join(" · ")}${extra}`;
}

export function isProgressionRule(value: unknown): value is ProgressionRule {
  return (
    value === "none" ||
    value === "linear" ||
    value === "double" ||
    value === "greyskull" ||
    value === "time"
  );
}
