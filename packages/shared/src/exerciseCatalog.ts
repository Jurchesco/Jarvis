/**
 * Baza ćwiczeń — przeniesiona z dziennika Perplexity (PPL + Brzuch).
 * Źródło: Dziennik Siłowni (Perplexity), 2026-08.
 */

export type WorkoutSplit = "push" | "pull" | "legs" | "abs";

export interface CatalogExercise {
  name: string;
  split: WorkoutSplit;
  /** Ćwiczenie na czas (sekundy zamiast powtórzeń), np. plank. */
  timeBased?: boolean;
}

export const SPLIT_LABELS: Record<WorkoutSplit, string> = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  abs: "Brzuch",
};

/** Kolejność zakładek w pickerze. */
export const WORKOUT_SPLITS: WorkoutSplit[] = ["push", "pull", "legs", "abs"];

const pushNames = [
  "Wyciskanie sztangi - ławka płaska",
  "Wyciskanie sztangi - ławka skośna",
  "Wyciskanie hantli - ławka płaska",
  "Wyciskanie hantli nad głowę (OHP)",
  "Wyciskanie sztangi nad głowę (OHP)",
  "Landmine Push Press",
  "Dipy na poręczach",
  "Rozpiętki na hantlach",
  "Rozpiętki na wyciągu (kabel)",
  "Wznosy bokiem na barki (boczne unoszenie hantli)",
  "Wyciskanie francuskie (triceps)",
  "Rozgięcia na triceps na wyciągu",
  "Arnold Press",
] as const;

const pullNames = [
  "Martwy ciąg",
  "Podciąganie na drążku - nachwyt (pull-up)",
  "Podciąganie na drążku - podchwyt (chin-up)",
  "Ściąganie drążka wyciągu górnego (lat pulldown)",
  "Wiosłowanie sztangą",
  "Wiosłowanie hantlą jednorącz",
  "Wiosłowanie na wyciągu niskim (seated row)",
  "ISO Lateral Row",
  "Landmine Row",
  "Face Pull",
  "Uginanie ramion ze sztangą (biceps)",
  "Uginanie ramion z hantlami (biceps)",
  "Uginanie ramion młotkowe (hammer curl)",
] as const;

const legsNames = [
  "Przysiad ze sztangą (squat)",
  "Przysiad przedni (front squat)",
  "Przysiad bułgarski",
  "Martwy ciąg rumuński (RDL)",
  "Wypychanie nogami na maszynie (leg press)",
  "Wykroki",
  "Uginanie nóg na maszynie (leg curl)",
  "Wyprost nóg na maszynie (leg extension)",
  "Hip Thrust",
  "Wspięcia na palce (calf raises)",
] as const;

const absNames = [
  "Plank (deska)",
  "Deska boczna (side plank)",
  "Brzuszki (crunch)",
  "Unoszenie nóg w zwisie",
  "Russian twist",
  "Ab wheel (kółko)",
  "Kolanka do łokci na wyciągu (cable crunch)",
] as const;

const TIME_BASED_NAMES = new Set<string>([
  "Plank (deska)",
  "Deska boczna (side plank)",
]);

function buildCatalog(
  split: WorkoutSplit,
  names: readonly string[],
): CatalogExercise[] {
  return names.map((name) => ({
    name,
    split,
    timeBased: TIME_BASED_NAMES.has(name) ? true : undefined,
  }));
}

export const EXERCISE_CATALOG: CatalogExercise[] = [
  ...buildCatalog("push", pushNames),
  ...buildCatalog("pull", pullNames),
  ...buildCatalog("legs", legsNames),
  ...buildCatalog("abs", absNames),
];

export const PPL_SHEET_TEMPLATES: {
  split: WorkoutSplit;
  name: string;
  description: string;
}[] = [
  { split: "push", name: "PUSH", description: "Klatka, barki, triceps" },
  { split: "pull", name: "PULL", description: "Plecy, biceps" },
  { split: "legs", name: "LEGS", description: "Nogi, pośladki" },
  { split: "abs", name: "BRZUCH", description: "Core / brzuch" },
];

export function isTimeBasedExercise(name: string): boolean {
  return TIME_BASED_NAMES.has(name.trim());
}

export function normalizeExerciseName(name: string): string {
  return name.trim().toLocaleLowerCase("pl-PL");
}

export function inferSplitFromSheetName(sheetName: string): WorkoutSplit | null {
  const n = sheetName.trim().toLocaleLowerCase("pl-PL");

  if (/\b(push|klat|wycisk|bark|triceps|pec)\b/.test(n)) return "push";
  if (/\b(pull|plecy|wiosł|podci|biceps|ciąg|dead|row)\b/.test(n)) return "pull";
  if (/\b(leg|nogi|przysiad|squat|rdl|quad|łydk)\b/.test(n)) return "legs";
  if (/\b(abs|brzuch|core|plank)\b/.test(n)) return "abs";

  if (n === "push" || n === "pull" || n === "legs") {
    return n as WorkoutSplit;
  }
  if (n === "brzuch") return "abs";

  return null;
}

export function getCatalogExercisesForSplit(split: WorkoutSplit): CatalogExercise[] {
  return EXERCISE_CATALOG.filter((item) => item.split === split);
}

export function searchCatalogExercises(
  query: string,
  split?: WorkoutSplit | null,
): CatalogExercise[] {
  const q = query.trim().toLocaleLowerCase("pl-PL");
  let items = split ? getCatalogExercisesForSplit(split) : EXERCISE_CATALOG;
  if (!q) return items;
  return items.filter((item) => item.name.toLocaleLowerCase("pl-PL").includes(q));
}

export function catalogExerciseCount(): number {
  return EXERCISE_CATALOG.length;
}
