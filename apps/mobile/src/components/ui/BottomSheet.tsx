import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { X } from "lucide-react-native";
import { ICON_SIZE, ICON_STROKE } from "./icons";
import { cx } from "./utils";

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  sheetClassName?: string;
};

export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  sheetClassName,
}: BottomSheetProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 justify-end"
      >
        <Pressable className="flex-1 bg-black/60" onPress={onClose} accessibilityLabel="Zamknij" />
        <View
          className={cx(
            "max-h-[88%] rounded-t-3xl border border-border bg-background px-5 pt-4 pb-8",
            sheetClassName,
          )}
        >
          <View className="mb-4 flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-text-primary text-xl font-bold leading-tight">{title}</Text>
              {subtitle ? (
                <Text className="text-text-muted text-sm mt-1 leading-5">{subtitle}</Text>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-xl bg-action-secondary border border-border"
              accessibilityLabel="Zamknij"
            >
              <X size={ICON_SIZE} strokeWidth={ICON_STROKE} color="#c0c9d8" />
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
