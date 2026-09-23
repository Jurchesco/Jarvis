/**
 * Full exercise library (1 324) from hasaneyldrm/exercises-dataset (MIT data).
 * Media (thumb/GIF) is © Gym visual — loaded from CDN, not bundled (see NOTICE).
 */

import raw from "./exercisesLibrary.data.json";
import type { MuscleGroup, MuscleTags } from "./muscleGroups";

/** Pinned dataset commit used by OpenGym mobile CDN builds. */
export const EXERCISE_MEDIA_COMMIT =
  "7455efae41b330c265e7cd4b78dfa848e7ce5ebd";

const MEDIA_ROOT = `https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@${EXERCISE_MEDIA_COMMIT}`;

export const EXERCISE_IMG_BASE = `${MEDIA_ROOT}/images/`;
export const EXERCISE_GIF_BASE = `${MEDIA_ROOT}/videos/`;

export const GYM_VISUAL_ATTRIBUTION = "© Gym visual — https://gymvisual.com/";

export type LibraryBodyPart =
  | "back"
  | "cardio"
  | "chest"
  | "lower arms"
  | "lower legs"
  | "neck"
  | "shoulders"
  | "upper arms"
  | "upper legs"
  | "waist";

export type LibraryExercise = {
  id: string;
  /** Canonical English name from the dataset (stable id companion). */
  name: string;
  /** Polish display / log name. */
  namePl: string;
  bodyPart: LibraryBodyPart;
  equipment: string;
  target: string;
  secondaryMuscles: string[];
  imageFile: string;
  gifFile: string;
  /** Polish instructions (fallback EN in generator). */
  instructionsPl: string;
};

type RawRow = {
  id: string;
  n: string;
  nPl?: string;
  bp: string;
  eq: string;
  tg: string;
  sm: string[];
  img: string;
  gif: string;
  pl: string;
};

const ROWS = raw as RawRow[];

export const EXERCISE_LIBRARY: LibraryExercise[] = ROWS.map((r) => ({
  id: r.id,
  name: r.n,
  namePl: (r.nPl && r.nPl.trim()) || r.n,
  bodyPart: r.bp as LibraryBodyPart,
  equipment: r.eq,
  target: r.tg,
  secondaryMuscles: r.sm ?? [],
  imageFile: r.img,
  gifFile: r.gif,
  instructionsPl: r.pl ?? "",
}));

const BY_ID = new Map(EXERCISE_LIBRARY.map((e) => [e.id, e]));
const BY_NAME = new Map<string, LibraryExercise>();
for (const e of EXERCISE_LIBRARY) {
  BY_NAME.set(normalizeLibraryName(e.name), e);
  BY_NAME.set(normalizeLibraryName(e.namePl), e);
}

export const LIBRARY_BODY_PARTS: LibraryBodyPart[] = [
  ...new Set(EXERCISE_LIBRARY.map((e) => e.bodyPart)),
].sort() as LibraryBodyPart[];

export const LIBRARY_BODY_PART_LABELS: Record<LibraryBodyPart, string> = {
  back: "Plecy",
  cardio: "Cardio",
  chest: "Klatka",
  "lower arms": "Przedramiona",
  "lower legs": "Łydki",
  neck: "Kark",
  shoulders: "Barki",
  "upper arms": "Ramiona",
  "upper legs": "Nogi",
  waist: "Brzuch",
};

export function normalizeLibraryName(name: string): string {
  return name.trim().toLocaleLowerCase("pl-PL");
}

/** Preferred label in the PL UI. */
export function libraryDisplayName(ex: LibraryExercise): string {
  return ex.namePl || ex.name;
}

export function libraryExerciseCount(): number {
  return EXERCISE_LIBRARY.length;
}

export function getLibraryExerciseById(id: string): LibraryExercise | undefined {
  return BY_ID.get(id);
}

export function getLibraryExerciseByName(name: string): LibraryExercise | undefined {
  return BY_NAME.get(normalizeLibraryName(name));
}

export function libraryThumbUrl(ex: LibraryExercise): string {
  return `${EXERCISE_IMG_BASE}${ex.imageFile}`;
}

export function libraryGifUrl(ex: LibraryExercise): string {
  return `${EXERCISE_GIF_BASE}${ex.gifFile}`;
}

/** Map dataset target / secondary labels → Jarvis MuscleGroup. */
const TARGET_TO_MUSCLE: Record<string, MuscleGroup | null> = {
  pectorals: "chest",
  delts: "shoulders",
  triceps: "triceps",
  lats: "back",
  "upper back": "back",
  traps: "back",
  spine: "back",
  biceps: "biceps",
  quads: "quads",
  hamstrings: "hamstrings",
  glutes: "glutes",
  calves: "calves",
  abs: "core",
  "serratus anterior": "core",
  abductors: "glutes",
  adductors: "quads",
  forearms: null,
  "cardiovascular system": null,
  "levator scapulae": "shoulders",
};

export function mapTargetToMuscle(target: string): MuscleGroup | null {
  return TARGET_TO_MUSCLE[target.trim().toLowerCase()] ?? null;
}

export function muscleTagsFromLibraryExercise(ex: LibraryExercise): MuscleTags | null {
  const primary = mapTargetToMuscle(ex.target);
  if (!primary) return null;
  let secondary: MuscleGroup | undefined;
  for (const sm of ex.secondaryMuscles) {
    const m = mapTargetToMuscle(sm);
    if (m && m !== primary) {
      secondary = m;
      break;
    }
  }
  return secondary ? { primary, secondary } : { primary };
}

export function isLibraryTimeBased(ex: LibraryExercise): boolean {
  if (ex.bodyPart === "cardio") return true;
  const n = ex.name.toLowerCase();
  return /\bplank\b|\bhold\b|\bisometric\b/.test(n);
}

export function equipmentOf(list: LibraryExercise[]): string[] {
  const counts: Record<string, number> = {};
  for (const e of list) {
    if (!e.equipment) continue;
    counts[e.equipment] = (counts[e.equipment] || 0) + 1;
  }
  return Object.keys(counts).sort(
    (a, b) => counts[b] - counts[a] || a.localeCompare(b),
  );
}

export type LibrarySearchOpts = {
  query?: string;
  bodyPart?: LibraryBodyPart | null;
  equipment?: string | null;
  /** Cap results for picker performance (library screen paginates separately). */
  limit?: number;
};

export function searchLibraryExercises(opts: LibrarySearchOpts = {}): LibraryExercise[] {
  const q = (opts.query ?? "").trim().toLowerCase();
  let items = EXERCISE_LIBRARY;
  if (opts.bodyPart) {
    items = items.filter((e) => e.bodyPart === opts.bodyPart);
  }
  if (opts.equipment) {
    items = items.filter((e) => e.equipment === opts.equipment);
  }
  if (q) {
    items = items.filter(
      (e) =>
        e.namePl.toLocaleLowerCase("pl-PL").includes(q) ||
        e.name.toLowerCase().includes(q) ||
        e.target.toLowerCase().includes(q) ||
        e.equipment.toLowerCase().includes(q) ||
        e.bodyPart.toLowerCase().includes(q) ||
        e.instructionsPl.toLocaleLowerCase("pl-PL").includes(q),
    );
  }
  if (opts.limit != null && opts.limit > 0) {
    return items.slice(0, opts.limit);
  }
  return items;
}
