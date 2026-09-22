import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Minus, Plus, X } from "lucide-react-native";
import { formatRestClock, type RestTimerState } from "../lib/useRestTimer";
import { ICON_STROKE } from "./ui/icons";

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
  const bottom = Math.max(insets.bottom, 12) + bottomOffset;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom,
        zIndex: 1000,
        elevation: 1000,
        paddingHorizontal: 16,
      }}
      accessibilityRole="summary"
      accessibilityLabel={`Odpoczynek ${formatRestClock(timer.leftSec)}`}
    >
      <View
        pointerEvents="auto"
        className="rounded-2xl border border-border bg-surface px-3 py-3 shadow-lg"
      >
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
          <Pressable
            onPress={() => onAdjust(-15)}
            accessibilityRole="button"
            accessibilityLabel="Skróć odpoczynek o 15 sekund"
            hitSlop={12}
            style={({ pressed }) => ({
              height: 44,
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#24324a",
              backgroundColor: "#152033",
              opacity: pressed ? 0.75 : 1,
            })}
            testID="rest-timer-minus-15"
          >
            <Minus size={14} strokeWidth={ICON_STROKE} color="#c0c9d8" />
            <Text className="text-text-secondary text-sm font-semibold">15s</Text>
          </Pressable>

          <Pressable
            onPress={() => onAdjust(30)}
            accessibilityRole="button"
            accessibilityLabel="Wydłuż odpoczynek o 30 sekund"
            hitSlop={12}
            style={({ pressed }) => ({
              height: 44,
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#24324a",
              backgroundColor: "#152033",
              opacity: pressed ? 0.75 : 1,
            })}
            testID="rest-timer-plus-30"
          >
            <Plus size={14} strokeWidth={ICON_STROKE} color="#c0c9d8" />
            <Text className="text-text-secondary text-sm font-semibold">30s</Text>
          </Pressable>

          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Pomiń odpoczynek"
            hitSlop={12}
            style={({ pressed }) => ({
              height: 44,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              borderRadius: 12,
              backgroundColor: "#3b82f6",
              opacity: pressed ? 0.75 : 1,
            })}
            testID="rest-timer-skip"
          >
            <X size={16} strokeWidth={ICON_STROKE} color="#ffffff" />
            <Text className="text-white text-sm font-semibold">Pomiń</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
