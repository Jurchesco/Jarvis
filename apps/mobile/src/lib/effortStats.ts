/**
 * Effort summary for Stats (optional RIR/RPE logs).
 */
import type { SessionDetailFull } from "@bhmt3wp/shared";

export type EffortSummary = {
  rated: number;
  done: number;
  avgRir: number | null;
  hardPct: number | null;
  /** Histogram bins for RIR 0..4 and 5+ */
  histogram: { rir: number; label: string; n: number; pct: number }[];
};

const HARD_RIR = 2;

function toRir(scale: string | null | undefined, value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (scale === "rir") return Math.max(0, Math.min(10, value));
  if (scale === "rpe") return Math.max(0, Math.min(10, 10 - value));
  return null;
}

export function computeEffortSummary(sessions: SessionDetailFull[]): EffortSummary | null {
  const rirs: number[] = [];
  let done = 0;
  for (const session of sessions) {
    for (const log of session.logs) {
      done += 1;
      const rir = toRir(log.effortScale, log.effortValue);
      if (rir != null) rirs.push(rir);
    }
  }
  if (rirs.length === 0) return null;

  const avgRir = rirs.reduce((a, b) => a + b, 0) / rirs.length;
  const hard = rirs.filter((r) => r <= HARD_RIR).length;
  const bins = [0, 1, 2, 3, 4].map((rir) => {
    const n = rirs.filter((r) => Math.round(r) === rir).length;
    return { rir, label: `RIR ${rir}`, n, pct: n / rirs.length };
  });
  const tail = rirs.filter((r) => Math.round(r) >= 5).length;
  bins.push({ rir: 5, label: "RIR 5+", n: tail, pct: tail / rirs.length });

  return {
    rated: rirs.length,
    done,
    avgRir: Math.round(avgRir * 10) / 10,
    hardPct: hard / rirs.length,
    histogram: bins,
  };
}
