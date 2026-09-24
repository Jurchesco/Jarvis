/**
 * Body profile + weigh-ins (openScale / manual). Own types — not a port of openScale GPL.
 */

export type BodySex = "male" | "female" | "other";

export type BodyMeasurementSource = "manual" | "openscale";

export type BodyProfileFields = {
  heightCm: number | null;
  sex: BodySex | null;
  goalWeightKg: number | null;
  birthYear: number | null;
};

export type BodyMeasurement = {
  id: string;
  userId: string;
  measuredAt: string;
  weightKg: number;
  bodyFatPct: number | null;
  muscleMassKg: number | null;
  waterPct: number | null;
  boneMassKg: number | null;
  bmi: number | null;
  visceralFat: number | null;
  bmr: number | null;
  lbmKg: number | null;
  proteinPct: number | null;
  impedance: number | null;
  comment: string | null;
  source: BodyMeasurementSource;
  createdAt: string;
};

export type CreateBodyMeasurementInput = {
  measuredAt?: string;
  weightKg: number;
  bodyFatPct?: number | null;
  muscleMassKg?: number | null;
  waterPct?: number | null;
  comment?: string | null;
  source?: BodyMeasurementSource;
};

export function computeBmi(weightKg: number, heightCm: number | null | undefined): number | null {
  if (!heightCm || heightCm <= 0 || weightKg <= 0) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function formatBodyWeightKg(kg: number | null | undefined): string {
  if (kg == null || Number.isNaN(kg)) return "—";
  return `${kg % 1 === 0 ? kg.toFixed(0) : kg.toFixed(1)} kg`;
}

export const BODY_SEX_OPTIONS: { value: BodySex; label: string }[] = [
  { value: "male", label: "Mężczyzna" },
  { value: "female", label: "Kobieta" },
  { value: "other", label: "Inna" },
];
