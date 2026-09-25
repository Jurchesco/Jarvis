/**
 * Progression preferences (D021).
 * Prefers Postgres (workout_sheets + exercise_progression) so rules sync across
 * devices; falls back to AsyncStorage when migration is missing.
 */

import type { ProgressionConfig, ProgressionRule } from "@bhmt3wp/shared";
import { isProgressionRule } from "@bhmt3wp/shared";
import { api } from "../api/client";
import { getPref, getPrefBool, setPref, setPrefBool } from "./prefStorage";

const KEYS = {
  enabled: "pref_progression_enabled",
  sheetConfig: "pref_sheet_progression_v1",
} as const;

export type ExerciseProgressionOverride = {
  rule?: ProgressionRule;
  stepKg?: number | null;
  repsMin?: number | null;
  repsMax?: number | null;
  stepSec?: number | null;
  greyskullAmrapBonus?: number | null;
};

export type SheetProgressionConfig = {
  defaultRule: ProgressionRule;
  /** Planned deload week — no auto-advance on this sheet. */
  deload?: boolean;
  exercises?: Record<string, ExerciseProgressionOverride>;
};

type SheetProgressionMap = Record<string, SheetProgressionConfig>;

/** null = unknown; true/false cached after first probe. */
let sqlAvailable: boolean | null = null;

function isSchemaMissingError(message: string): boolean {
  return /relation|does not exist|column|schema cache/i.test(message);
}

function markSqlUnavailable(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  if (isSchemaMissingError(msg)) sqlAvailable = false;
}

/** Global master switch. Default on — Freestyle still forces none at call site. */
export async function getProgressionEnabled(): Promise<boolean> {
  return getPrefBool(KEYS.enabled, true);
}

export async function setProgressionEnabled(enabled: boolean): Promise<void> {
  await setPrefBool(KEYS.enabled, enabled);
}

async function readPrefsMap(): Promise<SheetProgressionMap> {
  const raw = await getPref(KEYS.sheetConfig);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as SheetProgressionMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writePrefsMap(map: SheetProgressionMap): Promise<void> {
  await setPref(KEYS.sheetConfig, JSON.stringify(map));
}

function prefsConfigForSheet(
  map: SheetProgressionMap,
  sheetId: string,
): SheetProgressionConfig | null {
  const row = map[sheetId];
  if (!row || !isProgressionRule(row.defaultRule)) return null;
  return {
    defaultRule: row.defaultRule,
    deload: !!row.deload,
    exercises: row.exercises ?? {},
  };
}

function isDefaultConfig(cfg: SheetProgressionConfig): boolean {
  const ex = cfg.exercises ?? {};
  return cfg.defaultRule === "linear" && !cfg.deload && Object.keys(ex).length === 0;
}

function hasMeaningfulOverrides(cfg: SheetProgressionConfig): boolean {
  return !isDefaultConfig(cfg);
}

async function loadFromSql(sheetId: string): Promise<SheetProgressionConfig | null> {
  if (sqlAvailable === false) return null;
  try {
    const sheet = await api.sheets.get(sheetId);
    if (sheet.defaultProgressionRule === undefined && sheet.progressionDeload === undefined) {
      sqlAvailable = false;
      return null;
    }
    const rows = await api.exerciseProgression.listBySheet(sheetId);
    sqlAvailable = true;
    const exercises: Record<string, ExerciseProgressionOverride> = {};
    for (const row of rows) {
      if (!isProgressionRule(row.rule)) continue;
      exercises[row.exerciseId] = {
        rule: row.rule,
        stepKg: row.stepKg,
        repsMin: row.repsMin,
        repsMax: row.repsMax,
        stepSec: row.stepSec,
        greyskullAmrapBonus: row.greyskullAmrapBonus,
      };
    }
    return {
      defaultRule: isProgressionRule(sheet.defaultProgressionRule)
        ? sheet.defaultProgressionRule
        : "linear",
      deload: !!sheet.progressionDeload,
      exercises,
    };
  } catch (err) {
    markSqlUnavailable(err);
    if (sqlAvailable === false) return null;
    throw err;
  }
}

async function writeSheetToSql(sheetId: string, cfg: SheetProgressionConfig): Promise<boolean> {
  if (sqlAvailable === false) return false;
  try {
    await api.sheets.update(sheetId, {
      defaultProgressionRule: cfg.defaultRule,
      progressionDeload: !!cfg.deload,
    });
    sqlAvailable = true;
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isSchemaMissingError(msg)) {
      sqlAvailable = false;
      return false;
    }
    throw err;
  }
}

async function writeExerciseToSql(
  exerciseId: string,
  override: ExerciseProgressionOverride | null,
  defaultRule: ProgressionRule,
): Promise<boolean> {
  if (sqlAvailable === false) return false;
  try {
    if (
      !override ||
      Object.keys(override).length === 0 ||
      (override.rule != null && override.rule === defaultRule &&
        override.stepKg == null &&
        override.repsMin == null &&
        override.repsMax == null &&
        override.stepSec == null &&
        override.greyskullAmrapBonus == null)
    ) {
      await api.exerciseProgression.delete(exerciseId);
    } else {
      const rule = override.rule ?? defaultRule;
      await api.exerciseProgression.upsert(exerciseId, {
        rule: isProgressionRule(rule) ? rule : defaultRule,
        stepKg: override.stepKg ?? null,
        repsMin: override.repsMin ?? null,
        repsMax: override.repsMax ?? null,
        stepSec: override.stepSec ?? null,
        greyskullAmrapBonus: override.greyskullAmrapBonus ?? null,
      });
    }
    sqlAvailable = true;
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isSchemaMissingError(msg)) {
      sqlAvailable = false;
      return false;
    }
    throw err;
  }
}

async function clearPrefsSheet(sheetId: string): Promise<void> {
  const map = await readPrefsMap();
  if (!(sheetId in map)) return;
  delete map[sheetId];
  await writePrefsMap(map);
}

async function writePrefsSheet(sheetId: string, cfg: SheetProgressionConfig): Promise<void> {
  const map = await readPrefsMap();
  map[sheetId] = {
    defaultRule: cfg.defaultRule,
    deload: !!cfg.deload,
    exercises: cfg.exercises ?? {},
  };
  await writePrefsMap(map);
}

/** Migrate local prefs → SQL once columns/table exist. */
async function migratePrefsToSqlIfNeeded(
  sheetId: string,
  sqlCfg: SheetProgressionConfig,
): Promise<SheetProgressionConfig> {
  const map = await readPrefsMap();
  const prefsCfg = prefsConfigForSheet(map, sheetId);
  if (!prefsCfg || !hasMeaningfulOverrides(prefsCfg)) return sqlCfg;
  if (!isDefaultConfig(sqlCfg)) {
    // SQL already has user data — drop stale local prefs.
    await clearPrefsSheet(sheetId);
    return sqlCfg;
  }
  const wrote = await writeSheetToSql(sheetId, prefsCfg);
  if (!wrote) return prefsCfg;
  for (const [exerciseId, override] of Object.entries(prefsCfg.exercises ?? {})) {
    await writeExerciseToSql(exerciseId, override, prefsCfg.defaultRule);
  }
  await clearPrefsSheet(sheetId);
  return prefsCfg;
}

export async function getSheetProgressionConfig(
  sheetId: string,
): Promise<SheetProgressionConfig> {
  const sqlCfg = await loadFromSql(sheetId);
  if (sqlCfg) {
    return migratePrefsToSqlIfNeeded(sheetId, sqlCfg);
  }
  const map = await readPrefsMap();
  return (
    prefsConfigForSheet(map, sheetId) ?? {
      defaultRule: "linear",
      exercises: {},
    }
  );
}

export async function setSheetDefaultProgressionRule(
  sheetId: string,
  rule: ProgressionRule,
): Promise<void> {
  const current = await getSheetProgressionConfig(sheetId);
  const next: SheetProgressionConfig = {
    ...current,
    defaultRule: rule,
    deload: current.deload,
    exercises: current.exercises ?? {},
  };
  const wrote = await writeSheetToSql(sheetId, next);
  if (wrote) {
    await clearPrefsSheet(sheetId);
    return;
  }
  await writePrefsSheet(sheetId, next);
}

export async function setSheetProgressionDeload(
  sheetId: string,
  deload: boolean,
): Promise<void> {
  const current = await getSheetProgressionConfig(sheetId);
  const next: SheetProgressionConfig = {
    ...current,
    defaultRule: isProgressionRule(current.defaultRule) ? current.defaultRule : "linear",
    deload,
    exercises: current.exercises ?? {},
  };
  const wrote = await writeSheetToSql(sheetId, next);
  if (wrote) {
    await clearPrefsSheet(sheetId);
    return;
  }
  await writePrefsSheet(sheetId, next);
}

export async function setExerciseProgressionOverride(
  sheetId: string,
  exerciseId: string,
  override: ExerciseProgressionOverride | null,
): Promise<void> {
  const current = await getSheetProgressionConfig(sheetId);
  const exercises = { ...(current.exercises ?? {}) };
  if (!override || Object.keys(override).length === 0) {
    delete exercises[exerciseId];
  } else {
    exercises[exerciseId] = { ...exercises[exerciseId], ...override };
  }
  const next: SheetProgressionConfig = { ...current, exercises };

  const wroteSheet = await writeSheetToSql(sheetId, next);
  const wroteEx = await writeExerciseToSql(exerciseId, override, next.defaultRule);
  if (wroteSheet && wroteEx) {
    await clearPrefsSheet(sheetId);
    return;
  }
  await writePrefsSheet(sheetId, next);
}

/** Resolve effective config for one exercise on a sheet. */
export function resolveExerciseProgressionConfig(
  sheetConfig: SheetProgressionConfig,
  exerciseId: string,
): ProgressionConfig {
  const override = sheetConfig.exercises?.[exerciseId];
  const rule = override?.rule ?? sheetConfig.defaultRule;
  return {
    rule: isProgressionRule(rule) ? rule : "none",
    stepKg: override?.stepKg ?? null,
    repsMin: override?.repsMin ?? null,
    repsMax: override?.repsMax ?? null,
    stepSec: override?.stepSec ?? null,
    greyskullAmrapBonus: override?.greyskullAmrapBonus ?? null,
  };
}
