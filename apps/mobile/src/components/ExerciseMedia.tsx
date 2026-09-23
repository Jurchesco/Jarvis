import { Image } from "expo-image";
import { Text, View } from "react-native";
import {
  GYM_VISUAL_ATTRIBUTION,
  libraryGifUrl,
  libraryThumbUrl,
  type LibraryExercise,
} from "@bhmt3wp/shared";

type Props = {
  exercise: LibraryExercise;
  /** Prefer animated GIF (detail); default thumb JPG. */
  animated?: boolean;
  size?: number;
  className?: string;
};

export function ExerciseMedia({
  exercise,
  animated = false,
  size = 56,
  className,
}: Props) {
  const uri = animated ? libraryGifUrl(exercise) : libraryThumbUrl(exercise);
  return (
    <View className={className}>
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          backgroundColor: "#152033",
        }}
        contentFit="cover"
        recyclingKey={exercise.id + (animated ? "-gif" : "-img")}
        transition={200}
        accessibilityLabel={`Animacja: ${exercise.name}`}
      />
    </View>
  );
}

export function GymVisualAttribution({ compact = false }: { compact?: boolean }) {
  return (
    <Text
      className={
        compact
          ? "text-text-muted text-[10px] text-center"
          : "text-text-muted text-xs text-center mt-2"
      }
    >
      {GYM_VISUAL_ATTRIBUTION}
    </Text>
  );
}
