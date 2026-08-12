/**
 * Kalkulacje treningowe — zgodne z dziennikiem Perplexity (Epley 1RM).
 * Importer do Sheets używa Brzyckiego; UI treningu celowo Epley jak w PWA.
 */

/** Szacowany 1RM (Epley): ciężar × (1 + powtórzenia / 30) */
export function epley1rm(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

/** Objętość pojedynczej serii: ciężar × powtórzenia */
export function setVolume(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  return weightKg * reps;
}

/** Łączna objętość ćwiczenia (N identycznych serii) */
export function exerciseVolume(weightKg: number, reps: number, setCount: number): number {
  if (setCount <= 0) return 0;
  return setVolume(weightKg, reps) * setCount;
}

export function formatWeightKg(value: number): string {
  return `${value.toFixed(1)} kg`;
}

export function formatVolumeKg(value: number): string {
  return `${Math.round(value)} kg`;
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function sessionDurationSec(startedAt: string, completedAt: string | null): number {
  if (!completedAt) return 0;
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  return Math.max(0, Math.floor((end - start) / 1000));
}

export type SessionLiveStats = {
  exerciseCount: number;
  setCount: number;
  totalVolume: number;
  bestEst1rm: number;
  totalReps: number;
};

export function computeSessionLiveStats(
  logs: { exerciseId: string; weightKg: number; reps: number }[],
): SessionLiveStats {
  const exerciseIds = new Set<string>();
  let totalVolume = 0;
  let bestEst1rm = 0;
  let totalReps = 0;

  for (const log of logs) {
    exerciseIds.add(log.exerciseId);
    if (log.weightKg > 0 && log.reps > 0) {
      totalVolume += setVolume(log.weightKg, log.reps);
      bestEst1rm = Math.max(bestEst1rm, epley1rm(log.weightKg, log.reps));
      totalReps += log.reps;
    } else if (log.reps > 0) {
      totalReps += log.reps;
    }
  }

  return {
    exerciseCount: exerciseIds.size,
    setCount: logs.length,
    totalVolume,
    bestEst1rm,
    totalReps,
  };
}
