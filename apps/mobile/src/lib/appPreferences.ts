import type { EffortScale } from "@bhmt3wp/shared";
import { getPref, getPrefBool, setPref, setPrefBool } from "./prefStorage";

const KEYS = {
  hapticsEnabled: "pref_haptics_enabled",
  autofillPrevious: "pref_autofill_previous",
  defaultRestSec: "pref_default_rest_sec",
  restTimerEnabled: "pref_rest_timer_enabled",
  keepAwakeEnabled: "pref_keep_awake_enabled",
  exerciseLogFillMode: "pref_exercise_log_fill_mode",
  effortLoggingEnabled: "pref_effort_logging_enabled",
  effortScale: "pref_effort_scale",
} as const;

export type DefaultRestSec = 30 | 60 | 90 | 120;
export type ExerciseLogFillMode = "batch" | "per-set";

export const DEFAULT_REST_OPTIONS: DefaultRestSec[] = [30, 60, 90, 120];
export const EXERCISE_LOG_FILL_MODE_OPTIONS: {
  value: ExerciseLogFillMode;
  label: string;
}[] = [
  { value: "batch", label: "Zbiorczo" },
  { value: "per-set", label: "Per seria" },
];
export const EFFORT_SCALE_PREF_OPTIONS: { value: EffortScale; label: string }[] = [
  { value: "rir", label: "RIR" },
  { value: "rpe", label: "RPE" },
];

export async function getHapticsEnabled(): Promise<boolean> {
  return getPrefBool(KEYS.hapticsEnabled, true);
}

export async function setHapticsEnabled(enabled: boolean): Promise<void> {
  await setPrefBool(KEYS.hapticsEnabled, enabled);
}

export async function getAutofillPrevious(): Promise<boolean> {
  return getPrefBool(KEYS.autofillPrevious, true);
}

export async function setAutofillPrevious(enabled: boolean): Promise<void> {
  await setPrefBool(KEYS.autofillPrevious, enabled);
}

export async function getDefaultRestSec(): Promise<DefaultRestSec> {
  const val = await getPref(KEYS.defaultRestSec);
  const parsed = val ? parseInt(val, 10) : 60;
  return DEFAULT_REST_OPTIONS.includes(parsed as DefaultRestSec)
    ? (parsed as DefaultRestSec)
    : 60;
}

export async function setDefaultRestSec(sec: DefaultRestSec): Promise<void> {
  await setPref(KEYS.defaultRestSec, String(sec));
}

/** Floating rest timer after saving an exercise (D019). Default on. */
export async function getRestTimerEnabled(): Promise<boolean> {
  return getPrefBool(KEYS.restTimerEnabled, true);
}

export async function setRestTimerEnabled(enabled: boolean): Promise<void> {
  await setPrefBool(KEYS.restTimerEnabled, enabled);
}

/** Keep screen awake during an active workout (D019 §5). Default on. */
export async function getKeepAwakeEnabled(): Promise<boolean> {
  return getPrefBool(KEYS.keepAwakeEnabled, true);
}

export async function setKeepAwakeEnabled(enabled: boolean): Promise<void> {
  await setPrefBool(KEYS.keepAwakeEnabled, enabled);
}

export async function getExerciseLogFillMode(): Promise<ExerciseLogFillMode> {
  const val = await getPref(KEYS.exerciseLogFillMode);
  return val === "batch" || val === "per-set" ? val : "per-set";
}

export async function setExerciseLogFillMode(mode: ExerciseLogFillMode): Promise<void> {
  await setPref(KEYS.exerciseLogFillMode, mode);
}

/** Optional RIR/RPE fields on the exercise log form. Default off. */
export async function getEffortLoggingEnabled(): Promise<boolean> {
  return getPrefBool(KEYS.effortLoggingEnabled, false);
}

export async function setEffortLoggingEnabled(enabled: boolean): Promise<void> {
  await setPrefBool(KEYS.effortLoggingEnabled, enabled);
}

export async function getEffortScale(): Promise<EffortScale> {
  const val = await getPref(KEYS.effortScale);
  return val === "rpe" ? "rpe" : "rir";
}

export async function setEffortScale(scale: EffortScale): Promise<void> {
  await setPref(KEYS.effortScale, scale);
}
