/**
 * Local progression preferences (D021 MVP).
 * Sheet/exercise rules live in AsyncStorage so the feature works without a
 * Supabase migration; SQL persistence can follow later.
 */

import type { ProgressionConfig, ProgressionRule } from "@bhmt3wp/shared";
import { isProgressionRule } from "@bhmt3wp/shared";
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
};

export type SheetProgressionConfig = {
  defaultRule: ProgressionRule;
  exercises?: Record<string, ExerciseProgressionOverride>;
};

type SheetProgressionMap = Record<string, SheetProgressionConfig>;

/** Global master switch. Default on — Freestyle still forces none at call site. */
export async function getProgressionEnabled(): Promise<boolean> {
  return getPrefBool(KEYS.enabled, true);
}

export async function setProgressionEnabled(enabled: boolean): Promise<void> {
  await setPrefBool(KEYS.enabled, enabled);
}

async function readMap(): Promise<SheetProgressionMap> {
  const raw = await getPref(KEYS.sheetConfig);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as SheetProgressionMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeMap(map: SheetProgressionMap): Promise<void> {
  await setPref(KEYS.sheetConfig, JSON.stringify(map));
}

export async function getSheetProgressionConfig(
  sheetId: string,
): Promise<SheetProgressionConfig> {
  const map = await readMap();
  const row = map[sheetId];
  if (!row || !isProgressionRule(row.defaultRule)) {
    return { defaultRule: "linear", exercises: {} };
  }
  return {
    defaultRule: row.defaultRule,
    exercises: row.exercises ?? {},
  };
}

export async function setSheetDefaultProgressionRule(
  sheetId: string,
  rule: ProgressionRule,
): Promise<void> {
  const map = await readMap();
  const prev = map[sheetId] ?? { defaultRule: "linear", exercises: {} };
  map[sheetId] = { ...prev, defaultRule: rule, exercises: prev.exercises ?? {} };
  await writeMap(map);
}

export async function setExerciseProgressionOverride(
  sheetId: string,
  exerciseId: string,
  override: ExerciseProgressionOverride | null,
): Promise<void> {
  const map = await readMap();
  const prev = map[sheetId] ?? { defaultRule: "linear", exercises: {} };
  const exercises = { ...(prev.exercises ?? {}) };
  if (!override || Object.keys(override).length === 0) {
    delete exercises[exerciseId];
  } else {
    exercises[exerciseId] = { ...exercises[exerciseId], ...override };
  }
  map[sheetId] = { ...prev, exercises };
  await writeMap(map);
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
  };
}
