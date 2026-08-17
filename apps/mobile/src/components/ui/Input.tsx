import { Platform, Text, TextInput, View, type TextInputProps } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { ICON_SIZE_SM, ICON_STROKE } from "./icons";
import { cx } from "./utils";

type InputProps = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: LucideIcon;
  containerClassName?: string;
  inputClassName?: string;
  /**
   * Font size in px, applied via inline `style` (default 16).
   * On web, react-native-web sets an inline `font: 14px System` on
   * TextInput that Tailwind/NativeWind text-size classes can't override —
   * anything below 16px triggers Android Chrome's auto-zoom-on-focus,
   * which makes fields feel unresponsive/misaligned on mobile web.
   * Always keep this >= 16 unless you know what you're doing.
   */
  fontSize?: number;
};

export function Input({
  label,
  hint,
  error,
  leftIcon: Icon,
  containerClassName,
  inputClassName,
  placeholderTextColor = "#7c8aa5",
  multiline,
  fontSize = 16,
  style,
  ...props
}: InputProps) {
  return (
    <View className={cx("w-full min-w-0", containerClassName)}>
      {label ? <Text className="text-text-secondary text-sm mb-1.5">{label}</Text> : null}

      <View
        className={cx(
          "flex-row items-center rounded-xl border border-border bg-surface-muted px-3 overflow-hidden min-w-0",
          multiline ? "py-2 items-start" : "h-12",
          error ? "border-danger" : "",
        )}
      >
        {Icon ? (
          <Icon
            size={ICON_SIZE_SM}
            strokeWidth={ICON_STROKE}
            color="#7c8aa5"
            style={{ marginRight: 8, marginTop: multiline ? 10 : 0 }}
          />
        ) : null}
        <TextInput
          {...props}
          multiline={multiline}
          placeholderTextColor={placeholderTextColor}
          className={cx(
            "flex-1 min-w-0 text-text-primary",
            multiline ? "min-h-[84px]" : "",
            inputClassName,
          )}
          style={[
            {
              fontSize,
              minWidth: 0,
              width: "100%",
              ...(Platform.OS === "web"
                ? {
                    outlineStyle: "none" as const,
                    outlineWidth: 0,
                    boxSizing: "border-box" as const,
                  }
                : null),
            },
            style,
          ]}
          textAlignVertical={multiline ? "top" : "center"}
          {...(Platform.OS === "web" ? ({ size: "1" } as object) : {})}
        />
      </View>

      {error ? <Text className="text-danger text-xs mt-1.5">{error}</Text> : null}
      {!error && hint ? <Text className="text-text-muted text-xs mt-1.5">{hint}</Text> : null}
    </View>
  );
}
