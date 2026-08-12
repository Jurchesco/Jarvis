import { Platform } from "react-native";
import { getHapticsEnabled } from "./appPreferences";

/** Lekka wibracja po udanym zapisie — no-op na web lub gdy wyłączone w ustawieniach. */
export async function hapticSuccess(): Promise<void> {
  if (Platform.OS === "web") return;
  if (!(await getHapticsEnabled())) return;
  try {
    const Haptics = await import("expo-haptics");
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // brak modułu native — ignoruj
  }
}

export async function hapticLight(): Promise<void> {
  if (Platform.OS === "web") return;
  if (!(await getHapticsEnabled())) return;
  try {
    const Haptics = await import("expo-haptics");
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // ignoruj
  }
}
