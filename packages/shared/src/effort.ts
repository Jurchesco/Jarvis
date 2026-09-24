/**
 * Opcjonalny wysiłek per seria: RIR (0–10) lub RPE (1–10).
 */

export type EffortScale = "rir" | "rpe";

export type EffortValue = {
  scale: EffortScale;
  value: number;
};

export const EFFORT_SCALE_OPTIONS: { value: EffortScale; label: string; hint: string }[] = [
  { value: "rir", label: "RIR", hint: "Powtórzenia w zapasie (0–10)" },
  { value: "rpe", label: "RPE", hint: "Odczuwany wysiłek (1–10)" },
];

export function clampEffortValue(scale: EffortScale, raw: number): number {
  if (!Number.isFinite(raw)) return scale === "rpe" ? 1 : 0;
  if (scale === "rir") return Math.min(10, Math.max(0, Math.round(raw * 2) / 2));
  return Math.min(10, Math.max(1, Math.round(raw * 2) / 2));
}

export function parseEffortInput(
  scale: EffortScale | null | undefined,
  raw: string | null | undefined,
): EffortValue | null {
  if (!scale) return null;
  const trimmed = (raw ?? "").trim().replace(",", ".");
  if (!trimmed) return null;
  const num = parseFloat(trimmed);
  if (!Number.isFinite(num)) return null;
  return { scale, value: clampEffortValue(scale, num) };
}

export function formatEffortLabel(effort: EffortValue | null | undefined): string {
  if (!effort) return "";
  const v =
    Number.isInteger(effort.value) ? String(effort.value) : effort.value.toFixed(1);
  return effort.scale === "rir" ? `RIR ${v}` : `RPE ${v}`;
}

export function effortFromLogFields(
  scale: string | null | undefined,
  value: number | null | undefined,
): EffortValue | null {
  if (scale !== "rir" && scale !== "rpe") return null;
  if (value == null || !Number.isFinite(value)) return null;
  return { scale, value: clampEffortValue(scale, value) };
}
