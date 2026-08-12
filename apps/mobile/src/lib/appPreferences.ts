import { getPref, getPrefBool, setPref, setPrefBool } from "./prefStorage";

const KEYS = {
  hapticsEnabled: "pref_haptics_enabled",
  autofillPrevious: "pref_autofill_previous",
  defaultRestSec: "pref_default_rest_sec",
} as const;

export type DefaultRestSec = 30 | 60 | 90 | 120;

export const DEFAULT_REST_OPTIONS: DefaultRestSec[] = [30, 60, 90, 120];

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
