import { Platform } from "react-native";
import { getPref, getPrefBool, setPref, setPrefBool } from "./prefStorage";

const PREF_KEY = "notif_enabled";
const MOCK_SCHEDULED_KEY = "notif_scheduled";

// Mocked notifications: keep the public API stable without expo-notifications.

export async function requestPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  return true;
}

export async function scheduleDaily(): Promise<void> {
  if (Platform.OS === "web") return;
  await setPref(MOCK_SCHEDULED_KEY, "true");
}

export async function cancelReminder(): Promise<void> {
  if (Platform.OS === "web") return;
  await setPref(MOCK_SCHEDULED_KEY, "false");
}

export async function getEnabled(): Promise<boolean> {
  return getPrefBool(PREF_KEY, true);
}

export async function setEnabled(enabled: boolean): Promise<void> {
  await setPrefBool(PREF_KEY, enabled);
}

export async function init(): Promise<void> {
  if (Platform.OS === "web") return;
  const stored = await getPref(PREF_KEY);
  const granted = await requestPermission();
  if (!granted) return;
  if (stored === null) {
    await setEnabled(true);
    await scheduleDaily();
  } else if (stored === "true") {
    await scheduleDaily();
  }
}
