import type { ExerciseSet, ProgressionTarget, SessionSetLog } from "@bhmt3wp/shared";
import type { ExerciseLogDraft } from "../components/ExerciseLogForm";

const EMPTY_SET = {
  weightKg: "",
  reps: "",
  effortScale: null as null,
  effortValue: "",
};

/** Map progression engine targets into an exercise log draft. */
export function createDraftFromProgression(
  targets: ProgressionTarget[],
  notes = "",
  previousLogs?: SessionSetLog[] | null,
): ExerciseLogDraft {
  if (!targets || targets.length === 0) {
    return { sets: [{ ...EMPTY_SET }], notes };
  }

  const prevBySet = new Map(
    (previousLogs ?? []).map((log) => [log.setNumber, log] as const),
  );

  return {
    notes,
    sets: [...targets]
      .sort((a, b) => a.setNumber - b.setNumber)
      .map((target) => {
        const prev = prevBySet.get(target.setNumber);
        return {
          weightKg: String(target.weightKg),
          reps: String(target.reps),
          effortScale: prev?.effortScale ?? null,
          effortValue:
            prev?.effortValue != null && Number.isFinite(prev.effortValue)
              ? String(prev.effortValue)
              : "",
        };
      }),
  };
}

export function plannedSetsFromTemplate(
  templateSets: ExerciseSet[] | null | undefined,
): { setNumber: number; weightKg: number; reps: number }[] {
  if (!templateSets || templateSets.length === 0) return [];
  return [...templateSets]
    .sort((a, b) => a.setNumber - b.setNumber)
    .map((set) => ({
      setNumber: set.setNumber,
      weightKg: set.weightKg,
      reps: set.reps,
    }));
}
