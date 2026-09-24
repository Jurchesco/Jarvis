import { ActivityIndicator, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Activity, Battery, Moon, Scale } from "lucide-react-native";
import { Card, ICON_STROKE } from "./ui";
import { fetchReadinessToday, type ReadinessMetric } from "../lib/readinessToday";

const ICONS = {
  sleep: Moon,
  hrv: Activity,
  battery: Battery,
  weight: Scale,
} as const;

const ICON_COLORS = {
  sleep: "#818cf8",
  hrv: "#34d399",
  battery: "#fbbf24",
  weight: "#60a5fa",
} as const;

function MetricCell({ metric }: { metric: ReadinessMetric }) {
  const Icon = ICONS[metric.key];
  const color = ICON_COLORS[metric.key];
  return (
    <View className="flex-1 min-w-[64px] items-center px-1">
      <View className="mb-1.5 h-7 w-7 items-center justify-center rounded-lg bg-surface-muted border border-border">
        <Icon size={14} strokeWidth={ICON_STROKE} color={color} />
      </View>
      <Text className="text-text-muted text-[10px] font-semibold uppercase tracking-wide">
        {metric.label}
      </Text>
      <Text className="text-text-primary text-base font-bold leading-tight mt-0.5">{metric.value}</Text>
      {metric.detail ? (
        <Text className="text-text-muted text-[10px] mt-0.5 text-center" numberOfLines={1}>
          {metric.detail}
        </Text>
      ) : (
        <View className="h-3.5" />
      )}
    </View>
  );
}

/** Compact Home strip: sleep / HRV / Body Battery / weight — not a Garmin clone. */
export function ReadinessTodayStrip() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["readiness-today"],
    queryFn: fetchReadinessToday,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card padding="md" className="mb-4">
        <View className="flex-row items-center justify-center py-2">
          <ActivityIndicator color="#7c8aa5" />
          <Text className="ml-2 text-text-muted text-xs">Gotowość dziś…</Text>
        </View>
      </Card>
    );
  }

  if (isError || !data || data.empty) {
    return (
      <Card padding="md" className="mb-4" variant="muted">
        <Text className="text-text-secondary text-sm font-semibold">Gotowość dziś</Text>
        <Text className="text-text-muted text-xs mt-1 leading-5">
          Brak snu/HRV/wagi w bazie. Pojawi się po imporcie Garmina albo weigh-inie w Ustawieniach.
        </Text>
      </Card>
    );
  }

  return (
    <Card padding="md" className="mb-4">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-text-secondary text-sm font-semibold">Gotowość dziś</Text>
        <Text className="text-text-muted text-[10px]">{data.day}</Text>
      </View>
      <View className="flex-row items-start justify-between">
        {data.metrics.map((metric) => (
          <MetricCell key={metric.key} metric={metric} />
        ))}
      </View>
      {data.hint ? (
        <Text className="text-text-muted text-xs mt-3 leading-5 border-t border-border pt-3">
          {data.hint}
        </Text>
      ) : null}
    </Card>
  );
}
