import { useMemo, useState } from "react";
import { Alert, Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Minus,
  PencilLine,
  Play,
  Plus,
  Trash2,
} from "lucide-react-native";
import type { CatalogExercise, ExerciseFull } from "@bhmt3wp/shared";
import {
  useCreateSession,
  useDeleteExercise,
  useIncompleteSession,
  useReorderExercises,
  useSheet,
  useUpdateSheet,
} from "../../src/api/hooks";
import { ExercisePicker } from "../../src/components/ExercisePicker";
import { addCatalogExerciseToSheet } from "../../src/lib/addCatalogExercise";
import { duplicateSheet } from "../../src/lib/duplicateSheet";
import { isFreestyleSheetName } from "../../src/lib/ensureFreestyleSheet";
import {
  syncExerciseTargets,
  targetsFromSets,
} from "../../src/lib/syncExerciseTargets";
import {
  Button,
  Card,
  ICON_STROKE,
  Input,
  StateBlock,
} from "../../src/components/ui";

const DEFAULT_PLAN_SET_COUNT = 3;
const DEFAULT_PLAN_REPS = 10;
const MIN_SETS = 0;
const MAX_SETS = 12;
const MIN_REPS = 1;
const MAX_REPS = 100;

function formatTargetLabel(exercise: ExerciseFull): string {
  const { setCount, reps } = targetsFromSets(exercise.sets);
  if (setCount === 0) return "Bez celu serii";
  return `${setCount}×${reps}`;
}

export default function PlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sheetId = id!;
  const router = useRouter();
  const { data: sheet, isLoading, refetch } = useSheet(sheetId);
  const updateSheet = useUpdateSheet();
  const deleteExercise = useDeleteExercise(sheetId);
  const reorderExercises = useReorderExercises(sheetId);
  const createSession = useCreateSession();
  const { data: incompleteSession } = useIncompleteSession(sheetId);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [savingExerciseId, setSavingExerciseId] = useState<string | null>(null);

  const existingNames = useMemo(
    () => (sheet?.exercises ?? []).map((exercise) => exercise.name),
    [sheet?.exercises],
  );

  const beginRename = () => {
    setNameDraft(sheet?.name ?? "");
    setIsEditingName(true);
  };

  const applyRename = () => {
    if (!sheet) return;
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === sheet.name) {
      setIsEditingName(false);
      return;
    }
    if (isFreestyleSheetName(trimmed)) {
      const msg = "Nazwa „Freestyle” jest zarezerwowana.";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Nie można zmienić nazwy", msg);
      return;
    }
    updateSheet.mutate(
      { id: sheetId, name: trimmed },
      {
        onSuccess: () => setIsEditingName(false),
        onError: (err) => {
          const msg = err instanceof Error ? err.message : "Nie można zmienić nazwy";
          if (Platform.OS === "web") window.alert(msg);
          else Alert.alert("Błąd", msg);
        },
      },
    );
  };

  const handleAdd = async (exercise: CatalogExercise | { name: string; timeBased?: boolean }) => {
    if (!sheet) return;
    setIsAdding(true);
    try {
      await addCatalogExerciseToSheet(sheetId, exercise, sheet.exercises.length, {
        setCount: DEFAULT_PLAN_SET_COUNT,
      });
      setShowPicker(false);
      await refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Nie można dodać ćwiczenia";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Błąd", msg);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteExercise = (exerciseId: string, name: string) => {
    const title = "Usuń z planu";
    const message = `Usunąć „${name}” z tego układu?`;
    const run = () => deleteExercise.mutate(exerciseId);
    if (Platform.OS === "web") {
      if (window.confirm(`${title}\n\n${message}`)) run();
    } else {
      Alert.alert(title, message, [
        { text: "Anuluj", style: "cancel" },
        { text: "Usuń", style: "destructive", onPress: run },
      ]);
    }
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    if (!sheet) return;
    const next = index + direction;
    if (next < 0 || next >= sheet.exercises.length) return;
    const ids = sheet.exercises.map((exercise) => exercise.id);
    const tmp = ids[index];
    ids[index] = ids[next];
    ids[next] = tmp;
    reorderExercises.mutate(ids);
  };

  const handleAdjustSets = async (exercise: ExerciseFull, delta: number) => {
    const current = targetsFromSets(exercise.sets);
    const setCount = Math.min(MAX_SETS, Math.max(MIN_SETS, current.setCount + delta));
    if (setCount === current.setCount) return;
    const reps = current.setCount === 0 ? DEFAULT_PLAN_REPS : current.reps;
    setSavingExerciseId(exercise.id);
    try {
      await syncExerciseTargets(exercise.id, { setCount, reps });
      await refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Nie można zmienić serii";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Błąd", msg);
    } finally {
      setSavingExerciseId(null);
    }
  };

  const handleAdjustReps = async (exercise: ExerciseFull, delta: number) => {
    const current = targetsFromSets(exercise.sets);
    const setCount = current.setCount === 0 ? DEFAULT_PLAN_SET_COUNT : current.setCount;
    const baseReps = current.setCount === 0 ? DEFAULT_PLAN_REPS : current.reps;
    const reps = Math.min(MAX_REPS, Math.max(MIN_REPS, baseReps + delta));
    if (current.setCount > 0 && reps === current.reps) return;
    setSavingExerciseId(exercise.id);
    try {
      await syncExerciseTargets(exercise.id, { setCount, reps });
      await refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Nie można zmienić powtórzeń";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Błąd", msg);
    } finally {
      setSavingExerciseId(null);
    }
  };

  const handleDuplicate = async () => {
    if (!sheet) return;
    setIsDuplicating(true);
    try {
      const copy = await duplicateSheet(sheetId);
      router.replace(`/sheet/${copy.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Nie można skopiować planu";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Błąd", msg);
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleStart = () => {
    if (!sheet) return;
    if (sheet.exercises.length === 0) {
      const msg = "Dodaj przynajmniej jedno ćwiczenie z katalogu, zanim zaczniesz.";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Pusty plan", msg);
      return;
    }

    if (incompleteSession) {
      router.push(`/workout/${incompleteSession.id}?sheetId=${sheetId}`);
      return;
    }

    setIsStarting(true);
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
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-background px-5 pt-8">
        <StateBlock title="Wczytywanie planu" description="Przygotowywanie listy ćwiczeń." />
      </View>
    );
  }

  if (!sheet || isFreestyleSheetName(sheet.name)) {
    return (
      <View className="flex-1 bg-background px-5 pt-8">
        <StateBlock
          title="Nie znaleziono planu"
          description="Ten układ mógł zostać usunięty albo to arkusz freestyle."
          tone="danger"
          actionLabel="Wróć do planów"
          onAction={() => router.replace("/plans")}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
      >
        {isEditingName ? (
          <View className="flex-row items-center mb-3">
            <Input
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="Nazwa planu"
              onSubmitEditing={applyRename}
              containerClassName="flex-1"
              autoFocus
              returnKeyType="done"
            />
            <Button label="Zapisz" size="sm" onPress={applyRename} className="ml-2" />
          </View>
        ) : (
          <View className="flex-row items-start justify-between mb-2">
            <View className="flex-1 pr-3">
              <Text className="text-text-primary text-2xl font-bold leading-tight">{sheet.name}</Text>
              <Text className="text-text-muted text-sm mt-1">
                {sheet.exercises.length === 0
                  ? "Pusty — dodaj ćwiczenia z katalogu"
                  : `${sheet.exercises.length} ${sheet.exercises.length === 1 ? "ćwiczenie" : "ćwiczenia"} · cele serii/powt.`}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                onPress={handleDuplicate}
                disabled={isDuplicating}
                className="h-10 w-10 items-center justify-center rounded-xl bg-action-secondary border border-border"
                accessibilityLabel="Duplikuj plan"
              >
                <Copy size={16} strokeWidth={ICON_STROKE} color="#c0c9d8" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={beginRename}
                className="h-10 w-10 items-center justify-center rounded-xl bg-action-secondary border border-border"
                accessibilityLabel="Zmień nazwę planu"
              >
                <PencilLine size={16} strokeWidth={ICON_STROKE} color="#c0c9d8" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {sheet.exercises.length === 0 ? (
          <StateBlock
            className="mt-6"
            title="Dodaj ćwiczenia"
            description="Wybierasz z tej samej bazy co we freestyle. Ustaw serie i powtórzenia — kolejność na liście to kolejność na treningu."
            actionLabel="Dodaj z katalogu"
            onAction={() => setShowPicker(true)}
          />
        ) : (
          sheet.exercises.map((exercise, index) => {
            const { setCount, reps } = targetsFromSets(exercise.sets);
            const busy = savingExerciseId === exercise.id || reorderExercises.isPending;
            return (
              <Card key={exercise.id} padding="md" className="mb-3">
                <View className="flex-row items-start">
                  <View className="mr-2 items-center pt-0.5">
                    <TouchableOpacity
                      onPress={() => handleMove(index, -1)}
                      disabled={index === 0 || busy}
                      className="h-8 w-8 items-center justify-center rounded-lg bg-action-secondary border border-border mb-1"
                      accessibilityLabel={`Przenieś ${exercise.name} w górę`}
                      style={{ opacity: index === 0 ? 0.35 : 1 }}
                    >
                      <ChevronUp size={16} strokeWidth={ICON_STROKE} color="#c0c9d8" />
                    </TouchableOpacity>
                    <Text className="text-text-muted text-xs font-semibold mb-1">{index + 1}</Text>
                    <TouchableOpacity
                      onPress={() => handleMove(index, 1)}
                      disabled={index === sheet.exercises.length - 1 || busy}
                      className="h-8 w-8 items-center justify-center rounded-lg bg-action-secondary border border-border"
                      accessibilityLabel={`Przenieś ${exercise.name} w dół`}
                      style={{ opacity: index === sheet.exercises.length - 1 ? 0.35 : 1 }}
                    >
                      <ChevronDown size={16} strokeWidth={ICON_STROKE} color="#c0c9d8" />
                    </TouchableOpacity>
                  </View>

                  <View className="flex-1 min-w-0">
                    <View className="flex-row items-start justify-between">
                      <Text className="flex-1 text-text-primary text-base font-semibold pr-2">
                        {exercise.name}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleDeleteExercise(exercise.id, exercise.name)}
                        className="h-9 w-9 items-center justify-center rounded-xl bg-action-secondary border border-border"
                        accessibilityLabel={`Usuń ${exercise.name}`}
                      >
                        <Trash2 size={16} strokeWidth={ICON_STROKE} color="#ef4444" />
                      </TouchableOpacity>
                    </View>

                    <Text className="text-text-muted text-xs mt-1 mb-3">
                      Cel: {formatTargetLabel(exercise)}
                    </Text>

                    <View className="flex-row flex-wrap gap-3">
                      <View className="flex-row items-center rounded-xl border border-border bg-action-secondary overflow-hidden">
                        <TouchableOpacity
                          onPress={() => handleAdjustSets(exercise, -1)}
                          disabled={busy || setCount <= MIN_SETS}
                          className="h-9 w-9 items-center justify-center"
                          accessibilityLabel="Mniej serii"
                        >
                          <Minus size={14} strokeWidth={ICON_STROKE} color="#c0c9d8" />
                        </TouchableOpacity>
                        <Text className="min-w-[52px] text-center text-text-primary text-sm font-semibold">
                          {setCount} ser.
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleAdjustSets(exercise, 1)}
                          disabled={busy || setCount >= MAX_SETS}
                          className="h-9 w-9 items-center justify-center"
                          accessibilityLabel="Więcej serii"
                        >
                          <Plus size={14} strokeWidth={ICON_STROKE} color="#c0c9d8" />
                        </TouchableOpacity>
                      </View>

                      <View className="flex-row items-center rounded-xl border border-border bg-action-secondary overflow-hidden">
                        <TouchableOpacity
                          onPress={() => handleAdjustReps(exercise, -1)}
                          disabled={busy || (setCount > 0 && reps <= MIN_REPS)}
                          className="h-9 w-9 items-center justify-center"
                          accessibilityLabel="Mniej powtórzeń"
                        >
                          <Minus size={14} strokeWidth={ICON_STROKE} color="#c0c9d8" />
                        </TouchableOpacity>
                        <Text className="min-w-[52px] text-center text-text-primary text-sm font-semibold">
                          {setCount === 0 ? "—" : `${reps} pow.`}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleAdjustReps(exercise, 1)}
                          disabled={busy || (setCount > 0 && reps >= MAX_REPS)}
                          className="h-9 w-9 items-center justify-center"
                          accessibilityLabel="Więcej powtórzeń"
                        >
                          <Plus size={14} strokeWidth={ICON_STROKE} color="#c0c9d8" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              </Card>
            );
          })
        )}

        {sheet.exercises.length > 0 ? (
          <Button
            label="Dodaj ćwiczenie"
            icon={Plus}
            variant="secondary"
            onPress={() => setShowPicker(true)}
            className="mt-1"
          />
        ) : null}
      </ScrollView>

      <View className="absolute bottom-6 left-5 right-5">
        <Button
          label={incompleteSession ? "Kontynuuj ten plan" : "Rozpocznij plan"}
          icon={Play}
          onPress={handleStart}
          loading={isStarting || createSession.isPending}
        />
      </View>

      <ExercisePicker
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        existingExerciseNames={existingNames}
        onSelectCatalog={handleAdd}
        onSelectCustom={(name) => handleAdd({ name })}
        loading={isAdding}
      />
    </View>
  );
}
