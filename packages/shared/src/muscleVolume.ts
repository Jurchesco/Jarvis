/**
 * Weekly / range muscle set-volume (D019 §3).
 * Each logged set credits primary muscle +1 and secondary +0.5.
 */

import {
  getMuscleTagsForExercise,
  MUSCLE_GROUPS,
  MUSCLE_LABELS,
  PRIMARY_SET_WEIGHT,
  SECONDARY_SET_WEIGHT,
  type MuscleGroup,
} from "./muscleGroups";

export type MuscleVolumeSessionLike = {
  startedAt: string;
  exercises: Array<{
    exerciseName: string;
    sets: Array<{ isWarmup?: boolean } | unknown>;
  }>;
};

export type MuscleVolumeRow = {
  muscle: MuscleGroup;
  label: string;
  /** Weighted sets (primary 1.0 + secondary 0.5). */
  sets: number;
};

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Monday 00:00 local time for the week containing `date`. */
export function startOfWeekMonday(date: Date = new Date()): Date {
  const day = startOfLocalDay(date);
  const weekday = day.getDay(); // 0 Sun … 6 Sat
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  day.setDate(day.getDate() - daysFromMonday);
  return day;
}

export function endOfWeekExclusive(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 7);
  return end;
}

export function isTimestampInWeek(iso: string, weekStart: Date): boolean {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const start = weekStart.getTime();
  const end = endOfWeekExclusive(weekStart).getTime();
  return t >= start && t < end;
}

function addSetCredit(
  totals: Map<MuscleGroup, number>,
  muscle: MuscleGroup,
  weight: number,
): void {
  totals.set(muscle, (totals.get(muscle) ?? 0) + weight);
}

/**
 * Sum weighted sets per muscle for the given sessions.
 * Exercises without catalog tags are skipped (custom / renamed names).
 * Warm-up sets do not count toward volume.
 */
export function computeMuscleSetVolume(sessions: MuscleVolumeSessionLike[]): MuscleVolumeRow[] {
  const totals = new Map<MuscleGroup, number>();

  for (const session of sessions) {
    for (const group of session.exercises) {
      const tags = getMuscleTagsForExercise(group.exerciseName);
      if (!tags) continue;
      const setCount = group.sets.filter((set) => {
        if (set && typeof set === "object" && "isWarmup" in set) {
          return !(set as { isWarmup?: boolean }).isWarmup;
        }
        return true;
      }).length;
      if (setCount <= 0) continue;
      addSetCredit(totals, tags.primary, setCount * PRIMARY_SET_WEIGHT);
      if (tags.secondary) {
        addSetCredit(totals, tags.secondary, setCount * SECONDARY_SET_WEIGHT);
      }
    }
  }

  return MUSCLE_GROUPS.map((muscle) => ({
    muscle,
    label: MUSCLE_LABELS[muscle],
    sets: Math.round((totals.get(muscle) ?? 0) * 10) / 10,
  })).filter((row) => row.sets > 0)
    .sort((a, b) => b.sets - a.sets || a.label.localeCompare(b.label, "pl"));
}

export function computeMuscleSetVolumeForWeek(
  sessions: MuscleVolumeSessionLike[],
  weekStart: Date = startOfWeekMonday(),
): MuscleVolumeRow[] {
  const inWeek = sessions.filter((session) => isTimestampInWeek(session.startedAt, weekStart));
  return computeMuscleSetVolume(inWeek);
}

export function formatWeightedSets(sets: number): string {
  if (Number.isInteger(sets)) return String(sets);
  return sets.toFixed(1).replace(".", ",");
}
