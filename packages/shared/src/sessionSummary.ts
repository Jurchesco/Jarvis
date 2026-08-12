/**
 * Insights i copy na ekran podsumowania treningu.
 */

import {
  computeSessionLiveStats,
  epley1rm,
  formatDuration,
  formatVolumeKg,
  formatWeightKg,
  sessionDurationSec,
  setVolume,
  type SessionLiveStats,
} from "./workoutCalculations";

export type SessionLogLike = {
  exerciseId: string;
  weightKg: number;
  reps: number;
};

export type SessionExerciseLike = {
  exerciseId: string;
  exerciseName: string;
  sets: SessionLogLike[];
};

export type SessionSummaryLike = {
  startedAt: string;
  completedAt: string | null;
  logs: SessionLogLike[];
  exercises: SessionExerciseLike[];
};

export type RankedExerciseVolume = {
  exerciseId: string;
  exerciseName: string;
  volume: number;
  setCount: number;
  bestEst1rm: number;
};

export type SessionComparison = {
  previousVolume: number;
  volumeDelta: number;
  volumeDeltaPercent: number | null;
  setDelta: number;
  exerciseDelta: number;
  durationDeltaSec: number | null;
};

export type SessionSummaryInsights = {
  stats: SessionLiveStats;
  durationSec: number;
  avgVolumePerSet: number;
  avgRepsPerSet: number;
  heaviestSet: { weightKg: number; reps: number; est1rm: number } | null;
  best1rm: { exerciseName: string; weightKg: number; reps: number; est1rm: number } | null;
  topExercises: RankedExerciseVolume[];
  comparison: SessionComparison | null;
  headline: string;
  subheadline: string;
  highlights: { label: string; value: string; detail?: string }[];
};

function getSessionDurationSec(session: SessionSummaryLike): number {
  return sessionDurationSec(session.startedAt, session.completedAt);
}

function volumeFromLogs(logs: SessionLogLike[]): number {
  return logs.reduce((sum, log) => sum + setVolume(log.weightKg, log.reps), 0);
}

function rankExercises(session: SessionSummaryLike): RankedExerciseVolume[] {
  const nameById = new Map(session.exercises.map((ex) => [ex.exerciseId, ex.exerciseName]));

  const byExercise = new Map<string, RankedExerciseVolume>();

  for (const log of session.logs) {
    const name = nameById.get(log.exerciseId) ?? "Ćwiczenie";
    const vol = setVolume(log.weightKg, log.reps);
    const est = epley1rm(log.weightKg, log.reps);
    const existing = byExercise.get(log.exerciseId);

    if (!existing) {
      byExercise.set(log.exerciseId, {
        exerciseId: log.exerciseId,
        exerciseName: name,
        volume: vol,
        setCount: 1,
        bestEst1rm: est,
      });
    } else {
      existing.volume += vol;
      existing.setCount += 1;
      existing.bestEst1rm = Math.max(existing.bestEst1rm, est);
    }
  }

  return [...byExercise.values()].sort((a, b) => b.volume - a.volume);
}

function findHeaviestSet(logs: SessionLogLike[]) {
  let best: { weightKg: number; reps: number; est1rm: number } | null = null;
  for (const log of logs) {
    if (log.weightKg <= 0 || log.reps <= 0) continue;
    if (!best || log.weightKg > best.weightKg) {
      best = {
        weightKg: log.weightKg,
        reps: log.reps,
        est1rm: epley1rm(log.weightKg, log.reps),
      };
    }
  }
  return best;
}

function findBest1rm(session: SessionSummaryLike) {
  const nameById = new Map(session.exercises.map((ex) => [ex.exerciseId, ex.exerciseName]));
  let best: SessionSummaryInsights["best1rm"] = null;

  for (const log of session.logs) {
    if (log.weightKg <= 0 || log.reps <= 0) continue;
    const est = epley1rm(log.weightKg, log.reps);
    if (!best || est > best.est1rm) {
      best = {
        exerciseName: nameById.get(log.exerciseId) ?? "Ćwiczenie",
        weightKg: log.weightKg,
        reps: log.reps,
        est1rm: est,
      };
    }
  }
  return best;
}

function formatSignedVolume(delta: number): string {
  const rounded = Math.round(Math.abs(delta));
  const formatted = rounded.toLocaleString("pl-PL");
  if (delta > 0) return `+${formatted} kg`;
  if (delta < 0) return `−${formatted} kg`;
  return "0 kg";
}

function buildHeadlines(
  stats: SessionLiveStats,
  comparison: SessionComparison | null,
  durationSec: number,
): { headline: string; subheadline: string } {
  if (comparison && comparison.volumeDelta > 0 && (comparison.volumeDeltaPercent ?? 0) >= 8) {
    return {
      headline: "Nowy rekord objętości",
      subheadline: `${formatSignedVolume(comparison.volumeDelta)} więcej niż ostatnio — świetna progresja.`,
    };
  }

  if (comparison && comparison.volumeDelta > 0) {
    return {
      headline: "Lepszy niż ostatnio",
      subheadline: `Objętość w górę o ${formatSignedVolume(comparison.volumeDelta)}. Tak trzymaj.`,
    };
  }

  if (stats.setCount >= 18) {
    return {
      headline: "Solidna objętość",
      subheadline: `${stats.setCount} serii w jednej sesji — prawdziwa robota.`,
    };
  }

  if (durationSec >= 3600) {
    return {
      headline: "Maraton na siłowni",
      subheadline: `Ponad ${formatDuration(durationSec)} treningu. Szacun.`,
    };
  }

  if (stats.exerciseCount >= 6) {
    return {
      headline: "Pełny trening",
      subheadline: `${stats.exerciseCount} ćwiczeń — dobrze ułożona sesja.`,
    };
  }

  if (stats.bestEst1rm >= 100) {
    return {
      headline: "Silny trening",
      subheadline: `Est. 1RM powyżej setki (${formatWeightKg(stats.bestEst1rm)}).`,
    };
  }

  return {
    headline: "Trening ukończony",
    subheadline: "Kolejna sesja w kieszeni. Odpocznij i regeneruj się.",
  };
}

export function buildSessionSummaryInsights(
  session: SessionSummaryLike,
  previousSession: SessionSummaryLike | null = null,
): SessionSummaryInsights {
  const stats = computeSessionLiveStats(session.logs);
  const durationSec = getSessionDurationSec(session);
  const avgVolumePerSet = stats.setCount > 0 ? stats.totalVolume / stats.setCount : 0;
  const avgRepsPerSet = stats.setCount > 0 ? stats.totalReps / stats.setCount : 0;
  const heaviestSet = findHeaviestSet(session.logs);
  const best1rm = findBest1rm(session);
  const topExercises = rankExercises(session).slice(0, 3);

  let comparison: SessionComparison | null = null;
  if (previousSession && previousSession.logs.length > 0) {
    const previousVolume = volumeFromLogs(previousSession.logs);
    const prevStats = computeSessionLiveStats(previousSession.logs);
    const volumeDelta = stats.totalVolume - previousVolume;
    const volumeDeltaPercent =
      previousVolume > 0 ? Math.round((volumeDelta / previousVolume) * 100) : null;
    const prevDuration = getSessionDurationSec(previousSession);

    comparison = {
      previousVolume,
      volumeDelta,
      volumeDeltaPercent,
      setDelta: stats.setCount - prevStats.setCount,
      exerciseDelta: stats.exerciseCount - prevStats.exerciseCount,
      durationDeltaSec: durationSec > 0 && prevDuration > 0 ? durationSec - prevDuration : null,
    };
  }

  const { headline, subheadline } = buildHeadlines(stats, comparison, durationSec);

  const highlights: SessionSummaryInsights["highlights"] = [
    {
      label: "Czas treningu",
      value: formatDuration(durationSec),
      detail: comparison?.durationDeltaSec
        ? `${
            comparison.durationDeltaSec > 0 ? "+" : ""
          }${formatDuration(Math.abs(comparison.durationDeltaSec))} vs poprzednio`
        : undefined,
    },
    {
      label: "Objętość",
      value: stats.totalVolume > 0 ? formatVolumeKg(stats.totalVolume) : "—",
      detail: comparison ? formatSignedVolume(comparison.volumeDelta) + " vs poprzednio" : undefined,
    },
    {
      label: "Serie",
      value: String(stats.setCount),
      detail:
        comparison && comparison.setDelta !== 0
          ? `${comparison.setDelta > 0 ? "+" : ""}${comparison.setDelta} vs poprzednio`
          : `${stats.exerciseCount} ćwiczeń`,
    },
    {
      label: "Powtórzenia",
      value: stats.totalReps > 0 ? stats.totalReps.toLocaleString("pl-PL") : "—",
      detail:
        avgRepsPerSet > 0 ? `~${Math.round(avgRepsPerSet)} na serię` : undefined,
    },
  ];

  if (stats.bestEst1rm > 0) {
    highlights.push({
      label: "Najlepszy Est. 1RM",
      value: formatWeightKg(stats.bestEst1rm),
      detail: best1rm ? `${best1rm.exerciseName} · ${best1rm.weightKg}×${best1rm.reps}` : undefined,
    });
  }

  if (heaviestSet) {
    highlights.push({
      label: "Najcięższa seria",
      value: `${heaviestSet.weightKg} kg × ${heaviestSet.reps}`,
      detail: `Est. 1RM ${formatWeightKg(heaviestSet.est1rm)}`,
    });
  }

  if (avgVolumePerSet > 0) {
    highlights.push({
      label: "Średnia na serię",
      value: formatVolumeKg(avgVolumePerSet),
      detail: "objętość / seria",
    });
  }

  return {
    stats,
    durationSec,
    avgVolumePerSet,
    avgRepsPerSet,
    heaviestSet,
    best1rm,
    topExercises,
    comparison,
    headline,
    subheadline,
    highlights,
  };
}
