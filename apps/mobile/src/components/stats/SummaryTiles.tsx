import { Text, View } from "react-native";
import { Calendar, Dumbbell, Flame, Scale } from "lucide-react-native";
import { Card, ICON_STROKE } from "../ui";

type Tone = "neutral" | "good" | "warn";

type Tile = {
  key: string;
  label: string;
  value: string;
  icon: typeof Dumbbell;
  color: string;
  valueColor?: string;
};

function toneColor(tone: Tone): string {
  if (tone === "good") return "#22c55e";
  if (tone === "warn") return "#f59e0b";
  return "#f8fafc";
}

export function SummaryTiles({
  totalWorkouts,
  thisMonth,
  weekStreak,
  weightDelta30,
  weightTone,
}: {
  totalWorkouts: number;
  thisMonth: number;
  weekStreak: number;
  weightDelta30: number | null;
  weightTone: Tone;
}) {
  const weightValue =
    weightDelta30 == null
      ? "—"
      : `${weightDelta30 > 0 ? "+" : ""}${weightDelta30} kg`;

  const tiles: Tile[] = [
    {
      key: "total",
      label: "Treningi",
      value: String(totalWorkouts),
      icon: Dumbbell,
      color: "#60a5fa",
    },
    {
      key: "month",
      label: "Ten miesiąc",
      value: String(thisMonth),
      icon: Calendar,
      color: "#a78bfa",
    },
    {
      key: "streak",
      label: "Seria tyg.",
      value: String(weekStreak),
      icon: Flame,
      color: "#f97316",
    },
    {
      key: "bw",
      label: "Waga 30d",
      value: weightValue,
      icon: Scale,
      color: "#34d399",
      valueColor: toneColor(weightTone),
    },
  ];

  return (
    <View className="mt-5 flex-row flex-wrap gap-2.5">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <Card key={tile.key} padding="md" className="w-[47%] flex-grow min-w-[140px]">
            <View className="flex-row items-center mb-2">
              <Icon size={14} strokeWidth={ICON_STROKE} color={tile.color} />
              <Text className="ml-1.5 text-text-muted text-[10px] font-semibold uppercase tracking-wide">
                {tile.label}
              </Text>
            </View>
            <Text
              className="text-2xl font-bold leading-tight"
              style={{ color: tile.valueColor ?? "#f8fafc" }}
            >
              {tile.value}
            </Text>
          </Card>
        );
      })}
    </View>
  );
}
