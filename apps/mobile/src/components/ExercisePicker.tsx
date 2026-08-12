import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  searchCatalogExercises,
  SPLIT_LABELS,
  WORKOUT_SPLITS,
  type CatalogExercise,
  type WorkoutSplit,
} from "@bhmt3wp/shared";
import { Search, X } from "lucide-react-native";
import { Button, ICON_SIZE, ICON_STROKE, Input, cx } from "./ui";

type ExercisePickerProps = {
  visible: boolean;
  onClose: () => void;
  existingExerciseNames: string[];
  onSelectCatalog: (exercise: CatalogExercise) => void;
  onSelectCustom: (name: string) => void;
  loading?: boolean;
};

export function ExercisePicker({
  visible,
  onClose,
  existingExerciseNames,
  onSelectCatalog,
  onSelectCustom,
  loading = false,
}: ExercisePickerProps) {
  const [activeSplit, setActiveSplit] = useState<WorkoutSplit>("push");
  const [query, setQuery] = useState("");
  const [customName, setCustomName] = useState("");

  useEffect(() => {
    if (visible) {
      setActiveSplit("push");
      setQuery("");
      setCustomName("");
    }
  }, [visible]);

  const existing = useMemo(
    () => new Set(existingExerciseNames.map((n) => n.trim().toLocaleLowerCase("pl-PL"))),
    [existingExerciseNames],
  );

  const results = useMemo(() => {
    const items = searchCatalogExercises(query, query.trim() ? null : activeSplit);
    return items.filter(
      (item) => !existing.has(item.name.trim().toLocaleLowerCase("pl-PL")),
    );
  }, [query, activeSplit, existing]);

  const handleSelect = (exercise: CatalogExercise) => {
    onSelectCatalog(exercise);
    setQuery("");
    setCustomName("");
  };

  const handleCustom = () => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    onSelectCustom(trimmed);
    setCustomName("");
    setQuery("");
  };

  const resetAndClose = () => {
    setQuery("");
    setCustomName("");
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={resetAndClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="max-h-[88%] rounded-t-3xl border border-border bg-background px-5 pt-4 pb-8">
          <View className="mb-4 flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-text-primary text-xl font-bold">Wybierz ćwiczenie</Text>
              <Text className="text-text-muted text-sm mt-1">
                Katalog ćwiczeń — {results.length} dostępnych
              </Text>
            </View>
            <TouchableOpacity
              onPress={resetAndClose}
              className="h-10 w-10 items-center justify-center rounded-xl bg-action-secondary border border-border"
              accessibilityLabel="Zamknij"
            >
              <X size={ICON_SIZE} strokeWidth={ICON_STROKE} color="#c0c9d8" />
            </TouchableOpacity>
          </View>

          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Szukaj ćwiczenia…"
            leftIcon={Search}
            containerClassName="mb-3"
          />

          {!query.trim() ? (
            <View className="mb-3 flex-row flex-wrap gap-2">
              {WORKOUT_SPLITS.map((split) => (
                <TouchableOpacity
                  key={split}
                  onPress={() => setActiveSplit(split)}
                  className={cx(
                    "rounded-full border px-3 py-1.5",
                    activeSplit === split
                      ? "border-action-primary bg-action-primary/20"
                      : "border-border bg-surface-muted",
                  )}
                >
                  <Text
                    className={cx(
                      "text-xs font-bold uppercase",
                      activeSplit === split ? "text-text-primary" : "text-text-muted",
                    )}
                  >
                    {SPLIT_LABELS[split]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          <FlatList
            data={results}
            keyExtractor={(item) => `${item.split}:${item.name}`}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 320 }}
            ListEmptyComponent={
              <Text className="py-8 text-center text-text-muted text-sm">
                Brak wyników — sprawdź inną frazę lub dodaj własną nazwę poniżej.
              </Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleSelect(item)}
                disabled={loading}
                className="mb-2 rounded-xl border border-border bg-surface px-3 py-3"
              >
                <Text className="text-text-primary text-base font-semibold">{item.name}</Text>
                <Text className="text-text-muted text-xs mt-1">
                  {SPLIT_LABELS[item.split]}
                  {item.timeBased ? " · na czas (sek.)" : ""}
                </Text>
              </TouchableOpacity>
            )}
          />

          <View className="mt-4 border-t border-border pt-4">
            <Text className="text-text-secondary text-sm font-semibold mb-2">
              Inne (własna nazwa)
            </Text>
            <Input
              value={customName}
              onChangeText={setCustomName}
              placeholder="Wpisz nazwę ćwiczenia"
              onSubmitEditing={handleCustom}
              returnKeyType="done"
            />
            <Button
              label="Dodaj własne ćwiczenie"
              onPress={handleCustom}
              variant="secondary"
              className="mt-3"
              disabled={!customName.trim() || loading}
              loading={loading}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
