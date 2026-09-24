import type { ExerciseFull } from "@bhmt3wp/shared";
import { isTimeBasedExercise, parseEffortInput, type EffortScale } from "@bhmt3wp/shared";
import { api } from "../api/client";
import type { ExerciseLogDraft } from "../components/ExerciseLogForm";

export type ParsedExerciseSet = {
  weightKg: number;
  reps: number;
  effortScale: EffortScale | null;
  effortValue: number | null;
};

export type ParsedExerciseLog = {
  sets: ParsedExerciseSet[];
  notes: string;
  timeBased: boolean;
};

export function parseExerciseLogDraft(
  exerciseName: string,
  draft: ExerciseLogDraft,
): ParsedExerciseLog {
  const timeBased = isTimeBasedExercise(exerciseName);
  const sets = (draft.sets.length > 0 ? draft.sets : [{ weightKg: "0", reps: "1" }]).map(
    (set) => {
      const effort = parseEffortInput(set.effortScale ?? null, set.effortValue);
      const base = timeBased
        ? {
            weightKg: Math.max(0, parseFloat(set.weightKg) || 0),
            reps: Math.max(1, parseInt(set.reps, 10) || 1),
          }
        : {
            weightKg: parseFloat(set.weightKg) || 0,
            reps: Math.max(1, parseInt(set.reps, 10) || 1),
          };
      return {
        ...base,
        effortScale: effort?.scale ?? null,
        effortValue: effort?.value ?? null,
      };
    },
  );

  return {
    sets,
    notes: draft.notes.trim(),
    timeBased,
  };
}

/** Zapisuje serie (mogą mieć różne kg/powt./wysiłek) — tworzy/aktualizuje szablony i logi sesji. */
export async function saveExerciseLogBatch(
  sessionId: string,
  exercise: ExerciseFull,
  parsed: ParsedExerciseLog,
): Promise<void> {
  const setCount = parsed.sets.length;
  if (setCount < 1) {
    throw new Error("Dodaj przynajmniej jedną serię");
  }

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
    if (set.setNumber > setCount) {
      await api.sets.delete(set.id);
    }
  }

  const refreshed = await api.sheets.get(exercise.sheetId);
  const current = refreshed.exercises.find((item) => item.id === exercise.id);
  const currentSets = current?.sets ?? [];

  for (let setNumber = 1; setNumber <= setCount; setNumber++) {
    const parsedSet = parsed.sets[setNumber - 1];
    const existing = currentSets.find((set) => set.setNumber === setNumber);

    if (existing) {
      await api.sets.update(existing.id, {
        weightKg: parsedSet.weightKg,
        reps: parsedSet.reps,
      });
    } else {
      await api.sets.create({
        exerciseId: exercise.id,
        setNumber,
        reps: parsedSet.reps,
        weightKg: parsedSet.weightKg,
        restTimeSec: 60,
      });
    }

    await api.sessions.logSet({
      sessionId,
      exerciseId: exercise.id,
      setNumber,
      reps: parsedSet.reps,
      weightKg: parsedSet.weightKg,
      effortScale: parsedSet.effortScale,
      effortValue: parsedSet.effortValue,
    });
  }

  await api.sessions.upsertExerciseNote({
    sessionId,
    exerciseId: exercise.id,
    notes: parsed.notes,
  });
}
