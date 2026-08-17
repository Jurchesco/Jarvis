/** Local calendar day key (YYYY-MM-DD) from an ISO timestamp. */
export function sessionDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timeHm(d: Date): string {
  return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

/** Short line for history list: date + start–end time. */
export function formatSessionWhenShort(startedAt: string, completedAt: string | null): string {
  const start = new Date(startedAt);
  const datePart = start.toLocaleDateString("pl-PL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const startTime = timeHm(start);
  if (!completedAt) return `${datePart} · start ${startTime}`;

  const end = new Date(completedAt);
  const endTime = timeHm(end);
  if (start.toDateString() === end.toDateString()) {
    return `${datePart} · ${startTime}–${endTime}`;
  }
  const endDate = end.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
  return `${datePart} ${startTime} → ${endDate} ${endTime}`;
}

export function formatSessionStartLong(startedAt: string): string {
  return new Date(startedAt).toLocaleString("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatSessionEndLong(completedAt: string): string {
  return new Date(completedAt).toLocaleString("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}
