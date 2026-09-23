import { useEffect } from "react";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

const TAG = "jarvis-workout";

/**
 * Keep the screen awake while an active workout is on screen (D019 §5).
 * Uses expo-keep-awake (native + web Wake Lock under the hood).
 */
export function useWorkoutKeepAwake(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void activateKeepAwakeAsync(TAG).catch(() => {
      // Low Power Mode / unsupported — ignore.
    });
    return () => {
      if (!active) return;
      active = false;
      void deactivateKeepAwake(TAG).catch(() => {});
    };
  }, [enabled]);
}
