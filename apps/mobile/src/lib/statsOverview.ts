import type { BodyMeasurement } from "@bhmt3wp/shared";
import type { WorkoutSessionWithSheet } from "@bhmt3wp/shared";
import { computeWorkoutStreak } from "@bhmt3wp/shared";
import { fetchBodyProfile, listAllBodyMeasurements } from "./bodyApi";

export type StatsDayAgg = {
  day: string;
  sessions: number;
  minutes: number;
  names: string[];
};

function localDayKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function localDayKey(iso: string): string {
  return localDayKeyFromDate(new Date(iso));
}

/** Monday-based week key (local Monday date) for streak of weeks with ≥1 workout. */
export function weekKeyFromIso(iso: string): string {
  const d = new Date(iso);
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const weekday = day.getDay();
  const fromMonday = weekday === 0 ? 6 : weekday - 1;
  day.setDate(day.getDate() - fromMonday);
  return localDayKeyFromDate(day);
}

export function computeWeekStreak(completedAtList: string[]): number {
  const weeks = new Set(completedAtList.filter(Boolean).map(weekKeyFromIso));
  if (weeks.size === 0) return 0;

  const todayWeek = weekKeyFromIso(new Date().toISOString());
  const prev = new Date();
  prev.setDate(prev.getDate() - 7);
  const prevWeek = weekKeyFromIso(prev.toISOString());

  let anchor: string | null = null;
  if (weeks.has(todayWeek)) anchor = todayWeek;
  else if (weeks.has(prevWeek)) anchor = prevWeek;
  if (!anchor) return 0;

  let streak = 0;
  const [y, m, d] = anchor.split("-").map(Number);
  const cursor = new Date(y, m - 1, d);
  while (weeks.has(localDayKeyFromDate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

export function aggregateSessionsByDay(
  sessions: WorkoutSessionWithSheet[],
): Map<string, StatsDayAgg> {
  const map = new Map<string, StatsDayAgg>();
  for (const s of sessions) {
    if (!s.completedAt) continue;
    const day = localDayKey(s.completedAt);
    const existing = map.get(day) ?? { day, sessions: 0, minutes: 0, names: [] };
    existing.sessions += 1;
    if (s.sheetName) existing.names.push(s.sheetName);
    if (s.startedAt && s.completedAt) {
      const min = Math.max(
        0,
        Math.round((new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()) / 60_000),
      );
      existing.minutes += min;
    }
    map.set(day, existing);
  }
  return map;
}

export function weightDelta30d(measurements: BodyMeasurement[]): number | null {
  const cutoff = Date.now() - 30 * 86_400_000;
  const inRange = measurements.filter((m) => new Date(m.measuredAt).getTime() >= cutoff);
  if (inRange.length < 2) {
    // fallback: oldest and newest among last 30d-or-all if only one in window
    if (measurements.length < 2) return null;
    const sorted = [...measurements].sort(
      (a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime(),
    );
    const recent = sorted.filter((m) => new Date(m.measuredAt).getTime() >= cutoff);
    if (recent.length < 2) return null;
    return Math.round((recent[recent.length - 1].weightKg - recent[0].weightKg) * 10) / 10;
  }
  const sorted = [...inRange].sort(
    (a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime(),
  );
  return Math.round((sorted[sorted.length - 1].weightKg - sorted[0].weightKg) * 10) / 10;
}

/** Color hint: toward goal = good (green), away = amber/red. */
export function weightDeltaTone(
  delta: number | null,
  currentKg: number | null,
  goalKg: number | null,
): "neutral" | "good" | "warn" {
  if (delta == null || delta === 0) return "neutral";
  if (goalKg == null || currentKg == null) {
    return delta < 0 ? "good" : "warn";
  }
  const before = currentKg - delta;
  const distBefore = Math.abs(before - goalKg);
  const distAfter = Math.abs(currentKg - goalKg);
  return distAfter <= distBefore ? "good" : "warn";
}

export type StatsOverview = {
  sessions: WorkoutSessionWithSheet[];
  totalWorkouts: number;
  thisMonth: number;
  dayStreak: number;
  weekStreak: number;
  weightDelta30: number | null;
  weightTone: "neutral" | "good" | "warn";
  latestWeightKg: number | null;
  goalWeightKg: number | null;
  measurements: BodyMeasurement[];
  dayAgg: Map<string, StatsDayAgg>;
};

export async function buildStatsOverview(
  sessions: WorkoutSessionWithSheet[],
): Promise<StatsOverview> {
  const completedIso = sessions.map((s) => s.completedAt).filter((x): x is string => !!x);
  const now = new Date();
  const thisMonth = sessions.filter((s) => {
    if (!s.completedAt) return false;
    const d = new Date(s.completedAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  const [measurements, profile] = await Promise.all([
    listAllBodyMeasurements(),
    fetchBodyProfile().catch(() => null),
  ]);

  const delta = weightDelta30d(measurements);
  const latest = measurements.length
    ? measurements[measurements.length - 1]?.weightKg ??
      [...measurements].sort(
        (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime(),
      )[0]?.weightKg ??
      null
    : null;
  const goal = profile?.goalWeightKg ?? null;

  return {
    sessions,
    totalWorkouts: sessions.length,
    thisMonth,
    dayStreak: computeWorkoutStreak(completedIso).current,
    weekStreak: computeWeekStreak(completedIso),
    weightDelta30: delta,
    weightTone: weightDeltaTone(delta, latest, goal),
    latestWeightKg: latest,
    goalWeightKg: goal,
    measurements,
    dayAgg: aggregateSessionsByDay(sessions),
  };
}
