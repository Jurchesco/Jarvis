import { useState } from "react";
import { Modal, Pressable, Text, TouchableOpacity, View } from "react-native";
import { MoreVertical } from "lucide-react-native";
import { ICON_SIZE, ICON_STROKE, cx } from "./ui";

export type OverflowMenuAction = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

type OverflowMenuProps = {
  actions: OverflowMenuAction[];
  accessibilityLabel?: string;
  className?: string;
};

export function OverflowMenu({
  actions,
  accessibilityLabel = "Menu",
  className,
}: OverflowMenuProps) {
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  const runAction = (action: OverflowMenuAction) => {
    close();
    action.onPress();
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        className={cx(
          "h-9 w-9 items-center justify-center rounded-xl bg-action-secondary border border-border",
          className,
        )}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <MoreVertical size={ICON_SIZE} strokeWidth={ICON_STROKE} color="#c0c9d8" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable className="flex-1 bg-black/50" onPress={close}>
          <View className="flex-1 items-end justify-start px-5 pt-24">
            <Pressable onPress={(event) => event.stopPropagation()}>
              <View className="min-w-[200px] rounded-2xl border border-border bg-surface overflow-hidden">
                {actions.map((action, index) => (
                  <TouchableOpacity
                    key={action.label}
                    onPress={() => runAction(action)}
                    className={cx(
                      "px-4 py-3.5",
                      index > 0 ? "border-t border-border" : "",
                    )}
                  >
                    <Text
                      className={cx(
                        "text-base font-semibold",
                        action.destructive ? "text-danger" : "text-text-primary",
                      )}
                    >
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
