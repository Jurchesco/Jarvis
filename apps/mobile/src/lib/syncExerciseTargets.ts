import { api } from "../api/client";

const DEFAULT_REST_SEC = 60;
const DEFAULT_WEIGHT_KG = 0;

export type ExerciseTargets = {
  setCount: number;
  /** Target reps (or seconds for time-based). Applied to every template set. */
  reps: number;
  restTimeSec?: number;
};

/**
 * Syncs `exercise_sets` template rows to match planned set count + target reps.
 * Used by the plan editor (D018) — not session logs.
 */
export async function syncExerciseTargets(
  exerciseId: string,
  targets: ExerciseTargets,
): Promise<void> {
  const setCount = Math.max(0, Math.floor(targets.setCount));
  const reps = Math.max(1, Math.floor(targets.reps));
  const restTimeSec = targets.restTimeSec ?? DEFAULT_REST_SEC;

  const existing = await api.sets.listByExercise(exerciseId);
  const sorted = [...existing].sort((a, b) => a.setNumber - b.setNumber);

  if (setCount === 0) {
    await Promise.all(sorted.map((set) => api.sets.delete(set.id)));
    return;
  }

  const keep = sorted.slice(0, setCount);
  const drop = sorted.slice(setCount);

  await Promise.all(
    keep.map((set, index) =>
      api.sets.update(set.id, {
        setNumber: index + 1,
        reps,
        restTimeSec,
      }),
    ),
  );

  await Promise.all(drop.map((set) => api.sets.delete(set.id)));

  for (let setNumber = keep.length + 1; setNumber <= setCount; setNumber++) {
    await api.sets.create({
      exerciseId,
      setNumber,
      reps,
      weightKg: DEFAULT_WEIGHT_KG,
      restTimeSec,
    });
  }
}

export function targetsFromSets(
  sets: { reps: number }[],
): { setCount: number; reps: number } {
  if (sets.length === 0) return { setCount: 0, reps: 10 };
  const reps = sets[0]?.reps ?? 10;
  return { setCount: sets.length, reps };
}
