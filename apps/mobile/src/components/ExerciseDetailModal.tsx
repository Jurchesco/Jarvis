import { Modal, ScrollView, Text, View } from "react-native";
import {
  LIBRARY_BODY_PART_LABELS,
  type LibraryExercise,
} from "@bhmt3wp/shared";
import { X } from "lucide-react-native";
import { Button, ICON_SIZE, ICON_STROKE } from "./ui";
import { ExerciseMedia, GymVisualAttribution } from "./ExerciseMedia";
import { TouchableOpacity } from "react-native";

type Props = {
  exercise: LibraryExercise | null;
  visible: boolean;
  onClose: () => void;
  /** Optional primary action (e.g. add to plan / session). */
  actionLabel?: string;
  onAction?: () => void;
  actionLoading?: boolean;
};

export function ExerciseDetailModal({
  exercise,
  visible,
  onClose,
  actionLabel,
  onAction,
  actionLoading,
}: Props) {
  if (!exercise) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/70">
        <View className="max-h-[92%] rounded-t-3xl border border-border bg-background px-5 pt-4 pb-8">
          <View className="mb-3 flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-text-primary text-xl font-bold capitalize">
                {exercise.name}
              </Text>
              <Text className="text-text-muted text-sm mt-1 capitalize">
                {LIBRARY_BODY_PART_LABELS[exercise.bodyPart]} · {exercise.target} ·{" "}
                {exercise.equipment}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-xl bg-action-secondary border border-border"
              accessibilityLabel="Zamknij"
            >
              <X size={ICON_SIZE} strokeWidth={ICON_STROKE} color="#c0c9d8" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="items-center mb-4">
              <ExerciseMedia exercise={exercise} animated size={220} />
              <GymVisualAttribution />
            </View>

            {exercise.instructionsPl ? (
              <View className="mb-4 rounded-2xl border border-border bg-surface px-4 py-3">
                <Text className="text-text-secondary text-xs font-bold uppercase mb-2">
                  Instrukcja
                </Text>
                <Text className="text-text-primary text-sm leading-5">
                  {exercise.instructionsPl}
                </Text>
              </View>
            ) : null}

            {actionLabel && onAction ? (
              <Button
                label={actionLabel}
                onPress={onAction}
                loading={actionLoading}
                className="mt-1"
              />
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
