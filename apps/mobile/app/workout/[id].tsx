import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCompleteSession,
  useLastSessionBySheet,
  useSession,
  useSessionExerciseNotes,
  useSheet,
} from "../../src/api/hooks";
import type { CatalogExercise, ExerciseFull, SessionSetLog } from "@bhmt3wp/shared";
import {
  computeSessionLiveStats,
  formatDuration,
  formatVolumeKg,
  formatWeightKg,
  isTimeBasedExercise,
} from "@bhmt3wp/shared";
import {
  Check,
  Flame,
  PencilLine,
  Plus,
} from "lucide-react-native";
import { ExercisePicker } from "../../src/components/ExercisePicker";
import {
  createDraftFromLogs,
  ExerciseLogForm,
  ExerciseLogSummary,
  type ExerciseLogDraft,
} from "../../src/components/ExerciseLogForm";
import { addCatalogExerciseToSheet } from "../../src/lib/addCatalogExercise";
import { getAutofillPrevious } from "../../src/lib/appPreferences";
import { hapticSuccess } from "../../src/lib/haptics";
import { parseExerciseLogDraft, saveExerciseLogBatch } from "../../src/lib/saveExerciseLogBatch";
import {
  Button,
  Card,
  ICON_STROKE,
  StateBlock,
} from "../../src/components/ui";

function confirmAction(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: "Anuluj", style: "cancel" },
      { text: "Potwierdź", onPress: onConfirm },
    ]);
  }
}

function StatTile({
  label,
  value,
  borderedRight = false,
  borderedTop = false,
}: {
  label: string;
  value: string;
  borderedRight?: boolean;
  borderedTop?: boolean;
}) {
  return (
    <View
      className={`flex-1 px-3 py-2.5${borderedRight ? " border-r border-border" : ""}${borderedTop ? " border-t border-border" : ""}`}
    >
      <Text className="text-text-muted text-[10px] font-semibold uppercase tracking-wide leading-none">
        {label}
      </Text>
      <Text className="text-text-primary text-base font-bold mt-1 leading-tight" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function SessionStatsGrid({
  exerciseCount,
  setCount,
  totalVolume,
  elapsedSec,
  bestEst1rm,
  totalReps,
}: {
  exerciseCount: number;
  setCount: number;
  totalVolume: number;
  elapsedSec: number;
  bestEst1rm: number;
  totalReps: number;
}) {
  return (
    <View className="mt-4 rounded-xl border border-border bg-surface-muted overflow-hidden">
      <View className="flex-row">
        <StatTile label="Ćwiczenia" value={String(exerciseCount)} borderedRight />
        <StatTile label="Serie" value={String(setCount)} />
      </View>
      <View className="flex-row">
        <StatTile
          label="Objętość"
          value={totalVolume > 0 ? formatVolumeKg(totalVolume) : "—"}
          borderedRight
          borderedTop
        />
        <StatTile label="Czas" value={formatDuration(elapsedSec)} borderedTop />
      </View>
      <View className="flex-row">
        <StatTile
          label="Naj. 1RM"
          value={bestEst1rm > 0 ? formatWeightKg(bestEst1rm) : "—"}
          borderedRight
          borderedTop
        />
        <StatTile
          label="Powtórzenia"
          value={totalReps > 0 ? String(totalReps) : "—"}
          borderedTop
        />
      </View>
    </View>
  );
}

export default function WorkoutScreen() {
  const { id, sheetId } = useLocalSearchParams<{ id: string; sheetId: string }>();
  const sessionId = id!;
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: sheet, refetch: refetchSheet } = useSheet(sheetId!);
  const { data: session, refetch: refetchSession } = useSession(sessionId);
  const completeSession = useCompleteSession();
  const { data: lastSessionData } = useLastSessionBySheet(sheetId!);
  const { data: exerciseNotes } = useSessionExerciseNotes(sessionId);

  const [sessionExerciseIds, setSessionExerciseIds] = useState<Set<string>>(new Set());
  const [savedExerciseIds, setSavedExerciseIds] = useState<Set<string>>(new Set());
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [savingExerciseId, setSavingExerciseId] = useState<string | null>(null);
  const [autofillPrevious, setAutofillPrevious] = useState(true);

  useEffect(() => {
    getAutofillPrevious().then(setAutofillPrevious);
  }, []);

  const previousByExercise = useMemo(() => {
    const map: Record<string, SessionSetLog> = {};
    if (lastSessionData?.logs) {
      for (const log of lastSessionData.logs) {
        map[log.exerciseId] = log;
      }
    }
    return map;
  }, [lastSessionData]);

  const notesByExercise = useMemo(() => {
    const map: Record<string, string> = {};
    for (const note of exerciseNotes ?? []) {
      map[note.exerciseId] = note.notes;
    }
    return map;
  }, [exerciseNotes]);

  const liveStats = useMemo(
    () => computeSessionLiveStats(session?.logs ?? []),
    [session?.logs],
  );

  const activeExercises = useMemo(() => {
    if (!sheet) return [];
    const logExerciseIds = new Set(session?.logs.map((log) => log.exerciseId) ?? []);
    return sheet.exercises.filter(
      (exercise) => sessionExerciseIds.has(exercise.id) || logExerciseIds.has(exercise.id),
    );
  }, [sheet, sessionExerciseIds, session?.logs]);

  const existingExerciseNames = useMemo(
    () => activeExercises.map((exercise) => exercise.name),
    [activeExercises],
  );

  useEffect(() => {
    if (!session?.logs) return;
    const fromLogs = new Set<string>();
    const saved = new Set<string>();
    for (const log of session.logs) {
      fromLogs.add(log.exerciseId);
      saved.add(log.exerciseId);
    }
    if (fromLogs.size > 0) {
      setSessionExerciseIds((prev) => new Set([...prev, ...fromLogs]));
      setSavedExerciseIds((prev) => new Set([...prev, ...saved]));
    }
  }, [session?.logs]);

  useEffect(() => {
    if (!session?.startedAt) return;
    const startMs = new Date(session.startedAt).getTime();
    const tick = () => setElapsedSec(Math.floor((Date.now() - startMs) / 1000));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [session?.startedAt]);

  const refreshData = useCallback(async () => {
    await Promise.all([
      refetchSheet(),
      refetchSession(),
      queryClient.invalidateQueries({ queryKey: ["sheets", sheetId] }),
      queryClient.invalidateQueries({ queryKey: ["sessions", sessionId] }),
      queryClient.invalidateQueries({ queryKey: ["sessions", sessionId, "exercise-notes"] }),
    ]);
  }, [queryClient, refetchSession, refetchSheet, sessionId, sheetId]);

  const handleAddFromCatalog = async (exercise: CatalogExercise | { name: string; timeBased?: boolean }) => {
    if (!sheet) return;
    setIsAddingExercise(true);
    try {
      const orderIndex = sheet.exercises.length;
      const { exerciseId } = await addCatalogExerciseToSheet(sheetId!, exercise, orderIndex, {
        setCount: 0,
      });
      setSessionExerciseIds((prev) => new Set(prev).add(exerciseId));
      setSavedExerciseIds((prev) => {
        const next = new Set(prev);
        next.delete(exerciseId);
        return next;
      });
      setEditingExerciseId(exerciseId);
      setShowExercisePicker(false);
      await refreshData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Nie można dodać ćwiczenia";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Błąd", msg);
    } finally {
      setIsAddingExercise(false);
    }
  };

  const handleSaveExercise = async (exercise: ExerciseFull, draft: ExerciseLogDraft) => {
    setSavingExerciseId(exercise.id);
    try {
      const parsed = parseExerciseLogDraft(exercise.name, draft);
      await saveExerciseLogBatch(sessionId, exercise, parsed);
      setSavedExerciseIds((prev) => new Set(prev).add(exercise.id));
      setEditingExerciseId(null);
      await hapticSuccess();
      await refreshData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Nie można zapisać ćwiczenia";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Błąd", msg);
    } finally {
      setSavingExerciseId(null);
    }
  };

  const getExerciseLogs = (exerciseId: string) =>
    (session?.logs ?? [])
      .filter((log) => log.exerciseId === exerciseId)
      .sort((a, b) => a.setNumber - b.setNumber);

  const handleFinishWorkout = () => {
    const loggedSets = session?.logs.length ?? 0;
    if (loggedSets === 0) {
      const msg = "Zapisz przynajmniej jedno ćwiczenie przed zakończeniem treningu.";
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("Nie można zakończyć", msg);
      }
      return;
    }

    confirmAction("Zakończ trening", "Czy chcesz teraz zakończyć tę sesję?", async () => {
      try {
        await completeSession.mutateAsync(sessionId);
        router.replace(`/workout/summary/${sessionId}`);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        if (Platform.OS === "web") {
          window.alert(`Błąd: ${msg}`);
        } else {
          Alert.alert("Błąd", msg);
        }
      }
    });
  };

  if (!sheet) {
    return (
      <SafeAreaView className="flex-1 bg-background px-5 pt-8" edges={["bottom"]}>
        <StateBlock title="Wczytywanie treningu" description="Przygotowywanie aktywnej sesji." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <View className="px-5 pt-3 pb-2">
        <Card padding="md">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <View className="flex-row items-center">
                <Flame size={16} strokeWidth={ICON_STROKE} color="#22c55e" />
                <Text className="ml-1.5 text-emphasis text-xs font-semibold uppercase">
                  Trening w trakcie
                </Text>
              </View>
              <Text className="text-text-primary text-xl font-bold mt-1 leading-tight">Freestyle</Text>
            </View>

            <Button
              label="Zakończ"
              icon={Check}
              variant="danger"
              size="sm"
              onPress={handleFinishWorkout}
              loading={completeSession.isPending}
            />
          </View>

          <SessionStatsGrid
            exerciseCount={liveStats.exerciseCount}
            setCount={liveStats.setCount}
            totalVolume={liveStats.totalVolume}
            elapsedSec={elapsedSec}
            bestEst1rm={liveStats.bestEst1rm}
            totalReps={liveStats.totalReps}
          />
        </Card>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {activeExercises.length === 0 ? (
          <StateBlock
            title="Dodaj pierwsze ćwiczenie"
            description="Wybierz ćwiczenie z katalogu, wpisz liczbę serii, ciężar i powtórzenia — resztę policzymy za Ciebie."
            actionLabel="Dodaj ćwiczenie"
            onAction={() => setShowExercisePicker(true)}
            className="mt-4"
          />
        ) : (
          activeExercises.map((exercise) => {
            const logs = getExerciseLogs(exercise.id);
            const isSaved = savedExerciseIds.has(exercise.id) && logs.length > 0;
            const isEditing = editingExerciseId === exercise.id || !isSaved;
            const rawPreviousLog = previousByExercise[exercise.id] ?? null;
            const previousLog = autofillPrevious ? rawPreviousLog : null;
            const initialDraft = isSaved
              ? createDraftFromLogs(logs, notesByExercise[exercise.id] ?? "")
              : {
                  setCount: "1",
                  weightKg: previousLog ? String(previousLog.weightKg) : "0",
                  reps: previousLog ? String(previousLog.reps) : "10",
                  notes: notesByExercise[exercise.id] ?? "",
                };

            return (
              <Card key={exercise.id} className="mb-3" padding="md">
                <View className="flex-row items-start justify-between mb-3">
                  <Text className="text-text-primary text-lg font-bold flex-1 pr-3">{exercise.name}</Text>
                  {isSaved && !isEditing ? (
                    <TouchableOpacity
                      onPress={() => setEditingExerciseId(exercise.id)}
                      className="h-9 w-9 items-center justify-center rounded-xl bg-action-secondary border border-border"
                      accessibilityLabel={`Edytuj ${exercise.name}`}
                    >
                      <PencilLine size={16} strokeWidth={ICON_STROKE} color="#c0c9d8" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {isEditing ? (
                  <ExerciseLogForm
                    key={`${exercise.id}-${isSaved ? "edit" : "new"}`}
                    exerciseName={exercise.name}
                    timeBased={isTimeBasedExercise(exercise.name)}
                    previousLog={previousLog}
                    initialDraft={initialDraft}
                    onSave={(draft) => handleSaveExercise(exercise, draft)}
                    onCancel={
                      isSaved
                        ? () => setEditingExerciseId(null)
                        : undefined
                    }
                    loading={savingExerciseId === exercise.id}
                    saveLabel={isSaved ? "Zaktualizuj" : "Zapisz ćwiczenie"}
                  />
                ) : (
                  <ExerciseLogSummary
                    exerciseName={exercise.name}
                    setCount={logs.length}
                    weightKg={logs[0]?.weightKg ?? 0}
                    reps={logs[0]?.reps ?? 0}
                    notes={notesByExercise[exercise.id]}
                    timeBased={isTimeBasedExercise(exercise.name)}
                    onEdit={() => setEditingExerciseId(exercise.id)}
                  />
                )}
              </Card>
            );
          })
        )}

        {activeExercises.length > 0 ? (
          <Button
            label="Dodaj kolejne ćwiczenie"
            icon={Plus}
            variant="secondary"
            onPress={() => setShowExercisePicker(true)}
            className="mb-4"
          />
        ) : null}
      </ScrollView>

      <ExercisePicker
        visible={showExercisePicker}
        onClose={() => setShowExercisePicker(false)}
        existingExerciseNames={existingExerciseNames}
        onSelectCatalog={handleAddFromCatalog}
        onSelectCustom={(name) => handleAddFromCatalog({ name })}
        loading={isAddingExercise}
      />
    </SafeAreaView>
  );
}
