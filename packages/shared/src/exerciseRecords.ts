/**
 * Rekordy ciężaru (PR) i est. 1RM (Epley) z historii sesji.
 * Est. 1RM liczymy tylko dla serii ≤ EPLEY_MAX_REPS_FOR_1RM (jak OpenGym — bez zgadywania przy wysokich powt.).
 */

import { epley1rm } from "./workoutCalculations";

/** Powyżej tej liczby powtórzeń nie szacujemy 1RM do rekordów / Stats. */
export const EPLEY_MAX_REPS_FOR_1RM = 12;

export type RecordSetLike = {
  weightKg: number;
  reps: number;
};

export type RecordExerciseLike = {
  exerciseName: string;
  sets: RecordSetLike[];
};

export type RecordSessionLike = {
  id: string;
  completedAt: string | null;
  startedAt?: string;
  exercises: RecordExerciseLike[];
};

export type ExerciseSetRecord = {
  weightKg: number;
  reps: number;
  est1rm: number;
  sessionId: string;
  at: string;
};

export type ExerciseRecord = {
  exerciseName: string;
  /** Najcięższa seria (kg) w zakresie. */
  maxWeight: ExerciseSetRecord;
  /** Najlepszy est. 1RM (Epley, serie ≤ 12 powt.), jeśli był. */
  bestEst1rm: ExerciseSetRecord | null;
  /** Ile sesji zawierało to ćwiczenie. */
  sessionCount: number;
};

export type SessionPrHit = {
  exerciseName: string;
  kind: "weight" | "e1rm";
  previous: ExerciseSetRecord | null;
  current: ExerciseSetRecord;
};

/** Epley tylko dla „siłowych” serii (1–12 powt.). */
export function epley1rmForRecord(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0 || reps > EPLEY_MAX_REPS_FOR_1RM) return 0;
  return epley1rm(weightKg, reps);
}

function sessionStamp(session: RecordSessionLike): string {
  return session.completedAt ?? session.startedAt ?? "";
}

function bestWeightInExercise(
  session: RecordSessionLike,
  exercise: RecordExerciseLike,
): ExerciseSetRecord | null {
  let best: ExerciseSetRecord | null = null;
  for (const set of exercise.sets) {
    if (set.weightKg <= 0 || set.reps <= 0) continue;
    if (!best || set.weightKg > best.weightKg) {
      best = {
        weightKg: set.weightKg,
        reps: set.reps,
        est1rm: epley1rmForRecord(set.weightKg, set.reps),
        sessionId: session.id,
        at: sessionStamp(session),
      };
    }
  }
  return best;
}

function bestE1rmInExercise(
  session: RecordSessionLike,
  exercise: RecordExerciseLike,
): ExerciseSetRecord | null {
  let best: ExerciseSetRecord | null = null;
  for (const set of exercise.sets) {
    const est = epley1rmForRecord(set.weightKg, set.reps);
    if (est <= 0) continue;
    if (
      !best ||
      est > best.est1rm ||
      (est === best.est1rm && set.weightKg > best.weightKg)
    ) {
      best = {
        weightKg: set.weightKg,
        reps: set.reps,
        est1rm: est,
        sessionId: session.id,
        at: sessionStamp(session),
      };
    }
  }
  return best;
}

/** Max ciężar w sesji dla ćwiczenia (0 gdy brak). */
export function sessionMaxWeightKg(
  session: RecordSessionLike,
  exerciseName: string,
): number {
  const group = session.exercises.find((ex) => ex.exerciseName === exerciseName);
  if (!group) return 0;
  return group.sets.reduce((max, set) => Math.max(max, set.weightKg > 0 ? set.weightKg : 0), 0);
}

/** Najlepszy est. 1RM w sesji dla ćwiczenia (0 gdy brak / tylko >12 powt.). */
export function sessionBestEst1rm(
  session: RecordSessionLike,
  exerciseName: string,
): number {
  const group = session.exercises.find((ex) => ex.exerciseName === exerciseName);
  if (!group) return 0;
  let best = 0;
  for (const set of group.sets) {
    best = Math.max(best, epley1rmForRecord(set.weightKg, set.reps));
  }
  return best;
}

/**
 * Agreguje rekordy per nazwa ćwiczenia z chronologicznej listy sesji
 * (najstarsza → najnowsza lub dowolna — bierzemy globalne max).
 */
export function computeExerciseRecords(sessions: RecordSessionLike[]): ExerciseRecord[] {
  const byName = new Map<
    string,
    {
      maxWeight: ExerciseSetRecord | null;
      bestEst1rm: ExerciseSetRecord | null;
      sessionIds: Set<string>;
    }
  >();

  for (const session of sessions) {
    if (!session.completedAt && !session.startedAt) continue;
    for (const exercise of session.exercises) {
      const name = exercise.exerciseName?.trim();
      if (!name) continue;

      let entry = byName.get(name);
      if (!entry) {
        entry = { maxWeight: null, bestEst1rm: null, sessionIds: new Set() };
        byName.set(name, entry);
      }
      entry.sessionIds.add(session.id);

      const weightHit = bestWeightInExercise(session, exercise);
      if (weightHit) {
        if (!entry.maxWeight || weightHit.weightKg > entry.maxWeight.weightKg) {
          entry.maxWeight = weightHit;
        }
      }

      const e1rmHit = bestE1rmInExercise(session, exercise);
      if (e1rmHit) {
        if (
          !entry.bestEst1rm ||
          e1rmHit.est1rm > entry.bestEst1rm.est1rm ||
          (e1rmHit.est1rm === entry.bestEst1rm.est1rm &&
            e1rmHit.weightKg > entry.bestEst1rm.weightKg)
        ) {
          entry.bestEst1rm = e1rmHit;
        }
      }
    }
  }

  const rows: ExerciseRecord[] = [];
  for (const [exerciseName, entry] of byName) {
    if (!entry.maxWeight) continue;
    rows.push({
      exerciseName,
      maxWeight: entry.maxWeight,
      bestEst1rm: entry.bestEst1rm,
      sessionCount: entry.sessionIds.size,
    });
  }

  return rows.sort((a, b) => {
    const aScore = a.bestEst1rm?.est1rm ?? a.maxWeight.weightKg;
    const bScore = b.bestEst1rm?.est1rm ?? b.maxWeight.weightKg;
    return bScore - aScore;
  });
}

/**
 * Wykrywa PR w `current` względem historii `priorSessions`
 * (sesje bez current; zwykle wszystkie wcześniejsze zakończone).
 */
export function detectSessionPrs(
  current: RecordSessionLike,
  priorSessions: RecordSessionLike[],
): SessionPrHit[] {
  const priorRecords = computeExerciseRecords(priorSessions);
  const priorByName = new Map(priorRecords.map((row) => [row.exerciseName, row]));
  const hits: SessionPrHit[] = [];

  for (const exercise of current.exercises) {
    const name = exercise.exerciseName?.trim();
    if (!name) continue;
    const prior = priorByName.get(name);
    const weightNow = bestWeightInExercise(current, exercise);
    const e1rmNow = bestE1rmInExercise(current, exercise);

    if (weightNow) {
      const prevW = prior?.maxWeight ?? null;
      if (!prevW || weightNow.weightKg > prevW.weightKg) {
        hits.push({
          exerciseName: name,
          kind: "weight",
          previous: prevW,
          current: weightNow,
        });
      }
    }

    if (e1rmNow) {
      const prevE = prior?.bestEst1rm ?? null;
      if (!prevE || e1rmNow.est1rm > prevE.est1rm) {
        hits.push({
          exerciseName: name,
          kind: "e1rm",
          previous: prevE,
          current: e1rmNow,
        });
      }
    }
  }

  return hits.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "e1rm" ? -1 : 1;
    return b.current.est1rm - a.current.est1rm || b.current.weightKg - a.current.weightKg;
  });
}

/** Format daty rekordu do UI (pl-PL, krótko). */
export function formatRecordDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" });
}
