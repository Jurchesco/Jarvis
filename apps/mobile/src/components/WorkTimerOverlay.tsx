import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, X } from "lucide-react-native";
import { formatWorkClock, type WorkTimerState } from "../lib/useWorkTimer";
import { ICON_STROKE } from "./ui/icons";

type WorkTimerOverlayProps = {
  timer: WorkTimerState;
  onFinishEarly: () => void;
  onCancel: () => void;
  bottomOffset?: number;
};

/**
 * Floating hold countdown for timed sets (not in ScrollView).
 * OpenGym-inspired: separate from rest; early stop = actual held time.
 */
export function WorkTimerOverlay({
  timer,
  onFinishEarly,
  onCancel,
  bottomOffset = 0,
}: WorkTimerOverlayProps) {
  const insets = useSafeAreaInsets();
  const pct = timer.totalSec > 0 ? Math.min(100, (timer.leftSec / timer.totalSec) * 100) : 0;
  const held = Math.max(0, timer.totalSec - timer.leftSec);
  const bottom = Math.max(insets.bottom, 12) + bottomOffset;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom,
        zIndex: 1001,
        elevation: 1001,
        paddingHorizontal: 16,
      }}
      accessibilityRole="summary"
      accessibilityLabel={`Utrzymaj ${formatWorkClock(timer.leftSec)}`}
    >
      <View
        pointerEvents="auto"
        className="rounded-2xl border border-emphasis/40 bg-surface px-3 py-3 shadow-lg"
      >
        {timer.label ? (
          <Text className="text-text-muted text-xs font-semibold uppercase mb-2" numberOfLines={1}>
            Utrzymaj · {timer.label}
          </Text>
        ) : (
          <Text className="text-text-muted text-xs font-semibold uppercase mb-2">Utrzymaj</Text>
        )}

        <View className="flex-row items-center gap-3 mb-1">
          <Text className="text-text-primary text-3xl font-bold tabular-nums leading-none min-w-[72px]">
            {formatWorkClock(timer.leftSec)}
          </Text>
          <View className="flex-1 h-2.5 rounded-full bg-surface-muted overflow-hidden">
            <View
              className="h-full rounded-full bg-emphasis"
              style={{ width: `${pct}%` }}
            />
          </View>
        </View>
        <Text className="text-text-muted text-xs mb-3">
          Cel {formatWorkClock(timer.totalSec)}
          {held > 0 ? ` · już ${held}s` : ""}
        </Text>

        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={onFinishEarly}
            accessibilityRole="button"
            accessibilityLabel="Zakończ utrzymanie — zapisz aktualny czas"
            style={({ pressed }) => ({
              height: 48,
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              borderRadius: 12,
              backgroundColor: "#22c55e",
              opacity: pressed ? 0.8 : 1,
            })}
            testID="work-timer-finish"
          >
            <Check size={16} strokeWidth={ICON_STROKE} color="#04110a" />
            <Text className="text-background text-sm font-bold">Koniec</Text>
          </Pressable>
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Anuluj timer utrzymania"
            style={({ pressed }) => ({
              height: 48,
              width: 48,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#24324a",
              backgroundColor: "#152033",
              opacity: pressed ? 0.75 : 1,
            })}
            testID="work-timer-cancel"
          >
            <X size={18} strokeWidth={ICON_STROKE} color="#c0c9d8" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
