import { getPref, setPref } from "./prefStorage";

const KEY = "pref_week_plan_slots_v1";

/** Poniedziałek = 0 … Niedziela = 6 */
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** `sheetId` albo `null` = odpoczynek / nieustawione */
export type WeekSlots = [
  string | null,
  string | null,
  string | null,
  string | null,
  string | null,
  string | null,
  string | null,
];

export const WEEKDAY_SHORT: Record<WeekdayIndex, string> = {
  0: "Pn",
  1: "Wt",
  2: "Śr",
  3: "Cz",
  4: "Pt",
  5: "So",
  6: "Nd",
};

export const WEEKDAY_LONG: Record<WeekdayIndex, string> = {
  0: "Poniedziałek",
  1: "Wtorek",
  2: "Środa",
  3: "Czwartek",
  4: "Piątek",
  5: "Sobota",
  6: "Niedziela",
};

export const EMPTY_WEEK_SLOTS: WeekSlots = [null, null, null, null, null, null, null];

export function todayWeekIndex(date: Date = new Date()): WeekdayIndex {
  const day = date.getDay(); // 0 = niedziela
  return (day === 0 ? 6 : day - 1) as WeekdayIndex;
}

function normalizeSlots(raw: unknown): WeekSlots {
  if (!Array.isArray(raw) || raw.length !== 7) return [...EMPTY_WEEK_SLOTS] as WeekSlots;
  return raw.map((item) => (typeof item === "string" && item.length > 0 ? item : null)) as WeekSlots;
}

export async function getWeekSlots(): Promise<WeekSlots> {
  const raw = await getPref(KEY);
  if (!raw) return [...EMPTY_WEEK_SLOTS] as WeekSlots;
  try {
    return normalizeSlots(JSON.parse(raw));
  } catch {
    return [...EMPTY_WEEK_SLOTS] as WeekSlots;
  }
}

export async function setWeekSlots(slots: WeekSlots): Promise<void> {
  await setPref(KEY, JSON.stringify(normalizeSlots(slots)));
}

export async function setWeekSlot(day: WeekdayIndex, sheetId: string | null): Promise<WeekSlots> {
  const current = await getWeekSlots();
  const next = [...current] as WeekSlots;
  next[day] = sheetId;
  await setWeekSlots(next);
  return next;
}

/** Usuwa sloty wskazujące na nieistniejące plany. */
export function pruneWeekSlots(slots: WeekSlots, validSheetIds: Set<string>): WeekSlots {
  return slots.map((id) => (id && validSheetIds.has(id) ? id : null)) as WeekSlots;
}

export function weekHasAnyPlan(slots: WeekSlots): boolean {
  return slots.some((id) => !!id);
}
