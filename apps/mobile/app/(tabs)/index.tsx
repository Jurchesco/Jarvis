import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ClipboardList, Clock3, Dumbbell, Flame, Play, TrendingUp } from "lucide-react-native";
import {
  computeSessionLiveStats,
  formatDuration,
  formatVolumeKg,
  sessionDurationSec,
} from "@bhmt3wp/shared";
import { APP_NAME } from "../../src/constants/branding";
import { api } from "../../src/api/client";
import {
  useAnyIncompleteSession,
  useCompletedSessions,
  useCreateSession,
  useDeleteSession,
  useSession,
  useSheets,
  useSheet,
} from "../../src/api/hooks";
import { WeekPlanStrip } from "../../src/components/WeekPlanStrip";
import { ensureFreestyleSheet, isFreestyleSheetName } from "../../src/lib/ensureFreestyleSheet";
import {
  todayWeekIndex,
  type WeekSlots,
} from "../../src/lib/weekPlan";
import {
  Badge,
  Button,
  Card,
  ICON_STROKE,
  ScreenHeader,
} from "../../src/components/ui";
import { formatExerciseCount, formatSetCount } from "../../src/lib/polishCount";

export default function HomeScreen() {
  const router = useRouter();
  const createSession = useCreateSession();
  const deleteSession = useDeleteSession();
  const { data: completedSessions } = useCompletedSessions();
  const { data: sheets } = useSheets();
  const [isStarting, setIsStarting] = useState(false);
  const [elapsedSinceStart, setElapsedSinceStart] = useState(0);
  const [weekSlots, setWeekSlots] = useState<WeekSlots | null>(null);

  const lastSessionId = completedSessions?.[0]?.id ?? null;
  const { data: lastSession } = useSession(lastSessionId ?? "");

  const { data: incompleteSession } = useAnyIncompleteSession();

  const todayIndex = todayWeekIndex();
  const todaySheetId = weekSlots?.[todayIndex] ?? null;
  const { data: todaySheet } = useSheet(todaySheetId ?? "");

  const todayPlan = useMemo(() => {
    if (!todaySheetId || !todaySheet) return null;
    if (isFreestyleSheetName(todaySheet.name)) return null;
    return todaySheet;
  }, [todaySheetId, todaySheet]);

  const handleSlotsChange = useCallback((slots: WeekSlots) => {
    setWeekSlots(slots);
  }, []);

  useEffect(() => {
    if (!incompleteSession?.startedAt) return;
    const startMs = new Date(incompleteSession.startedAt).getTime();
    const tick = () => setElapsedSinceStart(Math.floor((Date.now() - startMs) / 1000));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [incompleteSession?.startedAt]);

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

  const startSessionForSheet = async (sheetId: string, force = false) => {
    setIsStarting(true);
    try {
      const existing = incompleteSession ?? (await api.sessions.findIncomplete(sheetId));
      if (existing && !force) {
        router.push(`/workout/${existing.id}?sheetId=${sheetId}`);
        setIsStarting(false);
        return;
      }
      if (existing && force) {
        await deleteSession.mutateAsync(existing.id);
      }

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

  const handleStartFreestyle = async (force = false) => {
    try {
      const { sheetId } = await ensureFreestyleSheet();
      await startSessionForSheet(sheetId, force);
    } catch (err) {
      setIsStarting(false);
      const msg = err instanceof Error ? err.message : "Nie można przygotować treningu";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Błąd", msg);
    }
  };

  const handleStartTodayPlan = async () => {
    if (!todayPlan) return;
    if ((todayPlan.exercises?.length ?? 0) === 0) {
      const msg = "Ten plan nie ma jeszcze ćwiczeń — uzupełnij go albo wybierz inny dzień.";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Pusty plan", msg);
      router.push(`/sheet/${todayPlan.id}`);
      return;
    }
    await startSessionForSheet(todayPlan.id);
  };

  const handleResumeWorkout = () => {
    if (!incompleteSession) return;
    router.push(`/workout/${incompleteSession.id}?sheetId=${incompleteSession.sheetId}`);
  };

  const confirmCancelWorkout = () => {
    if (!incompleteSession) return;
    const title = "Anuluj trening";
    const message =
      "Usunąć rozpoczęty trening? Zapisane w tej sesji ćwiczenia też znikną. Tej operacji nie można odwrócić.";
    const run = () => deleteSession.mutate(incompleteSession.id);
    if (Platform.OS === "web") {
      if (window.confirm(`${title}\n\n${message}`)) run();
    } else {
      Alert.alert(title, message, [
        { text: "Zostań", style: "cancel" },
        { text: "Anuluj trening", style: "destructive", onPress: run },
      ]);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="px-5 pt-3 pb-2">
        <ScreenHeader
          title={APP_NAME}
          subtitle={
            thisMonthCount > 0
              ? `${thisMonthCount} ${thisMonthCount === 1 ? "trening" : "treningi"} w tym miesiącu — freestyle albo plan z tygodnia.`
              : "Ułóż tydzień albo odpal Freestyle / plan z katalogu."
          }
          icon={Dumbbell}
        />
      </View>

      <ScrollView className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 32 }}>
        {incompleteSession ? (
          <Card padding="lg" className="border-action-primary/30 bg-surface">
            <View className="flex-row items-center mb-2">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-action-primary/15 border border-action-primary/30">
                <Clock3 size={20} strokeWidth={ICON_STROKE} color="#3b82f6" />
              </View>
              <View className="ml-3 flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-text-primary text-xl font-bold leading-tight flex-1">
                    Trening w toku
                  </Text>
                  <Badge label="W trakcie" tone="accent" />
                </View>
                <Text className="text-text-muted text-xs mt-0.5">
                  Zacząłeś {formatDuration(elapsedSinceStart)} temu
                </Text>
              </View>
            </View>

            <Text className="text-text-secondary text-sm mt-2 leading-5">
              Masz niedokończony trening — wróć do niego, żeby nic nie zgubić. Działa dla freestyle i planu.
            </Text>

            <Button
              label="Kontynuuj trening"
              icon={Play}
              onPress={handleResumeWorkout}
              className="mt-5"
            />
            <Button
              label="Zacznij nowy trening"
              variant="ghost"
              size="sm"
              onPress={() => {
                const title = "Nowy trening";
                const message =
                  "Obecna sesja zostanie usunięta (wraz z zapisanymi ćwiczeniami) i zacznie się nowa. Kontynuować?";
                const run = () => handleStartFreestyle(true);
                if (Platform.OS === "web") {
                  if (window.confirm(`${title}\n\n${message}`)) run();
                } else {
                  Alert.alert(title, message, [
                    { text: "Zostań", style: "cancel" },
                    { text: "Zacznij nowy", style: "destructive", onPress: run },
                  ]);
                }
              }}
              loading={isStarting || createSession.isPending}
              className="mt-2"
            />
            <Button
              label="Anuluj trening"
              variant="ghost"
              size="sm"
              onPress={confirmCancelWorkout}
              loading={deleteSession.isPending}
              className="mt-1"
            />
          </Card>
        ) : (
          <Card padding="lg" className="border-emphasis/25 bg-surface">
            <View className="flex-row items-center mb-2">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-emphasis/15 border border-emphasis/30">
                <Flame size={20} strokeWidth={ICON_STROKE} color="#22c55e" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-text-primary text-xl font-bold leading-tight">Gotowy do treningu?</Text>
                <Text className="text-text-muted text-xs mt-0.5">
                  {todayPlan
                    ? `Dziś w tygodniu: ${todayPlan.name}`
                    : "Dziś bez planu — Freestyle albo wybierz układ"}
                </Text>
              </View>
            </View>

            <Text className="text-text-secondary text-sm mt-2 leading-5">
              Tydzień to tylko podpowiedź startu. Freestyle i inne plany zostają dostępne zawsze.
            </Text>

            {todayPlan ? (
              <Button
                label={`Dziś · ${todayPlan.name}`}
                icon={Play}
                onPress={() => void handleStartTodayPlan()}
                loading={isStarting || createSession.isPending}
                className="mt-5"
              />
            ) : (
              <Button
                label="Freestyle"
                icon={Play}
                onPress={() => void handleStartFreestyle()}
                loading={isStarting || createSession.isPending}
                className="mt-5"
              />
            )}

            {todayPlan ? (
              <Button
                label="Freestyle zamiast tego"
                icon={Play}
                variant="secondary"
                onPress={() => void handleStartFreestyle()}
                loading={isStarting || createSession.isPending}
                className="mt-3"
              />
            ) : null}

            <Button
              label="Wybierz plan"
              icon={ClipboardList}
              variant={todayPlan ? "ghost" : "secondary"}
              size={todayPlan ? "sm" : "md"}
              onPress={() => router.push("/plans")}
              className="mt-3"
            />
            <Button
              label="Baza ćwiczeń"
              icon={Dumbbell}
              variant="ghost"
              size="sm"
              onPress={() => router.push("/exercises")}
              className="mt-2"
            />
          </Card>
        )}

        <View className="mt-4">
          <WeekPlanStrip
            sheets={sheets}
            disabled={!!incompleteSession}
            onSlotsChange={handleSlotsChange}
          />
        </View>

        {lastSessionStats ? (
          <Card padding="md" className="mt-4">
            <View className="flex-row items-center mb-2">
              <TrendingUp size={16} strokeWidth={ICON_STROKE} color="#60a5fa" />
              <Text className="ml-2 text-text-secondary text-sm font-semibold">Ostatni trening</Text>
            </View>
            <Text className="text-text-primary text-base font-bold leading-tight">
              {lastSessionStats.stats.totalVolume > 0
                ? formatVolumeKg(lastSessionStats.stats.totalVolume)
                : formatSetCount(lastSessionStats.stats.setCount)}
              {lastSessionStats.duration > 0 ? ` · ${formatDuration(lastSessionStats.duration)}` : ""}
            </Text>
            <View className="mt-2 flex-row flex-wrap items-center gap-2">
              <Badge label={formatExerciseCount(lastSessionStats.stats.exerciseCount)} tone="neutral" />
              {lastSessionStats.stats.setCount > 0 ? (
                <Badge label={formatSetCount(lastSessionStats.stats.setCount)} tone="outline" />
              ) : null}
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
