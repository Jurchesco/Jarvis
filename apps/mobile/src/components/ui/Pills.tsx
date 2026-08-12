import { Text, TouchableOpacity, View } from "react-native";
import { cx } from "./utils";

export type PillOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

type PillsProps<T extends string> = {
  options: PillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

export function Pills<T extends string>({
  options,
  value,
  onChange,
  className,
}: PillsProps<T>) {
  return (
    <View className={cx("flex-row flex-wrap gap-2", className)}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => !option.disabled && onChange(option.value)}
            disabled={option.disabled}
            activeOpacity={0.75}
            className={cx(
              "rounded-xl border px-3 py-2 min-h-[36px] justify-center",
              selected
                ? "bg-action-primary border-action-primary"
                : "bg-surface-muted border-border",
              option.disabled ? "opacity-45" : "",
            )}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled: !!option.disabled }}
          >
            <Text
              className={cx(
                "text-sm font-semibold",
                selected ? "text-white" : "text-text-secondary",
              )}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
