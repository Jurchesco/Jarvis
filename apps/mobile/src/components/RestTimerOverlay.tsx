import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Minus, Plus, X } from "lucide-react-native";
import { formatRestClock, type RestTimerState } from "../lib/useRestTimer";
import { ICON_STROKE } from "./ui/icons";
import { cx } from "./ui/utils";

type RestTimerOverlayProps = {
  timer: RestTimerState;
  onAdjust: (deltaSec: number) => void;
  onDismiss: () => void;
  /** Extra lift when toast / keyboard share the bottom edge. */
  bottomOffset?: number;
};

/**
 * Floating rest bar (not in ScrollView) — OpenGym-inspired layout for Jarvis.
 * Controls: −15s · +30s · dismiss (D019).
 */
export function RestTimerOverlay({
  timer,
  onAdjust,
  onDismiss,
  bottomOffset = 0,
}: RestTimerOverlayProps) {
  const insets = useSafeAreaInsets();
  const pct = timer.totalSec > 0 ? Math.min(100, (timer.leftSec / timer.totalSec) * 100) : 0;

  return (
    <View
      pointerEvents="box-none"
      className="absolute left-0 right-0 z-40 px-4"
      style={{ bottom: Math.max(insets.bottom, 12) + bottomOffset }}
      accessibilityRole="summary"
      accessibilityLabel={`Odpoczynek ${formatRestClock(timer.leftSec)}`}
    >
      <View className="rounded-2xl border border-border bg-surface px-3 py-3 shadow-lg">
        <View className="flex-row items-center gap-3 mb-3">
          <Text className="text-text-primary text-2xl font-bold tabular-nums leading-none min-w-[64px]">
            {formatRestClock(timer.leftSec)}
          </Text>
          <View className="flex-1 h-2 rounded-full bg-surface-muted overflow-hidden">
            <View
              className="h-full rounded-full bg-action-primary"
              style={{ width: `${pct}%` }}
            />
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => onAdjust(-15)}
            accessibilityRole="button"
            accessibilityLabel="Skróć odpoczynek o 15 sekund"
            className="h-10 flex-1 flex-row items-center justify-center gap-1 rounded-xl bg-action-secondary border border-border"
          >
            <Minus size={14} strokeWidth={ICON_STROKE} color="#c0c9d8" />
            <Text className="text-text-secondary text-sm font-semibold">15s</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onAdjust(30)}
            accessibilityRole="button"
            accessibilityLabel="Wydłuż odpoczynek o 30 sekund"
            className="h-10 flex-1 flex-row items-center justify-center gap-1 rounded-xl bg-action-secondary border border-border"
          >
            <Plus size={14} strokeWidth={ICON_STROKE} color="#c0c9d8" />
            <Text className="text-text-secondary text-sm font-semibold">30s</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Pomiń odpoczynek"
            className={cx(
              "h-10 px-4 flex-row items-center justify-center gap-1 rounded-xl",
              "bg-action-primary",
            )}
          >
            <X size={16} strokeWidth={ICON_STROKE} color="#ffffff" />
            <Text className="text-white text-sm font-semibold">Pomiń</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
