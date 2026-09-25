import type { WorkoutSheetFull } from "@bhmt3wp/shared";
import { api } from "../api/client";
import { isFreestyleSheetName } from "./ensureFreestyleSheet";
import {
  getSheetProgressionConfig,
  setExerciseProgressionOverride,
  setSheetDefaultProgressionRule,
} from "./progressionPrefs";

function copyName(sourceName: string, existingNames: string[]): string {
  const base = `${sourceName} (kopia)`;
  if (!existingNames.includes(base) && !isFreestyleSheetName(base)) return base;
  let n = 2;
  while (n < 50) {
    const candidate = `${sourceName} (kopia ${n})`;
    if (!existingNames.includes(candidate) && !isFreestyleSheetName(candidate)) {
      return candidate;
    }
    n += 1;
  }
  return `${sourceName} (kopia ${Date.now()})`;
}

/**
 * Deep-copies a named plan (sheet + exercises + template sets).
 * History / sessions stay on the original. Progression prefs follow the copy.
 */
export async function duplicateSheet(sheetId: string): Promise<WorkoutSheetFull> {
  const source = await api.sheets.get(sheetId);
  if (isFreestyleSheetName(source.name)) {
    throw new Error("Nie można duplikować arkusza Freestyle.");
  }

  const allSheets = await api.sheets.list();
  const name = copyName(
    source.name,
    allSheets.map((s) => s.name),
  );

  const created = await api.sheets.create({
    name,
    description: source.description ?? undefined,
  });

  const idMap = new Map<string, string>();

  for (const exercise of source.exercises) {
    const copied = await api.exercises.create({
      sheetId: created.id,
      name: exercise.name,
      notes: exercise.notes ?? undefined,
      orderIndex: exercise.orderIndex,
    });
    idMap.set(exercise.id, copied.id);

    for (const set of exercise.sets) {
      await api.sets.create({
        exerciseId: copied.id,
        setNumber: set.setNumber,
        reps: set.reps,
        weightKg: set.weightKg,
        restTimeSec: set.restTimeSec,
      });
    }
  }

  const progression = await getSheetProgressionConfig(sheetId);
  await setSheetDefaultProgressionRule(created.id, progression.defaultRule);
  for (const [oldId, override] of Object.entries(progression.exercises ?? {})) {
    const newId = idMap.get(oldId);
    if (!newId) continue;
    await setExerciseProgressionOverride(created.id, newId, override);
  }

  return api.sheets.get(created.id);
}
