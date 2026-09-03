import { Text, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { ICON_STROKE } from "./icons";
import { cx } from "./utils";

export type BadgeTone = "neutral" | "accent" | "danger" | "outline";
export type BadgeSize = "sm" | "md";

const TONE_SURFACE: Record<BadgeTone, string> = {
  neutral: "bg-surface-muted border-border",
  accent: "bg-emphasis/15 border-emphasis/40",
  danger: "bg-danger/10 border-danger/40",
  outline: "bg-transparent border-border",
};

const TONE_TEXT: Record<BadgeTone, string> = {
  neutral: "text-text-secondary",
  accent: "text-emphasis",
  danger: "text-danger",
  outline: "text-text-muted",
};

const TONE_ICON: Record<BadgeTone, string> = {
  neutral: "#c0c9d8",
  accent: "#22c55e",
  danger: "#ef4444",
  outline: "#7c8aa5",
};

const SIZE_CLASS: Record<BadgeSize, string> = {
  sm: "h-6 px-2 gap-1",
  md: "h-7 px-2.5 gap-1.5",
};

const TEXT_SIZE_CLASS: Record<BadgeSize, string> = {
  sm: "text-xs font-semibold",
  md: "text-sm font-semibold",
};

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  size?: BadgeSize;
  icon?: LucideIcon;
  className?: string;
};

export function Badge({
  label,
  tone = "neutral",
  size = "sm",
  icon: Icon,
  className,
}: BadgeProps) {
  return (
    <View
      className={cx(
        "flex-row items-center self-start rounded-full border",
        TONE_SURFACE[tone],
        SIZE_CLASS[size],
        className,
      )}
    >
      {Icon ? (
        <Icon
          size={size === "sm" ? 12 : 14}
          strokeWidth={ICON_STROKE}
          color={TONE_ICON[tone]}
        />
      ) : null}
      <Text className={cx(TEXT_SIZE_CLASS[size], TONE_TEXT[tone])}>{label}</Text>
    </View>
  );
}
