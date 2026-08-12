import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  buildSessionSummaryInsights,
  formatVolumeKg,
} from "@bhmt3wp/shared";
import type { WorkoutSessionWithSheet } from "@bhmt3wp/shared";
import {
  CheckCircle2,
  Dumbbell,
  Flame,
  Home,
  Trophy,
  TrendingUp,
} from "lucide-react-native";
import { useCompletedSessions, useSession } from "../../../src/api/hooks";
import { Button, Card, ICON_SIZE, ICON_STROKE, StateBlock } from "../../../src/components/ui";

function HighlightCard({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string;
  value: string;
  detail?: string;
  accent?: boolean;
}) {
  return (
    <View
      className={`flex-1 rounded-xl border px-3 py-3 min-w-[46%] ${
        accent ? "border-emphasis/40 bg-emphasis/10" : "border-border bg-surface-muted"
      }`}
    >
      <Text className="text-text-muted text-[10px] font-semibold uppercase tracking-wide">{label}</Text>
      <Text
        className={`mt-1 text-xl font-bold leading-tight ${
          accent ? "text-emphasis" : "text-text-primary"
        }`}
      >
        {value}
      </Text>
      {detail ? <Text className="text-text-muted text-xs mt-1">{detail}</Text> : null}
    </View>
  );
}

export default function WorkoutSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = id!;
  const router = useRouter();

  const { data: session, isLoading } = useSession(sessionId);
  const { data: completedSessions } = useCompletedSessions();

  const previousSessionId = useMemo(() => {
    if (!completedSessions || !session) return null;
    const previous = completedSessions.find(
      (item: WorkoutSessionWithSheet) => item.id !== session.id,
    );
    return previous?.id ?? null;
  }, [completedSessions, session]);

  const { data: previousSession } = useSession(previousSessionId ?? "");

  const insights = useMemo(() => {
    if (!session?.completedAt) return null;
    return buildSessionSummaryInsights(
      session,
      previousSession?.completedAt ? previousSession : null,
    );
  }, [session, previousSession]);

  const handleClose = () => {
    if (router.canDismiss()) {
      router.dismissAll();
    }
    router.replace("/");
  };

  if (isLoading || !session) {
    return (
      <SafeAreaView className="flex-1 bg-background px-5 pt-8">
        <StateBlock title="Ładowanie podsumowania" description="Zbieramy statystyki sesji…" />
      </SafeAreaView>
    );
  }

  if (!session.completedAt || !insights) {
    return (
      <SafeAreaView className="flex-1 bg-background px-5 pt-8">
        <StateBlock
          title="Sesja nieukończona"
          description="To podsumowanie jest dostępne tylko dla zakończonych treningów."
          actionLabel="Wróć"
          onAction={handleClose}
        />
      </SafeAreaView>
    );
  }

  const completedDate = new Date(session.completedAt);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
        <View className="items-center pt-6 pb-4">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-emphasis/15 border border-emphasis/30">
            <CheckCircle2 size={36} strokeWidth={ICON_STROKE} color="#22c55e" />
          </View>
          <Text className="text-text-primary text-3xl font-bold mt-4 text-center leading-tight">
            {insights.headline}
          </Text>
          <Text className="text-text-secondary text-base mt-2 text-center px-2">
            {insights.subheadline}
          </Text>
          <Text className="text-text-muted text-sm mt-2">
            {completedDate.toLocaleDateString("pl-PL", {
              weekday: "long",
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>

        <View className="flex-row flex-wrap gap-2 mb-4">
          {insights.highlights.slice(0, 4).map((item) => (
            <HighlightCard
              key={item.label}
              label={item.label}
              value={item.value}
              detail={item.detail}
              accent={item.label === "Objętość" && (insights.comparison?.volumeDelta ?? 0) > 0}
            />
          ))}
        </View>

        {insights.highlights.length > 4 ? (
          <View className="flex-row flex-wrap gap-2 mb-4">
            {insights.highlights.slice(4).map((item) => (
              <HighlightCard key={item.label} label={item.label} value={item.value} detail={item.detail} />
            ))}
          </View>
        ) : null}

        {insights.comparison && insights.comparison.volumeDelta !== 0 ? (
          <Card padding="md" className="mb-4 border-emphasis/20 bg-emphasis/5">
            <View className="flex-row items-center mb-2">
              <TrendingUp size={ICON_SIZE} strokeWidth={ICON_STROKE} color="#22c55e" />
              <Text className="ml-2 text-emphasis text-sm font-bold uppercase">Porównanie z poprzednią sesją</Text>
            </View>
            <Text className="text-text-secondary text-sm">
              Objętość:{" "}
              <Text className="text-text-primary font-semibold">
                {formatVolumeKg(insights.comparison.previousVolume)}
              </Text>
              {" → "}
              <Text className="text-emphasis font-semibold">
                {formatVolumeKg(insights.stats.totalVolume)}
              </Text>
              {insights.comparison.volumeDeltaPercent != null
                ? ` (${insights.comparison.volumeDeltaPercent > 0 ? "+" : ""}${insights.comparison.volumeDeltaPercent}%)`
                : ""}
            </Text>
            {insights.comparison.exerciseDelta !== 0 || insights.comparison.setDelta !== 0 ? (
              <Text className="text-text-muted text-xs mt-2">
                {insights.comparison.exerciseDelta !== 0
                  ? `${insights.comparison.exerciseDelta > 0 ? "+" : ""}${insights.comparison.exerciseDelta} ćwiczeń · `
                  : ""}
                {insights.comparison.setDelta !== 0
                  ? `${insights.comparison.setDelta > 0 ? "+" : ""}${insights.comparison.setDelta} serii`
                  : ""}
              </Text>
            ) : null}
          </Card>
        ) : null}

        {insights.topExercises.length > 0 ? (
          <Card padding="md" className="mb-4">
            <View className="flex-row items-center mb-3">
              <Trophy size={ICON_SIZE} strokeWidth={ICON_STROKE} color="#fbbf24" />
              <Text className="ml-2 text-text-primary text-base font-bold">Największy wkład w objętość</Text>
            </View>
            {insights.topExercises.map((exercise, index) => (
              <View
                key={exercise.exerciseId}
                className={`flex-row items-center justify-between py-2.5 ${
                  index > 0 ? "border-t border-border" : ""
                }`}
              >
                <View className="flex-1 pr-3">
                  <Text className="text-text-primary text-sm font-semibold" numberOfLines={1}>
                    {index + 1}. {exercise.exerciseName}
                  </Text>
                  <Text className="text-text-muted text-xs mt-0.5">
                    {exercise.setCount} serii
                    {exercise.bestEst1rm > 0 ? ` · Est. 1RM ${exercise.bestEst1rm.toFixed(1)} kg` : ""}
                  </Text>
                </View>
                <Text className="text-text-primary text-sm font-bold">
                  {formatVolumeKg(exercise.volume)}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}

        <Card padding="md" className="mb-6 bg-surface-muted">
          <View className="flex-row items-start">
            <Flame size={18} strokeWidth={ICON_STROKE} color="#60a5fa" />
            <Text className="ml-2 flex-1 text-text-secondary text-sm leading-5">
              {insights.stats.totalVolume > 0
                ? `Podniosłeś łącznie ${formatVolumeKg(insights.stats.totalVolume)} — to ${
                    insights.stats.totalVolume >= 3000 ? "poważna" : "solidna"
                  } dawka bodźca dla mięśni.`
                : "Sesja z ćwiczeniami na czas też się liczy — liczy się regularność."}
              {" "}
              Hydratacja i sen to połowa regeneracji.
            </Text>
          </View>
        </Card>

        <Button label="Gotowe" icon={Home} onPress={handleClose} className="mb-2" />
        <Button
          label="Zobacz w historii"
          icon={Dumbbell}
          variant="secondary"
          onPress={() => router.replace(`/history/${sessionId}`)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
