import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Dimensions,
  Keyboard,
  Platform,
  Pressable,
  Text,
  View,
  type KeyboardEvent,
} from "react-native";
import Animated, { FadeInUp, FadeOutDown } from "react-native-reanimated";
import { Check, CircleAlert, Info } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ICON_SIZE, ICON_STROKE } from "./icons";
import { cx } from "./utils";

const TOAST_BOTTOM_GAP = 24;

/** Lift overlay above the keyboard without double-counting Android adjustResize. */
function useToastKeyboardLift() {
  const [lift, setLift] = useState(0);

  useEffect(() => {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return;
      const vv = window.visualViewport;
      if (!vv) return;
      const update = () => {
        setLift(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
      };
      update();
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
      return () => {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      };
    }

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (event: KeyboardEvent) => {
      const windowHeight = Dimensions.get("window").height;
      setLift(Math.max(0, windowHeight - event.endCoordinates.screenY));
    };
    const onHide = () => setLift(0);
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return lift;
}

export type ToastTone = "success" | "error" | "info";

export type ShowToastOptions = {
  tone: ToastTone;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
};

type ToastContextValue = {
  showToast: (options: ShowToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 2600;
const ERROR_DURATION_MS = 4000;

const TONE_ICON = {
  success: Check,
  error: CircleAlert,
  info: Info,
} as const;

const TONE_ICON_COLOR: Record<ToastTone, string> = {
  success: "#22c55e",
  error: "#ef4444",
  info: "#60a5fa",
};

type ToastCardProps = ShowToastOptions & {
  onDismiss: () => void;
};

export function Toast({
  tone,
  message,
  actionLabel,
  onAction,
  onDismiss,
}: ToastCardProps) {
  const Icon = TONE_ICON[tone];

  return (
    <View
      className={cx(
        "flex-row items-center gap-3 rounded-2xl border px-4 py-3 bg-surface border-border shadow-lg",
        tone === "error" && "border-danger/40 bg-danger/10",
      )}
      accessibilityLiveRegion="polite"
      accessibilityRole="text"
    >
      <Icon size={ICON_SIZE} strokeWidth={ICON_STROKE} color={TONE_ICON_COLOR[tone]} />
      <Text className="text-sm font-semibold text-text-primary flex-1">{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={() => {
            onAction();
            onDismiss();
          }}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={8}
        >
          <Text
            className={cx(
              "text-sm font-semibold",
              tone === "error" ? "text-danger" : "text-emphasis",
            )}
          >
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const keyboardLift = useToastKeyboardLift();
  const [toast, setToast] = useState<(ShowToastOptions & { id: number }) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const hideToast = useCallback(() => {
    clearTimer();
    setToast(null);
  }, [clearTimer]);

  const showToast = useCallback(
    (options: ShowToastOptions) => {
      clearTimer();
      idRef.current += 1;
      const next = { ...options, id: idRef.current };
      setToast(next);
      const duration =
        options.durationMs ?? (options.tone === "error" ? ERROR_DURATION_MS : DEFAULT_DURATION_MS);
      timerRef.current = setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, duration);
    },
    [clearTimer],
  );

  useEffect(() => () => clearTimer(), [clearTimer]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        {toast ? (
          <Animated.View
            key={toast.id}
            entering={FadeInUp.duration(220)}
            exiting={FadeOutDown.duration(180)}
            className="absolute left-4 right-4 z-50"
            style={{
              bottom: TOAST_BOTTOM_GAP + (keyboardLift > 0 ? keyboardLift : insets.bottom),
              elevation: 12,
              zIndex: 50,
              pointerEvents: "box-none",
            }}
          >
            <Toast
              tone={toast.tone}
              message={toast.message}
              actionLabel={toast.actionLabel}
              onAction={toast.onAction}
              onDismiss={hideToast}
            />
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
