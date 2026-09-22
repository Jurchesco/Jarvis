import { useCallback, useEffect, useRef, useState } from "react";

export type RestTimerState = {
  totalSec: number;
  leftSec: number;
};

function clampRest(sec: number): number {
  return Math.max(0, Math.min(sec, 60 * 30));
}

/**
 * Countdown for rest between exercises/sets (D019).
 * Inspired by OpenGym UX; Jarvis-owned implementation (−15 / +30 / dismiss).
 */
export function useRestTimer() {
  const [timer, setTimer] = useState<RestTimerState | null>(null);
  const finishedRef = useRef(false);

  const dismiss = useCallback(() => {
    finishedRef.current = false;
    setTimer(null);
  }, []);

  const start = useCallback((seconds: number) => {
    const totalSec = clampRest(Math.round(seconds));
    if (totalSec <= 0) {
      setTimer(null);
      return;
    }
    finishedRef.current = false;
    setTimer({ totalSec, leftSec: totalSec });
  }, []);

  const adjust = useCallback((deltaSec: number) => {
    setTimer((prev) => {
      if (!prev) return prev;
      const leftSec = clampRest(prev.leftSec + deltaSec);
      const totalSec = Math.max(prev.totalSec, leftSec);
      if (leftSec <= 0) return null;
      return { totalSec, leftSec };
    });
  }, []);

  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => {
      setTimer((prev) => {
        if (!prev) return prev;
        const next = prev.leftSec - 1;
        if (next <= 0) {
          finishedRef.current = true;
          return null;
        }
        return { ...prev, leftSec: next };
      });
    }, 1000);
    return () => clearInterval(id);
    // Only (re)arm when timer appears/disappears — not on every adjust of totalSec.
  }, [!!timer]);

  return {
    timer,
    active: timer !== null,
    start,
    adjust,
    dismiss,
    /** True for one render cycle after natural expiry (consumers may haptic). */
    didFinishNaturally: finishedRef,
  };
}

export function formatRestClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
