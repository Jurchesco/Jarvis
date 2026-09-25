import { useMemo, useState } from "react";
import {
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  LIBRARY_BODY_PART_LABELS,
  LIBRARY_BODY_PARTS,
  equipmentOf,
  libraryDisplayName,
  libraryExerciseCount,
  searchLibraryExercises,
  type LibraryBodyPart,
  type LibraryExercise,
} from "@bhmt3wp/shared";
import { Search } from "lucide-react-native";
import { ExerciseDetailModal } from "../../src/components/ExerciseDetailModal";
import { ExerciseMedia, GymVisualAttribution } from "../../src/components/ExerciseMedia";
import { Input, cx } from "../../src/components/ui";

const PAGE = 40;

export default function ExerciseLibraryScreen() {
  const [query, setQuery] = useState("");
  const [bodyPart, setBodyPart] = useState<LibraryBodyPart | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [detail, setDetail] = useState<LibraryExercise | null>(null);

  const filteredBase = useMemo(
    () =>
      searchLibraryExercises({
        query,
        bodyPart: query.trim() ? null : bodyPart,
      }),
    [query, bodyPart],
  );

  const eqOpts = useMemo(() => equipmentOf(filteredBase), [filteredBase]);
  const equipmentOn = eqOpts.includes(equipment ?? "") ? equipment : null;

  const filtered = useMemo(() => {
    if (!equipmentOn) return filteredBase;
    return filteredBase.filter((e) => e.equipment === equipmentOn);
  }, [filteredBase, equipmentOn]);

  const visible = filtered.slice(0, shown);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <View className="px-4 pt-2 pb-3 border-b border-border">
        <Text className="text-text-muted text-sm mb-3">
          {libraryExerciseCount()} ćwiczeń z animacjami · dane MIT · media CDN
        </Text>
        <Input
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setEquipment(null);
            setShown(PAGE);
          }}
          placeholder="Szukaj…"
          leftIcon={Search}
        />

        <View className="mt-3 flex-row flex-wrap gap-2">
          <TouchableOpacity
            onPress={() => {
              setBodyPart(null);
              setEquipment(null);
              setShown(PAGE);
            }}
            className={cx(
              "rounded-full border px-3 py-1.5",
              !bodyPart
                ? "border-action-primary bg-action-primary/20"
                : "border-border bg-surface-muted",
            )}
          >
            <Text className="text-xs font-bold text-text-primary">Wszystkie</Text>
          </TouchableOpacity>
          {LIBRARY_BODY_PARTS.map((bp) => (
            <TouchableOpacity
              key={bp}
              onPress={() => {
                setBodyPart(bp);
                setEquipment(null);
                setShown(PAGE);
              }}
              className={cx(
                "rounded-full border px-3 py-1.5",
                bodyPart === bp
                  ? "border-action-primary bg-action-primary/20"
                  : "border-border bg-surface-muted",
              )}
            >
              <Text className="text-xs font-bold text-text-primary">
                {LIBRARY_BODY_PART_LABELS[bp]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {eqOpts.length > 1 ? (
          <View className="mt-2 flex-row flex-wrap gap-2">
            <TouchableOpacity
              onPress={() => {
                setEquipment(null);
                setShown(PAGE);
              }}
              className={cx(
                "rounded-full border px-3 py-1.5",
                !equipmentOn
                  ? "border-action-primary bg-action-primary/20"
                  : "border-border bg-surface-muted",
              )}
            >
              <Text className="text-xs font-semibold text-text-muted">Sprzęt: dowolny</Text>
            </TouchableOpacity>
            {eqOpts.slice(0, 10).map((eq) => (
              <TouchableOpacity
                key={eq}
                onPress={() => {
                  setEquipment(eq);
                  setShown(PAGE);
                }}
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
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        initialNumToRender={12}
        windowSize={7}
        ListFooterComponent={
          <View className="mt-2">
            {filtered.length > shown ? (
              <TouchableOpacity
                onPress={() => setShown((s) => s + PAGE)}
                className="mb-3 items-center rounded-xl border border-border bg-surface py-3"
              >
                <Text className="text-text-primary font-semibold">
                  Pokaż więcej ({filtered.length - shown} pozostało)
                </Text>
              </TouchableOpacity>
            ) : null}
            <GymVisualAttribution />
          </View>
        }
        ListEmptyComponent={
          <Text className="py-12 text-center text-text-muted text-sm leading-5 px-6">
            Brak ćwiczeń dla tych filtrów — wyczyść wyszukiwanie albo sprzęt.
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setDetail(item)}
            className="mb-2 flex-row items-center gap-3 rounded-xl border border-border bg-surface px-2 py-2"
          >
            <ExerciseMedia exercise={item} size={56} />
            <View className="flex-1">
              <Text className="text-text-primary text-base font-semibold">
                {libraryDisplayName(item)}
              </Text>
              <Text className="text-text-muted text-xs mt-0.5 capitalize">
                {LIBRARY_BODY_PART_LABELS[item.bodyPart]} · {item.target} · {item.equipment}
                {item.namePl !== item.name ? ` · ${item.name}` : ""}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <ExerciseDetailModal
        exercise={detail}
        visible={detail != null}
        onClose={() => setDetail(null)}
      />
    </SafeAreaView>
  );
}
