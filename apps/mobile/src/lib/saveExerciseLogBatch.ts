import type { ExerciseFull } from "@bhmt3wp/shared";
import { isTimeBasedExercise } from "@bhmt3wp/shared";
import { api } from "../api/client";
import type { ExerciseLogDraft } from "../components/ExerciseLogForm";

export type ParsedExerciseLog = {
  setCount: number;
  weightKg: number;
  reps: number;
  notes: string;
  timeBased: boolean;
};

export function parseExerciseLogDraft(
  exerciseName: string,
  draft: ExerciseLogDraft,
): ParsedExerciseLog {
  const timeBased = isTimeBasedExercise(exerciseName);
  const setCount = Math.max(1, parseInt(draft.setCount, 10) || 1);

  if (timeBased) {
    return {
      setCount,
      weightKg: 0,
      reps: Math.max(1, parseInt(draft.reps, 10) || 1),
      notes: draft.notes.trim(),
      timeBased: true,
    };
  }

  return {
    setCount,
    weightKg: parseFloat(draft.weightKg) || 0,
    reps: Math.max(1, parseInt(draft.reps, 10) || 1),
    notes: draft.notes.trim(),
    timeBased: false,
  };
}

/** Zapisuje N serii naraz — tworzy/aktualizuje szablony i logi sesji. */
export async function saveExerciseLogBatch(
  sessionId: string,
  exercise: ExerciseFull,
  parsed: ParsedExerciseLog,
): Promise<void> {
  const existingLogs = await api.sessions.get(sessionId).then((session) =>
    session.logs.filter((log) => log.exerciseId === exercise.id),
  );

  for (const log of existingLogs) {
    await api.sessions.unlogSet({
      sessionId,
      exerciseId: exercise.id,
      setNumber: log.setNumber,
    });
  }

  for (const set of exercise.sets) {
    if (set.setNumber > parsed.setCount) {
      await api.sets.delete(set.id);
    }
  }

  const refreshed = await api.sheets.get(exercise.sheetId);
  const current = refreshed.exercises.find((item) => item.id === exercise.id);
  const currentSets = current?.sets ?? [];

  for (let setNumber = 1; setNumber <= parsed.setCount; setNumber++) {
    const existing = currentSets.find((set) => set.setNumber === setNumber);

    if (existing) {
      await api.sets.update(existing.id, {
        weightKg: parsed.weightKg,
        reps: parsed.reps,
      });
    } else {
      await api.sets.create({
        exerciseId: exercise.id,
        setNumber,
        reps: parsed.reps,
        weightKg: parsed.weightKg,
        restTimeSec: 60,
      });
    }

    await api.sessions.logSet({
      sessionId,
      exerciseId: exercise.id,
      setNumber,
      reps: parsed.reps,
      weightKg: parsed.weightKg,
    });
  }

  await api.sessions.upsertExerciseNote({
    sessionId,
    exerciseId: exercise.id,
    notes: parsed.notes,
  });
}
