import { useCallback, useState } from "react";
import { Alert, Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CalendarDays,
  ChevronLeft,
  Clock3,
  Dumbbell,
  PencilLine,
  Plus,
  Trash2,
} from "lucide-react-native";
import type { CatalogExercise, ExerciseFull, SessionSetLog } from "@bhmt3wp/shared";
import { isTimeBasedExercise } from "@bhmt3wp/shared";
import {
  useDeleteSession,
  useSession,
  useSessionExerciseNotes,
  useSheet,
  useUpdateSession,
} from "../../../src/api/hooks";
import { EditSessionDateSheet, type SessionDateTimeSave } from "../../../src/components/EditSessionDateSheet";
import { ExercisePicker } from "../../../src/components/ExercisePicker";
import {
  createDraftFromLogs,
  ExerciseLogForm,
  ExerciseLogSummary,
  type ExerciseLogDraft,
} from "../../../src/components/ExerciseLogForm";
import { Button, Card, ICON_STROKE, StateBlock, cx } from "../../../src/components/ui";
import { addCatalogExerciseToSheet } from "../../../src/lib/addCatalogExercise";
import { discardSessionExercise } from "../../../src/lib/discardSessionExercise";
import { parseExerciseLogDraft, saveExerciseLogBatch } from "../../../src/lib/saveExerciseLogBatch";
import { formatSessionEndLong, formatSessionStartLong } from "../../../src/lib/sessionDate";

function confirmAction(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: "Anuluj", style: "cancel" },
      { text: "Potwierdź", onPress: onConfirm },
    ]);
  }
}

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = id!;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, isLoading, refetch: refetchSession } = useSession(sessionId);
  const { data: sheet, refetch: refetchSheet } = useSheet(session?.sheetId ?? "");
  const { data: exerciseNotes } = useSessionExerciseNotes(sessionId);
  const updateSession = useUpdateSession();
  const deleteSession = useDeleteSession();

  const [showEditStart, setShowEditStart] = useState(false);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [savingExerciseId, setSavingExerciseId] = useState<string | null>(null);
  const [isAddingExercise, setIsAddingExercise] = useState(false);

  const notesByExercise: Record<string, string> = {};
  for (const note of exerciseNotes ?? []) {
    notesByExercise[note.exerciseId] = note.notes;
  }

  const refreshData = useCallback(async () => {
    await Promise.all([
      refetchSession(),
      refetchSheet(),
      queryClient.invalidateQueries({ queryKey: ["sessions", sessionId] }),
      queryClient.invalidateQueries({ queryKey: ["sessions", "completed"] }),
      queryClient.invalidateQueries({ queryKey: ["sessions", sessionId, "exercise-notes"] }),
      session?.sheetId
        ? queryClient.invalidateQueries({ queryKey: ["sheets", session.sheetId] })
        : Promise.resolve(),
    ]);
  }, [queryClient, refetchSession, refetchSheet, session?.sheetId, sessionId]);

  const resolveExercise = (exerciseId: string, exerciseName: string): ExerciseFull | null => {
    if (!session) return null;
    const fromSheet = sheet?.exercises.find((item) => item.id === exerciseId);
    if (fromSheet) return fromSheet;
    return {
      id: exerciseId,
      sheetId: session.sheetId,
      name: exerciseName,
      notes: null,
      orderIndex: 0,
      createdAt: session.startedAt,
      sets: [],
    };
  };

  const handleSaveSessionTimes = ({ startedAt, completedAt }: SessionDateTimeSave) => {
    if (!session) return;
    updateSession.mutate(
      {
        id: sessionId,
        data: {
          startedAt,
          ...(completedAt !== undefined ? { completedAt } : {}),
        },
      },
      { onSuccess: () => setShowEditStart(false) },
    );
  };

  const handleSaveExercise = async (exercise: ExerciseFull, draft: ExerciseLogDraft) => {
    setSavingExerciseId(exercise.id);
    try {
      const parsed = parseExerciseLogDraft(exercise.name, draft);
      await saveExerciseLogBatch(sessionId, exercise, parsed);
      setEditingExerciseId(null);
      await refreshData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Nie można zapisać ćwiczenia";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Błąd", msg);
    } finally {
      setSavingExerciseId(null);
    }
  };

  const handleDeleteExercise = (exercise: ExerciseFull) => {
    confirmAction(
      "Usuń ćwiczenie",
      `Usunąć "${exercise.name}" z tego treningu razem ze wszystkimi seriami?`,
      async () => {
        try {
          await discardSessionExercise(sessionId, exercise.id);
          setEditingExerciseId((prev) => (prev === exercise.id ? null : prev));
          await refreshData();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Nie można usunąć ćwiczenia";
          if (Platform.OS === "web") window.alert(msg);
          else Alert.alert("Błąd", msg);
        }
      },
    );
  };

  const handleAddFromCatalog = async (exercise: CatalogExercise | { name: string }) => {
    if (!session || !sheet) return;
    setIsAddingExercise(true);
    try {
      const { exerciseId } = await addCatalogExerciseToSheet(session.sheetId, exercise, sheet.exercises.length, {
        setCount: 0,
      });
      setShowExercisePicker(false);
      setEditingExerciseId(exerciseId);
      await refreshData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Nie można dodać ćwiczenia";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Błąd", msg);
    } finally {
      setIsAddingExercise(false);
    }
  };

  const confirmDeleteSession = () => {
    confirmAction("Usuń trening", "Usunąć ten trening z historii? Tej operacji nie można odwrócić.", () => {
      deleteSession.mutate(sessionId, {
        onSuccess: () => router.replace("/history"),
      });
    });
  };

  const goBackToHistory = () => {
    router.replace("/history");
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background px-5 pt-8" edges={["bottom"]}>
        <StateBlock title="Wczytywanie sesji" description="Pobieranie szczegółów treningu." />
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView className="flex-1 bg-background px-5 pt-8" edges={["bottom"]}>
        <StateBlock
          title="Nie znaleziono sesji"
          description="Ten trening mógł zostać usunięty."
          tone="danger"
        />
      </SafeAreaView>
    );
  }

  const existingExerciseNames = (session.exercises ?? []).map((item) => item.exerciseName);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 36 }}
        keyboardShouldPersistTaps="handled"
      >
        <Card className="mb-4" padding="lg">
          <View className="flex-row items-start justify-between">
            <Text className="text-text-primary text-2xl font-bold flex-1 pr-3">{session.sheetName}</Text>
            <View className="items-end">
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => setShowEditStart(true)}
                  className="h-9 w-9 items-center justify-center rounded-xl bg-action-secondary border border-border"
                  accessibilityLabel="Edytuj datę treningu"
                >
                  <PencilLine size={16} strokeWidth={ICON_STROKE} color="#c0c9d8" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={confirmDeleteSession}
                  className="h-9 w-9 items-center justify-center rounded-xl bg-action-secondary border border-border"
                  accessibilityLabel="Usuń trening"
                >
                  <Trash2 size={16} strokeWidth={ICON_STROKE} color="#ef4444" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={goBackToHistory}
                className="mt-2 flex-row items-center rounded-xl bg-action-secondary border border-border px-2.5 py-1.5"
                accessibilityLabel="Wróć do historii"
              >
                <ChevronLeft size={14} strokeWidth={ICON_STROKE} color="#c0c9d8" />
                <Text className="text-text-secondary text-xs font-semibold">Wróć</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="mt-3">
            <View className="flex-row items-center">
              <CalendarDays size={16} strokeWidth={ICON_STROKE} color="#7c8aa5" />
              <Text className="ml-2 text-text-secondary text-sm flex-1">
                Start: {formatSessionStartLong(session.startedAt)}
              </Text>
            </View>

            {session.completedAt ? (
              <View className="mt-1 flex-row items-center">
                <Clock3 size={16} strokeWidth={ICON_STROKE} color="#7c8aa5" />
                <Text className="ml-2 text-text-muted text-sm">
                  Koniec: {formatSessionEndLong(session.completedAt)}
                </Text>
              </View>
            ) : null}
          </View>
        </Card>

        {session.exercises && session.exercises.length > 0 ? (
          session.exercises.map((group) => {
            const exercise = resolveExercise(group.exerciseId, group.exerciseName);
            if (!exercise) return null;
            const logs: SessionSetLog[] = [...group.sets].sort((a, b) => a.setNumber - b.setNumber);
            const isEditing = editingExerciseId === exercise.id;
            const initialDraft = createDraftFromLogs(logs, notesByExercise[exercise.id] ?? "");

            return (
              <Card key={exercise.id} className="mb-3" padding="md">
                <View className="flex-row items-center mb-3">
                  <View className="w-20 flex-row items-center">
                    <Dumbbell size={16} strokeWidth={ICON_STROKE} color="#60a5fa" />
                  </View>
                  <Text
                    className="flex-1 text-center text-text-primary text-lg font-bold leading-tight px-1"
                    numberOfLines={2}
                  >
                    {exercise.name}
                  </Text>
                  {!isEditing ? (
                    <View className="w-20 flex-row items-center justify-end gap-2">
                      <TouchableOpacity
                        onPress={() => setEditingExerciseId(exercise.id)}
                        className="h-9 w-9 items-center justify-center rounded-xl bg-action-secondary border border-border"
                        accessibilityLabel={`Edytuj ${exercise.name}`}
                      >
                        <PencilLine size={16} strokeWidth={ICON_STROKE} color="#c0c9d8" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteExercise(exercise)}
                        className="h-9 w-9 items-center justify-center rounded-xl bg-action-secondary border border-border"
                        accessibilityLabel={`Usuń ${exercise.name}`}
                      >
                        <Trash2 size={16} strokeWidth={ICON_STROKE} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View className="w-20 flex-row items-center justify-end">
                      <TouchableOpacity
                        onPress={() => handleDeleteExercise(exercise)}
                        className="h-9 w-9 items-center justify-center rounded-xl bg-action-secondary border border-border"
                        accessibilityLabel={`Usuń ${exercise.name}`}
                      >
                        <Trash2 size={16} strokeWidth={ICON_STROKE} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {isEditing ? (
                  <ExerciseLogForm
                    key={`${exercise.id}-edit`}
                    exerciseName={exercise.name}
                    timeBased={isTimeBasedExercise(exercise.name)}
                    initialDraft={initialDraft}
                    onSave={(draft) => handleSaveExercise(exercise, draft)}
                    onCancel={() => setEditingExerciseId(null)}
                    loading={savingExerciseId === exercise.id}
                    saveLabel="Zapisz zmiany"
                  />
                ) : (
                  <>
                    <View className="items-center">
                      <View className="w-64 max-w-full">
                        <View className="mb-2 flex-row px-1">
                          <Text className="w-16 text-center text-text-muted text-sm font-bold uppercase tracking-wide">
                            Seria
                          </Text>
                          <Text className="w-24 text-center text-text-muted text-sm font-bold uppercase tracking-wide">
                            Kg
                          </Text>
                          <Text className="w-24 text-center text-text-muted text-sm font-bold uppercase tracking-wide">
                            Powt.
                          </Text>
                        </View>
                        {logs.map((set, index) => (
                          <View
                            key={`${set.exerciseId}-${set.setNumber}`}
                            className={cx(
                              "mb-1 flex-row items-center rounded-lg px-1 py-2.5",
                              index % 2 === 0 ? "bg-surface-muted" : "bg-surface",
                            )}
                          >
                            <Text className="w-16 text-center text-text-secondary text-base font-semibold">
                              {set.setNumber}
                            </Text>
                            <Text className="w-24 text-center text-text-primary text-base font-semibold">
                              {set.weightKg}
                            </Text>
                            <Text className="w-24 text-center text-text-primary text-base font-semibold">
                              {set.reps}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    <ExerciseLogSummary
                      exerciseName={exercise.name}
                      setCount={logs.length}
                      weightKg={logs[0]?.weightKg ?? 0}
                      reps={logs[0]?.reps ?? 0}
                      notes={notesByExercise[exercise.id]}
                      timeBased={isTimeBasedExercise(exercise.name)}
                      layout="afterSets"
                    />
                  </>
                )}
              </Card>
            );
          })
        ) : (
          <StateBlock
            title="Brak zarejestrowanych ćwiczeń"
            description="Dodaj ćwiczenie, żeby uzupełnić ten trening."
          />
        )}

        <Button
          label="Dodaj ćwiczenie"
          icon={Plus}
          variant="secondary"
          onPress={() => setShowExercisePicker(true)}
          className="mt-2"
        />
      </ScrollView>

      <EditSessionDateSheet
        visible={showEditStart}
        onClose={() => setShowEditStart(false)}
        initialStartedIso={session.startedAt}
        initialCompletedIso={session.completedAt}
        saving={updateSession.isPending}
        title="Edytuj datę treningu"
        subtitle="Ustaw dzień i godzinę startu oraz zakończenia treningu."
        onSave={handleSaveSessionTimes}
      />

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
