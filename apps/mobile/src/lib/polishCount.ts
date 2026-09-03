/** Polish pluralization: 1 / 2–4 / 5+ (with teen exceptions 12–14). */
export function polishPlural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return `1 ${one}`;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${n} ${few}`;
  }
  return `${n} ${many}`;
}

export function formatExerciseCount(n: number): string {
  return polishPlural(n, "ćwiczenie", "ćwiczenia", "ćwiczeń");
}

export function formatSetCount(n: number): string {
  return polishPlural(n, "seria", "serie", "serii");
}
