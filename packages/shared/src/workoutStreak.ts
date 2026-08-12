function dayKeyFromIso(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  return dayKeyFromIso(date.toISOString());
}

function dayDiffEarlierToLater(earlier: string, later: string): number {
  const [ya, ma, da] = earlier.split("-").map(Number);
  const [yb, mb, db] = later.split("-").map(Number);
  const t1 = new Date(ya, ma - 1, da).getTime();
  const t2 = new Date(yb, mb - 1, db).getTime();
  return Math.round((t2 - t1) / 86_400_000);
}

function longestConsecutiveRun(sortedDayKeys: string[]): number {
  if (sortedDayKeys.length === 0) return 0;
  if (sortedDayKeys.length === 1) return 1;

  let best = 1;
  let run = 1;
  for (let i = 1; i < sortedDayKeys.length; i++) {
    if (dayDiffEarlierToLater(sortedDayKeys[i - 1], sortedDayKeys[i]) === 1) {
      run++;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }
  return best;
}

/** Unikalne dni treningowe → aktualna seria (dziś/wczoraj) i najdłuższa seria ever. */
export function computeWorkoutStreak(completedAtList: string[]): {
  current: number;
  longest: number;
} {
  const daySet = new Set(
    completedAtList.filter(Boolean).map(dayKeyFromIso),
  );
  if (daySet.size === 0) return { current: 0, longest: 0 };

  const sorted = [...daySet].sort();
  const longest = longestConsecutiveRun(sorted);

  const today = dayKeyFromIso(new Date().toISOString());
  const yesterday = addDays(today, -1);
  let anchor: string | null = null;
  if (daySet.has(today)) anchor = today;
  else if (daySet.has(yesterday)) anchor = yesterday;

  let current = 0;
  if (anchor) {
    current = 1;
    let cursor = addDays(anchor, -1);
    while (daySet.has(cursor)) {
      current++;
      cursor = addDays(cursor, -1);
    }
  }

  return { current, longest };
}

/** Najdłuższa seria dni z treningiem w danym miesiącu kalendarzowym. */
export function computeMonthBestStreak(
  completedAtList: string[],
  year: number,
  month: number,
): number {
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
  const monthDays = [
    ...new Set(completedAtList.filter(Boolean).map(dayKeyFromIso)),
  ]
    .filter((key) => key.startsWith(prefix))
    .sort();

  return longestConsecutiveRun(monthDays);
}
