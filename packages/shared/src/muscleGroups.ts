/**
 * Muscle tags for catalog exercises (D019 §3).
 * Primary set = 1.0, secondary = 0.5 toward weekly set volume.
 */

import { EXERCISE_CATALOG, normalizeExerciseName } from "./exerciseCatalog";

export type MuscleGroup =
  | "chest"
  | "shoulders"
  | "triceps"
  | "back"
  | "biceps"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "core";

export type MuscleTags = {
  primary: MuscleGroup;
  secondary?: MuscleGroup;
};

export const MUSCLE_GROUPS: MuscleGroup[] = [
  "chest",
  "shoulders",
  "triceps",
  "back",
  "biceps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
];

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: "Klatka",
  shoulders: "Barki",
  triceps: "Triceps",
  back: "Plecy",
  biceps: "Biceps",
  quads: "Uda przód",
  hamstrings: "Uda tył",
  glutes: "Pośladki",
  calves: "Łydki",
  core: "Core",
};

/** Primary credit per logged set; secondary is half. */
export const PRIMARY_SET_WEIGHT = 1;
export const SECONDARY_SET_WEIGHT = 0.5;

const TAGS_BY_NAME: Record<string, MuscleTags> = {
  // Push
  "Wyciskanie sztangi - ławka płaska": { primary: "chest", secondary: "triceps" },
  "Wyciskanie sztangi - ławka skośna": { primary: "chest", secondary: "shoulders" },
  "Wyciskanie hantli - ławka płaska": { primary: "chest", secondary: "triceps" },
  "Wyciskanie hantli nad głowę (OHP)": { primary: "shoulders", secondary: "triceps" },
  "Wyciskanie sztangi nad głowę (OHP)": { primary: "shoulders", secondary: "triceps" },
  "Landmine Push Press": { primary: "shoulders", secondary: "triceps" },
  "Dipy na poręczach": { primary: "chest", secondary: "triceps" },
  "Rozpiętki na hantlach": { primary: "chest" },
  "Rozpiętki na wyciągu (kabel)": { primary: "chest" },
  "Wznosy bokiem na barki (boczne unoszenie hantli)": { primary: "shoulders" },
  "Wyciskanie francuskie (triceps)": { primary: "triceps" },
  "Rozgięcia na triceps na wyciągu": { primary: "triceps" },
  "Arnold Press": { primary: "shoulders", secondary: "triceps" },

  // Pull
  "Martwy ciąg": { primary: "back", secondary: "hamstrings" },
  "Podciąganie na drążku - nachwyt (pull-up)": { primary: "back", secondary: "biceps" },
  "Podciąganie na drążku - podchwyt (chin-up)": { primary: "back", secondary: "biceps" },
  "Ściąganie drążka wyciągu górnego (lat pulldown)": { primary: "back", secondary: "biceps" },
  "Wiosłowanie sztangą": { primary: "back", secondary: "biceps" },
  "Wiosłowanie hantlą jednorącz": { primary: "back", secondary: "biceps" },
  "Wiosłowanie na wyciągu niskim (seated row)": { primary: "back", secondary: "biceps" },
  "ISO Lateral Row": { primary: "back", secondary: "biceps" },
  "Landmine Row": { primary: "back", secondary: "biceps" },
  "Face Pull": { primary: "shoulders", secondary: "back" },
  "Uginanie ramion ze sztangą (biceps)": { primary: "biceps" },
  "Uginanie ramion z hantlami (biceps)": { primary: "biceps" },
  "Uginanie ramion młotkowe (hammer curl)": { primary: "biceps" },

  // Legs
  "Przysiad ze sztangą (squat)": { primary: "quads", secondary: "glutes" },
  "Przysiad przedni (front squat)": { primary: "quads", secondary: "glutes" },
  "Przysiad bułgarski": { primary: "quads", secondary: "glutes" },
  "Martwy ciąg rumuński (RDL)": { primary: "hamstrings", secondary: "glutes" },
  "Wypychanie nogami na maszynie (leg press)": { primary: "quads", secondary: "glutes" },
  "Wykroki": { primary: "quads", secondary: "glutes" },
  "Uginanie nóg na maszynie (leg curl)": { primary: "hamstrings" },
  "Wyprost nóg na maszynie (leg extension)": { primary: "quads" },
  "Hip Thrust": { primary: "glutes", secondary: "hamstrings" },
  "Wspięcia na palce (calf raises)": { primary: "calves" },

  // Abs / core
  "Plank (deska)": { primary: "core" },
  "Deska boczna (side plank)": { primary: "core" },
  "Brzuszki (crunch)": { primary: "core" },
  "Unoszenie nóg w zwisie": { primary: "core" },
  "Russian twist": { primary: "core" },
  "Ab wheel (kółko)": { primary: "core" },
  "Kolanka do łokci na wyciągu (cable crunch)": { primary: "core" },
};

const TAGS_BY_NORMALIZED = new Map<string, MuscleTags>(
  Object.entries(TAGS_BY_NAME).map(([name, tags]) => [normalizeExerciseName(name), tags]),
);

export function getMuscleTagsForExercise(name: string): MuscleTags | null {
  return TAGS_BY_NORMALIZED.get(normalizeExerciseName(name)) ?? null;
}

/** Dev / QA: every catalog exercise must have tags. */
export function assertCatalogMuscleCoverage(): string[] {
  const missing: string[] = [];
  for (const item of EXERCISE_CATALOG) {
    if (!getMuscleTagsForExercise(item.name)) missing.push(item.name);
  }
  return missing;
}
