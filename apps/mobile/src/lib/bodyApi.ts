import type {
  BodyMeasurement,
  BodySex,
  CreateBodyMeasurementInput,
} from "@bhmt3wp/shared";
import { computeBmi } from "@bhmt3wp/shared";
import { supabase } from "./supabase";

async function requireUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

type ProfileRow = {
  id: string;
  role: "coach" | "allievo";
  display_name: string | null;
  height_cm: number | null;
  sex: BodySex | null;
  goal_weight_kg: number | null;
  birth_year: number | null;
};

export type BodyProfile = {
  id: string;
  role: "coach" | "allievo";
  displayName: string | null;
  heightCm: number | null;
  sex: BodySex | null;
  goalWeightKg: number | null;
  birthYear: number | null;
};

function mapProfile(row: ProfileRow): BodyProfile {
  return {
    id: row.id,
    role: row.role,
    displayName: row.display_name,
    heightCm: row.height_cm,
    sex: row.sex,
    goalWeightKg: row.goal_weight_kg,
    birthYear: row.birth_year,
  };
}

type MeasurementRow = {
  id: string;
  user_id: string;
  measured_at: string;
  weight_kg: number;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  water_pct: number | null;
  bone_mass_kg: number | null;
  bmi: number | null;
  visceral_fat: number | null;
  bmr: number | null;
  lbm_kg: number | null;
  protein_pct: number | null;
  impedance: number | null;
  comment: string | null;
  source: "manual" | "openscale";
  created_at: string;
};

function mapMeasurement(row: MeasurementRow): BodyMeasurement {
  return {
    id: row.id,
    userId: row.user_id,
    measuredAt: row.measured_at,
    weightKg: row.weight_kg,
    bodyFatPct: row.body_fat_pct,
    muscleMassKg: row.muscle_mass_kg,
    waterPct: row.water_pct,
    boneMassKg: row.bone_mass_kg,
    bmi: row.bmi,
    visceralFat: row.visceral_fat,
    bmr: row.bmr,
    lbmKg: row.lbm_kg,
    proteinPct: row.protein_pct,
    impedance: row.impedance,
    comment: row.comment,
    source: row.source,
    createdAt: row.created_at,
  };
}

export async function fetchBodyProfile(): Promise<BodyProfile | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, display_name, height_cm, sex, goal_weight_kg, birth_year")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapProfile(data as ProfileRow);
}

export async function updateBodyProfile(fields: {
  displayName?: string | null;
  heightCm?: number | null;
  sex?: BodySex | null;
  goalWeightKg?: number | null;
  birthYear?: number | null;
}): Promise<BodyProfile> {
  const userId = await requireUserId();
  const patch: Record<string, unknown> = {};
  if (fields.displayName !== undefined) patch.display_name = fields.displayName;
  if (fields.heightCm !== undefined) patch.height_cm = fields.heightCm;
  if (fields.sex !== undefined) patch.sex = fields.sex;
  if (fields.goalWeightKg !== undefined) patch.goal_weight_kg = fields.goalWeightKg;
  if (fields.birthYear !== undefined) patch.birth_year = fields.birthYear;

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select("id, role, display_name, height_cm, sex, goal_weight_kg, birth_year")
    .single();
  if (error) throw new Error(error.message);
  return mapProfile(data as ProfileRow);
}

export async function listBodyMeasurements(limit = 30): Promise<BodyMeasurement[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("body_measurements")
    .select("*")
    .eq("user_id", userId)
    .order("measured_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as MeasurementRow[] | null)?.map(mapMeasurement) ?? [];
}

/** All weigh-ins for charts (paginated). Soft-empty when table missing. */
export async function listAllBodyMeasurements(): Promise<BodyMeasurement[]> {
  const userId = await requireUserId();
  const PAGE = 1000;
  const rows: BodyMeasurement[] = [];
  let offset = 0;
  try {
    while (true) {
      const { data, error } = await supabase
        .from("body_measurements")
        .select("*")
        .eq("user_id", userId)
        .order("measured_at", { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (error) {
        if (/relation|does not exist|column/i.test(error.message)) return [];
        throw new Error(error.message);
      }
      const batch = (data as MeasurementRow[] | null)?.map(mapMeasurement) ?? [];
      rows.push(...batch);
      if (batch.length < PAGE) break;
      offset += PAGE;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (/relation|does not exist|column/i.test(msg)) return [];
    throw error;
  }
  return rows;
}

export async function createBodyMeasurement(
  input: CreateBodyMeasurementInput,
  heightCm?: number | null,
): Promise<BodyMeasurement> {
  const userId = await requireUserId();
  const measuredAt = input.measuredAt ?? new Date().toISOString();
  const bmi = computeBmi(input.weightKg, heightCm ?? null);
  const { data, error } = await supabase
    .from("body_measurements")
    .insert({
      user_id: userId,
      measured_at: measuredAt,
      weight_kg: input.weightKg,
      body_fat_pct: input.bodyFatPct ?? null,
      muscle_mass_kg: input.muscleMassKg ?? null,
      water_pct: input.waterPct ?? null,
      bmi,
      comment: input.comment ?? null,
      source: input.source ?? "manual",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapMeasurement(data as MeasurementRow);
}

export async function deleteBodyMeasurement(id: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("body_measurements")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}
