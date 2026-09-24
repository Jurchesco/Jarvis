import { useCallback, useEffect, useRef, useState } from "react";
import { formatRestClock } from "./useRestTimer";

export type WorkTimerState = {
  totalSec: number;
  leftSec: number;
  label: string;
};

type WorkTimerOptions = {
  /** Called when the hold finishes (natural zero or early stop). */
  onComplete?: (heldSec: number) => void;
};

function clampWork(sec: number): number {
  return Math.max(0, Math.min(sec, 60 * 60));
}

/**
 * Countdown for a timed set hold (plank etc.).
 * Separate from rest timer — OpenGym-inspired behavior, Jarvis-owned code.
 * Early stop logs elapsed time (target − remaining), not the target.
 */
export function useWorkTimer(options: WorkTimerOptions = {}) {
  const [timer, setTimer] = useState<WorkTimerState | null>(null);
  const onCompleteRef = useRef(options.onComplete);
  onCompleteRef.current = options.onComplete;
  const active = timer !== null;

  const dismiss = useCallback(() => {
    setTimer(null);
  }, []);

  const start = useCallback((seconds: number, label = "") => {
    const totalSec = clampWork(Math.round(seconds));
    if (totalSec <= 0) {
      setTimer(null);
      return;
    }
    setTimer({ totalSec, leftSec: totalSec, label });
  }, []);

  const finishEarly = useCallback(() => {
    setTimer((prev) => {
      if (!prev) return null;
      const held = Math.max(1, prev.totalSec - prev.leftSec);
      queueMicrotask(() => onCompleteRef.current?.(held));
      return null;
    });
  }, []);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setTimer((prev) => {
        if (!prev) return prev;
        const next = prev.leftSec - 1;
        if (next <= 0) {
          const held = prev.totalSec;
          queueMicrotask(() => onCompleteRef.current?.(held));
          return null;
        }
        return { ...prev, leftSec: next };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  return {
    timer,
    active,
    start,
    finishEarly,
    dismiss,
  };
}

export { formatRestClock as formatWorkClock };
