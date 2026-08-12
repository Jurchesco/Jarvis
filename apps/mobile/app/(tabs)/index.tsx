import { useMemo, useState } from "react";
import { Alert, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Dumbbell, Flame, Play, TrendingUp } from "lucide-react-native";
import {
  computeSessionLiveStats,
  formatDuration,
  formatVolumeKg,
  sessionDurationSec,
} from "@bhmt3wp/shared";
import { APP_NAME } from "../../src/constants/branding";
import { useCompletedSessions, useCreateSession, useSession } from "../../src/api/hooks";
import { ensureFreestyleSheet } from "../../src/lib/ensureFreestyleSheet";
import {
  Button,
  Card,
  ICON_STROKE,
  ScreenHeader,
} from "../../src/components/ui";

export default function HomeScreen() {
  const router = useRouter();
  const createSession = useCreateSession();
  const { data: completedSessions } = useCompletedSessions();
  const [isStarting, setIsStarting] = useState(false);

  const lastSessionId = completedSessions?.[0]?.id ?? null;
  const { data: lastSession } = useSession(lastSessionId ?? "");

  const thisMonthCount = useMemo(() => {
    if (!completedSessions) return 0;
    const now = new Date();
    return completedSessions.filter((session) => {
      if (!session.completedAt) return false;
      const d = new Date(session.completedAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }, [completedSessions]);

  const lastSessionStats = useMemo(() => {
    if (!lastSession?.completedAt) return null;
    const stats = computeSessionLiveStats(lastSession.logs);
    const duration = sessionDurationSec(lastSession.startedAt, lastSession.completedAt);
    return { stats, duration };
  }, [lastSession]);

  const handleStartWorkout = async () => {
    setIsStarting(true);
    try {
      const { sheetId } = await ensureFreestyleSheet();
      createSession.mutate(
        { sheetId },
        {
          onSuccess: (session) => {
            router.push(`/workout/${session.id}?sheetId=${sheetId}`);
          },
          onError: (err) => {
            const msg = err instanceof Error ? err.message : "Nie można rozpocząć treningu";
            if (Platform.OS === "web") window.alert(msg);
            else Alert.alert("Błąd", msg);
          },
          onSettled: () => setIsStarting(false),
        },
      );
    } catch (err) {
      setIsStarting(false);
      const msg = err instanceof Error ? err.message : "Nie można przygotować treningu";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Błąd", msg);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="px-5 pt-3 pb-2">
        <ScreenHeader
          title={APP_NAME}
          subtitle={
            thisMonthCount > 0
              ? `${thisMonthCount} ${thisMonthCount === 1 ? "trening" : "treningi"} w tym miesiącu — wybieraj ćwiczenia na bieżąco.`
              : "Freestyle — odpal trening i wybieraj ćwiczenia z katalogu."
          }
          icon={Dumbbell}
        />
      </View>

      <View className="flex-1 px-5 pt-4">
        <Card padding="lg" className="border-emphasis/25 bg-surface">
          <View className="flex-row items-center mb-2">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-emphasis/15 border border-emphasis/30">
              <Flame size={20} strokeWidth={ICON_STROKE} color="#22c55e" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-text-primary text-xl font-bold leading-tight">Gotowy do treningu?</Text>
              <Text className="text-text-muted text-xs mt-0.5">Freestyle · katalog PPL</Text>
            </View>
          </View>

          <Text className="text-text-secondary text-sm mt-2 leading-5">
            Dodajesz ćwiczenia w trakcie sesji. Wpisujesz serie, ciężar i powtórzenia — resztę liczymy za Ciebie.
          </Text>

          <Button
            label="Rozpocznij trening"
            icon={Play}
            onPress={handleStartWorkout}
            loading={isStarting || createSession.isPending}
            className="mt-5"
          />
        </Card>

        {lastSessionStats ? (
          <Card padding="md" className="mt-4">
            <View className="flex-row items-center mb-2">
              <TrendingUp size={16} strokeWidth={ICON_STROKE} color="#60a5fa" />
              <Text className="ml-2 text-text-secondary text-sm font-semibold">Ostatni trening</Text>
            </View>
            <Text className="text-text-primary text-base font-bold leading-tight">
              {lastSessionStats.stats.totalVolume > 0
                ? formatVolumeKg(lastSessionStats.stats.totalVolume)
                : `${lastSessionStats.stats.setCount} serii`}
              {lastSessionStats.duration > 0 ? ` · ${formatDuration(lastSessionStats.duration)}` : ""}
            </Text>
            <Text className="text-text-muted text-xs mt-1">
              {lastSessionStats.stats.exerciseCount} ćwiczeń · {lastSessionStats.stats.setCount} serii
            </Text>
          </Card>
        ) : null}

        <Text className="text-text-muted text-xs text-center mt-8 px-4">
          Gotowe plany treningowe (PPL) pojawią się w osobnej zakładce — wkrótce.
        </Text>
      </View>
    </SafeAreaView>
  );
}
