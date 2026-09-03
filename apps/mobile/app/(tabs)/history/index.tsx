import { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Platform, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flame,
  PencilLine,
  Trash2,
} from "lucide-react-native";
import type { SessionDetailFull, WorkoutSessionWithSheet } from "@bhmt3wp/shared";
import {
  computeMonthBestStreak,
  computeSessionLiveStats,
  computeWorkoutStreak,
  formatDuration,
  formatVolumeKg,
  sessionDurationSec,
} from "@bhmt3wp/shared";
import {
  useCompletedSessions,
  useDeleteSession,
  useIncompleteSession,
  useSessionsByIds,
} from "../../../src/api/hooks";
import { formatSessionWhenShort, sessionDateKey } from "../../../src/lib/sessionDate";
import { ensureFreestyleSheet } from "../../../src/lib/ensureFreestyleSheet";
import { formatExerciseCount, formatSetCount } from "../../../src/lib/polishCount";
import {
  Badge,
  Card,
  ICON_SIZE,
  ICON_STROKE,
  ScreenHeader,
  StateBlock,
} from "../../../src/components/ui";

const DAYS = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nie"];
const MONTHS = [
  "Styczeń",
  "Luty",
  "Marzec",
  "Kwiecień",
  "Maj",
  "Czerwiec",
  "Lipiec",
  "Sierpień",
  "Wrzesień",
  "Październik",
  "Listopad",
  "Grudzień",
];

const MONTHS_LOCATIVE = [
  "Styczniu",
  "Lutym",
  "Marcu",
  "Kwietniu",
  "Maju",
  "Czerwcu",
  "Lipcu",
  "Sierpniu",
  "Wrześniu",
  "Październiku",
  "Listopadzie",
  "Grudniu",
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function sessionLabel(sheetName: string): string {
  return sheetName === "Freestyle" ? "Trening freestyle" : sheetName;
}

function MonthStat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center py-2">
      <Text className="text-text-muted text-[10px] font-semibold uppercase">{label}</Text>
      <Text className="text-text-primary text-base font-bold mt-0.5">{value}</Text>
    </View>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const { data: sessions, isLoading } = useCompletedSessions();
  const deleteSession = useDeleteSession();
  const [freestyleSheetId, setFreestyleSheetId] = useState<string | null>(null);

  useEffect(() => {
    ensureFreestyleSheet()
      .then(({ sheetId }) => setFreestyleSheetId(sheetId))
      .catch(() => {});
  }, []);

  const { data: incompleteSession } = useIncompleteSession(freestyleSheetId ?? undefined);

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const workoutDays = useMemo(() => {
    const set = new Set<string>();
    if (sessions) {
      for (const s of sessions) {
        set.add(sessionDateKey(s.startedAt));
      }
    }
    return set;
  }, [sessions]);

  const monthSessions = useMemo(() => {
    if (!sessions) return [];
    return sessions.filter((s) => {
      const d = new Date(s.startedAt);
      return d.getFullYear() === calYear && d.getMonth() === calMonth;
    });
  }, [sessions, calYear, calMonth]);

  const monthSessionIds = useMemo(() => monthSessions.map((s) => s.id), [monthSessions]);
  const { sessionsById } = useSessionsByIds(monthSessionIds);

  const monthSummary = useMemo(() => {
    let totalVolume = 0;
    let totalSets = 0;

    for (const id of monthSessionIds) {
      const detail = sessionsById.get(id);
      if (!detail) continue;
      const stats = computeSessionLiveStats(detail.logs);
      totalVolume += stats.totalVolume;
      totalSets += stats.setCount;
    }

    const startedDates = (sessions ?? []).map((s) => s.startedAt);
    const globalStreak = computeWorkoutStreak(startedDates);
    const monthBestStreak = computeMonthBestStreak(startedDates, calYear, calMonth);

    return { totalVolume, totalSets, globalStreak, monthBestStreak };
  }, [monthSessionIds, sessionsById, sessions, calYear, calMonth]);

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfWeek(calYear, calMonth);

  const confirmDeleteSession = (id: string, sheetName: string) => {
    const title = "Usuń trening";
    const message = `Usunąć "${sessionLabel(sheetName)}" z historii? Tej operacji nie można odwrócić.`;
    const runDelete = () => deleteSession.mutate(id);
    if (Platform.OS === "web") {
      if (window.confirm(`${title}\n\n${message}`)) runDelete();
    } else {
      Alert.alert(title, message, [
        { text: "Anuluj", style: "cancel" },
        { text: "Usuń", style: "destructive", onPress: runDelete },
      ]);
    }
  };

  const goToPrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((y) => y - 1);
    } else {
      setCalMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((y) => y + 1);
    } else {
      setCalMonth((m) => m + 1);
    }
  };

  const renderCalendar = () => {
    const cells: JSX.Element[] = [];

    for (const name of DAYS) {
      cells.push(
        <View key={`h-${name}`} className="flex-1 items-center py-1.5">
          <Text className="text-text-muted text-xs font-semibold">{name}</Text>
        </View>,
      );
    }

    for (let i = 0; i < firstDay; i++) {
      cells.push(<View key={`e-${i}`} className="flex-1 items-center py-1.5" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const hasWorkout = workoutDays.has(dateStr);
      const isToday =
        day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();

      cells.push(
        <View key={`d-${day}`} className="flex-1 items-center py-1.5">
          <View
            className={`h-8 w-8 items-center justify-center rounded-full ${
              hasWorkout ? "bg-emphasis" : isToday ? "border border-action-primary" : ""
            }`}
          >
            <Text
              className={`text-sm ${
                hasWorkout
                  ? "font-bold text-background"
                  : isToday
                    ? "font-bold text-action-primary"
                    : "text-text-secondary"
              }`}
            >
              {day}
            </Text>
          </View>
        </View>,
      );
    }

    const totalCells = firstDay + daysInMonth;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 0; i < remaining; i++) {
      cells.push(<View key={`r-${i}`} className="flex-1 items-center py-1.5" />);
    }

    const rows: JSX.Element[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(
        <View key={`row-${i}`} className="flex-row">
          {cells.slice(i, i + 7)}
        </View>,
      );
    }

    return rows;
  };

  const renderSession = ({ item }: { item: WorkoutSessionWithSheet }) => {
    const detail: SessionDetailFull | undefined = sessionsById.get(item.id);
    const stats = detail ? computeSessionLiveStats(detail.logs) : null;
    const durationSec = detail
      ? sessionDurationSec(detail.startedAt, detail.completedAt)
      : 0;

    return (
      <Card className="mb-3">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => router.push(`/history/${item.id}`)}
            activeOpacity={0.8}
            className="flex-1 pr-3"
          >
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="text-text-primary text-base font-bold leading-tight">
                {sessionLabel(item.sheetName)}
              </Text>
              {!item.completedAt ? <Badge label="W trakcie" tone="accent" /> : null}
            </View>
            <View className="mt-1 flex-row items-center">
              <Clock3 size={14} strokeWidth={2} color="#7c8aa5" />
              <Text className="ml-1.5 text-text-muted text-sm">
                {formatSessionWhenShort(item.startedAt, item.completedAt)}
              </Text>
            </View>

            {stats && stats.setCount > 0 ? (
              <View className="mt-2 flex-row flex-wrap items-center gap-2">
                {durationSec > 0 ? (
                  <Text className="text-text-secondary text-xs">{formatDuration(durationSec)}</Text>
                ) : null}
                {stats.totalVolume > 0 ? (
                  <Text className="text-text-secondary text-xs">{formatVolumeKg(stats.totalVolume)}</Text>
                ) : null}
                <Badge label={formatExerciseCount(stats.exerciseCount)} tone="neutral" />
                <Badge label={formatSetCount(stats.setCount)} tone="outline" />
              </View>
            ) : null}
          </TouchableOpacity>

          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => router.push(`/history/${item.id}`)}
              className="h-9 w-9 items-center justify-center rounded-xl bg-action-secondary border border-border"
              accessibilityLabel={`Edytuj ${sessionLabel(item.sheetName)}`}
            >
              <PencilLine size={16} strokeWidth={ICON_STROKE} color="#c0c9d8" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => confirmDeleteSession(item.id, item.sheetName)}
              className="h-9 w-9 items-center justify-center rounded-xl bg-action-secondary border border-border"
              accessibilityLabel={`Usuń ${sessionLabel(item.sheetName)}`}
            >
              <Trash2 size={16} strokeWidth={ICON_STROKE} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {isLoading ? (
        <View className="px-5 pt-8">
          <StateBlock title="Wczytywanie historii treningów" description="Przygotowywanie osi czasu Twoich sesji." />
        </View>
      ) : (
        <FlatList
          data={monthSessions}
          keyExtractor={(item) => item.id}
          renderItem={renderSession}
          extraData={[deleteSession.isPending, sessionsById, incompleteSession]}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 130 }}
          ListHeaderComponent={
            <>
              <View className="pt-3 pb-2">
                <ScreenHeader
                  title="Historia"
                  subtitle="Przeglądaj zakończone sesje miesiąc po miesiącu."
                  icon={CalendarDays}
                />
              </View>

              <Card className="mt-2 mb-4" padding="md">
                <View className="mb-3 flex-row items-center justify-between">
                  <TouchableOpacity
                    onPress={goToPrevMonth}
                    className="h-9 w-9 items-center justify-center rounded-xl bg-action-secondary border border-border"
                    accessibilityRole="button"
                    accessibilityLabel="Poprzedni miesiąc"
                  >
                    <ChevronLeft size={ICON_SIZE} strokeWidth={ICON_STROKE} color="#c0c9d8" />
                  </TouchableOpacity>

                  <Text className="text-text-primary text-base font-bold leading-tight">
                    {MONTHS[calMonth]} {calYear}
                  </Text>

                  <TouchableOpacity
                    onPress={goToNextMonth}
                    className="h-9 w-9 items-center justify-center rounded-xl bg-action-secondary border border-border"
                    accessibilityRole="button"
                    accessibilityLabel="Następny miesiąc"
                  >
                    <ChevronRight size={ICON_SIZE} strokeWidth={ICON_STROKE} color="#c0c9d8" />
                  </TouchableOpacity>
                </View>

                {renderCalendar()}

                <View className="mt-3 flex-row items-center justify-center gap-4">
                  <View className="flex-row items-center">
                    <View className="mr-1.5 h-3 w-3 rounded-full bg-emphasis" />
                    <Text className="text-text-muted text-xs">Zaliczony trening</Text>
                  </View>
                  <View className="flex-row items-center">
                    <View className="mr-1.5 h-3 w-3 rounded-full border border-action-primary" />
                    <Text className="text-text-muted text-xs">Dziś</Text>
                  </View>
                </View>
              </Card>

              {monthSessions.length > 0 ? (
                <Card className="mb-4 border-emphasis/20 bg-emphasis/5" padding="md">
                  <View className="flex-row items-center mb-3">
                    <Flame size={16} strokeWidth={ICON_STROKE} color="#22c55e" />
                    <Text className="ml-2 text-text-primary text-sm font-bold">
                      Podsumowanie {MONTHS_LOCATIVE[calMonth]}
                    </Text>
                  </View>
                  <View className="flex-row border-t border-border/60 pt-2">
                    <MonthStat label="Treningi" value={String(monthSessions.length)} />
                    <MonthStat
                      label="Objętość"
                      value={monthSummary.totalVolume > 0 ? formatVolumeKg(monthSummary.totalVolume) : "—"}
                    />
                    <MonthStat
                      label="Seria"
                      value={
                        monthSummary.monthBestStreak > 0
                          ? `${monthSummary.monthBestStreak} dni`
                          : "—"
                      }
                    />
                    <MonthStat label="Serie" value={String(monthSummary.totalSets)} />
                  </View>
                  {monthSummary.globalStreak.current > 0 ? (
                    <Text className="text-emphasis text-xs mt-2 text-center">
                      Aktywna seria: {monthSummary.globalStreak.current}{" "}
                      {monthSummary.globalStreak.current === 1 ? "dzień" : "dni"} z rzędu
                    </Text>
                  ) : null}
                </Card>
              ) : null}

              {incompleteSession && freestyleSheetId ? (
                <Card className="mb-4 border-emphasis/30" padding="md">
                  <TouchableOpacity
                    onPress={() =>
                      router.push(`/workout/${incompleteSession.id}?sheetId=${freestyleSheetId}`)
                    }
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Kontynuuj trening w trakcie"
                  >
                    <View className="flex-row items-center justify-between gap-3">
                      <View className="flex-1 min-w-0">
                        <View className="flex-row flex-wrap items-center gap-2">
                          <Text className="text-text-primary text-base font-bold leading-tight">
                            Trening freestyle
                          </Text>
                          <Badge label="W trakcie" tone="accent" />
                        </View>
                        <Text className="text-text-muted text-xs mt-1">
                          Niedokończona sesja — wróć, żeby nic nie zgubić.
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </Card>
              ) : null}

              <View className="mb-2">
                <Text className="text-text-secondary text-sm">
                  {monthSessions.length > 0
                    ? `${monthSessions.length} ${monthSessions.length === 1 ? "sesja" : "sesje"} w ${MONTHS_LOCATIVE[calMonth]}`
                    : `Brak sesji w ${MONTHS_LOCATIVE[calMonth]}`}
                </Text>
                <Text className="text-text-muted text-xs mt-1">
                  Dotknij wpis, aby zobaczyć szczegóły. Ołówek — edycja, kosz — usuń.
                </Text>
              </View>
            </>
          }
          ListEmptyComponent={
            <StateBlock
              title="Brak wpisów w tym miesiącu"
              description="Zakończ trening, aby zobaczył się na tej osi czasu."
              className="mt-2"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
