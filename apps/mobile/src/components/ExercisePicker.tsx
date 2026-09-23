import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  LIBRARY_BODY_PART_LABELS,
  LIBRARY_BODY_PARTS,
  equipmentOf,
  isLibraryTimeBased,
  searchLibraryExercises,
  type LibraryBodyPart,
  type LibraryExercise,
} from "@bhmt3wp/shared";
import { Search, X } from "lucide-react-native";
import { Button, ICON_SIZE, ICON_STROKE, Input, cx } from "./ui";
import { ExerciseMedia, GymVisualAttribution } from "./ExerciseMedia";
import { ExerciseDetailModal } from "./ExerciseDetailModal";

type ExercisePickerProps = {
  visible: boolean;
  onClose: () => void;
  existingExerciseNames: string[];
  onSelectCatalog: (exercise: { name: string; timeBased?: boolean }) => void;
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
  const [bodyPart, setBodyPart] = useState<LibraryBodyPart | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [customName, setCustomName] = useState("");
  const [detail, setDetail] = useState<LibraryExercise | null>(null);

  useEffect(() => {
    if (visible) {
      setBodyPart(null);
      setEquipment(null);
      setQuery("");
      setCustomName("");
      setDetail(null);
    }
  }, [visible]);

  const existing = useMemo(
    () => new Set(existingExerciseNames.map((n) => n.trim().toLocaleLowerCase("pl-PL"))),
    [existingExerciseNames],
  );

  const filteredBase = useMemo(
    () =>
      searchLibraryExercises({
        query,
        bodyPart: query.trim() ? null : bodyPart,
      }).filter((item) => !existing.has(item.name.trim().toLocaleLowerCase("pl-PL"))),
    [query, bodyPart, existing],
  );

  const eqOpts = useMemo(() => equipmentOf(filteredBase), [filteredBase]);
  const equipmentOn = eqOpts.includes(equipment ?? "") ? equipment : null;

  const results = useMemo(() => {
    if (!equipmentOn) return filteredBase;
    return filteredBase.filter((e) => e.equipment === equipmentOn);
  }, [filteredBase, equipmentOn]);

  const handleSelect = (exercise: LibraryExercise) => {
    onSelectCatalog({
      name: exercise.name,
      timeBased: isLibraryTimeBased(exercise),
    });
    setQuery("");
    setCustomName("");
    setDetail(null);
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
    setDetail(null);
    onClose();
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={resetAndClose}>
        <View className="flex-1 justify-end bg-black/60">
          <View className="max-h-[90%] rounded-t-3xl border border-border bg-background px-5 pt-4 pb-8">
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-text-primary text-xl font-bold">Wybierz ćwiczenie</Text>
                <Text className="text-text-muted text-sm mt-1">
                  Baza — {results.length} wyników
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
              onChangeText={(t) => {
                setQuery(t);
                setEquipment(null);
              }}
              placeholder="Szukaj ćwiczenia…"
              leftIcon={Search}
              containerClassName="mb-3"
            />

            {!query.trim() ? (
              <View className="mb-2 flex-row flex-wrap gap-2">
                <TouchableOpacity
                  onPress={() => {
                    setBodyPart(null);
                    setEquipment(null);
                  }}
                  className={cx(
                    "rounded-full border px-3 py-1.5",
                    !bodyPart
                      ? "border-action-primary bg-action-primary/20"
                      : "border-border bg-surface-muted",
                  )}
                >
                  <Text
                    className={cx(
                      "text-xs font-bold uppercase",
                      !bodyPart ? "text-text-primary" : "text-text-muted",
                    )}
                  >
                    Wszystkie
                  </Text>
                </TouchableOpacity>
                {LIBRARY_BODY_PARTS.map((bp) => (
                  <TouchableOpacity
                    key={bp}
                    onPress={() => {
                      setBodyPart(bp);
                      setEquipment(null);
                    }}
                    className={cx(
                      "rounded-full border px-3 py-1.5",
                      bodyPart === bp
                        ? "border-action-primary bg-action-primary/20"
                        : "border-border bg-surface-muted",
                    )}
                  >
                    <Text
                      className={cx(
                        "text-xs font-bold uppercase",
                        bodyPart === bp ? "text-text-primary" : "text-text-muted",
                      )}
                    >
                      {LIBRARY_BODY_PART_LABELS[bp]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {eqOpts.length > 1 ? (
              <View className="mb-3 flex-row flex-wrap gap-2">
                <TouchableOpacity
                  onPress={() => setEquipment(null)}
                  className={cx(
                    "rounded-full border px-3 py-1.5",
                    !equipmentOn
                      ? "border-action-primary bg-action-primary/20"
                      : "border-border bg-surface-muted",
                  )}
                >
                  <Text className="text-xs font-semibold text-text-muted">Sprzęt: dowolny</Text>
                </TouchableOpacity>
                {eqOpts.slice(0, 8).map((eq) => (
                  <TouchableOpacity
                    key={eq}
                    onPress={() => setEquipment(eq)}
                    className={cx(
                      "rounded-full border px-3 py-1.5",
                      equipmentOn === eq
                        ? "border-action-primary bg-action-primary/20"
                        : "border-border bg-surface-muted",
                    )}
                  >
                    <Text className="text-xs font-semibold text-text-muted capitalize">{eq}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 340 }}
              initialNumToRender={16}
              windowSize={7}
              ListEmptyComponent={
                <Text className="py-8 text-center text-text-muted text-sm">
                  Brak wyników — sprawdź inną frazę lub dodaj własną nazwę poniżej.
                </Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleSelect(item)}
                  onLongPress={() => setDetail(item)}
                  disabled={loading}
                  className="mb-2 flex-row items-center gap-3 rounded-xl border border-border bg-surface px-2 py-2"
                >
                  <ExerciseMedia exercise={item} size={48} />
                  <View className="flex-1 pr-1">
                    <Text className="text-text-primary text-base font-semibold capitalize">
                      {item.name}
                    </Text>
                    <Text className="text-text-muted text-xs mt-0.5 capitalize">
                      {LIBRARY_BODY_PART_LABELS[item.bodyPart]} · {item.equipment}
                      {isLibraryTimeBased(item) ? " · na czas" : ""}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />

            <GymVisualAttribution compact />

            <View className="mt-3 border-t border-border pt-4">
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

      <ExerciseDetailModal
        exercise={detail}
        visible={detail != null}
        onClose={() => setDetail(null)}
        actionLabel="Dodaj do treningu"
        onAction={() => detail && handleSelect(detail)}
        actionLoading={loading}
      />
    </>
  );
}
