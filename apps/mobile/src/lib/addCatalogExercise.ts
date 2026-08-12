import type { CatalogExercise } from "@bhmt3wp/shared";
import { api } from "../api/client";

const DEFAULT_SET_COUNT = 3;
const DEFAULT_REPS = 10;
const DEFAULT_TIME_SEC = 30;
const DEFAULT_REST_SEC = 60;

export type AddCatalogExerciseOptions = {
  /** Domyślnie 3 (planowanie); w trakcie treningu użyj 1. */
  setCount?: number;
};

export async function addCatalogExerciseToSheet(
  sheetId: string,
  exercise: CatalogExercise | { name: string; timeBased?: boolean },
  orderIndex: number,
  options?: AddCatalogExerciseOptions,
): Promise<{ exerciseId: string }> {
  const setCount = options?.setCount ?? DEFAULT_SET_COUNT;
  const timeBased = "timeBased" in exercise ? exercise.timeBased : false;
  const created = await api.exercises.create({
    sheetId,
    name: exercise.name,
    orderIndex,
    notes: timeBased ? "Ćwiczenie na czas — wpisuj sekundy w kolumnie powtórzeń." : undefined,
  });

  if (setCount <= 0) {
    return { exerciseId: created.id };
  }

  const reps = timeBased ? DEFAULT_TIME_SEC : DEFAULT_REPS;
  for (let setNumber = 1; setNumber <= setCount; setNumber++) {
    await api.sets.create({
      exerciseId: created.id,
      setNumber,
      reps,
      weightKg: 0,
      restTimeSec: DEFAULT_REST_SEC,
    });
  }

  return { exerciseId: created.id };
}
