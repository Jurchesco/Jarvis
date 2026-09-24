import { formatBodyWeightKg } from "@bhmt3wp/shared";
import { supabase } from "./supabase";

export type ReadinessMetric = {
  key: "sleep" | "hrv" | "battery" | "weight";
  label: string;
  value: string;
  /** Softer secondary line, e.g. qualifier or date */
  detail?: string | null;
};

export type ReadinessToday = {
  day: string;
  metrics: ReadinessMetric[];
  /** One short line — not a full coach briefing */
  hint: string | null;
  empty: boolean;
};

function localDayString(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function softSingle(
  table: string,
  build: () => PromiseLike<{
    data: Record<string, unknown> | null;
    error: { message: string } | null;
  }>,
): Promise<Record<string, unknown> | null> {
  return Promise.resolve(build())
    .then(({ data, error }) => {
      if (error) {
        if (/relation|does not exist|column/i.test(error.message)) return null;
        return null;
      }
      return data;
    })
    .catch(() => null);
}

function formatHrvStatus(status: string | null | undefined): string {
  if (!status) return "—";
  const key = status.toUpperCase();
  const map: Record<string, string> = {
    BALANCED: "OK",
    EXCELLENT: "Super",
    GOOD: "Dobry",
    FAIR: "Średni",
    POOR: "Słaby",
    LOW: "Niski",
    UNBALANCED: "Niestabilny",
  };
  return map[key] ?? status;
}

function buildHint(input: {
  sleepScore: number | null;
  hrvStatus: string | null;
  bodyBattery: number | null;
}): string | null {
  const { sleepScore, hrvStatus, bodyBattery } = input;
  if (sleepScore == null && !hrvStatus && bodyBattery == null) return null;

  const status = (hrvStatus ?? "").toUpperCase();
  const rough =
    (sleepScore != null && sleepScore < 60) ||
    status === "POOR" ||
    status === "LOW" ||
    status === "UNBALANCED" ||
    (bodyBattery != null && bodyBattery < 30);

  const solid =
    (sleepScore == null || sleepScore >= 75) &&
    (status === "" || status === "BALANCED" || status === "EXCELLENT" || status === "GOOD") &&
    (bodyBattery == null || bodyBattery >= 50);

  if (rough) return "Sygnały regeneracji słabsze — rozważ lżejszy bodziec.";
  if (solid) return "Regeneracja wygląda OK — możesz iść normalnie.";
  return "Średnia gotowość — trenuj, ale słuchaj ciała.";
}

/** Loads a compact readiness snapshot for Home (Garmin + latest weigh-in). */
export async function fetchReadinessToday(): Promise<ReadinessToday> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { day: localDayString(), metrics: [], hint: null, empty: true };
  }

  const day = localDayString();

  const [sleep, forma, weight] = await Promise.all([
    softSingle("garmin_sleep_days", () =>
      supabase
        .from("garmin_sleep_days")
        .select("day, sleep_score, sleep_qualifier, sleep_minutes, has_data, hrv_last_night_avg")
        .eq("user_id", user.id)
        .eq("day", day)
        .maybeSingle(),
    ),
    softSingle("garmin_forma_days", () =>
      supabase
        .from("garmin_forma_days")
        .select("day, hrv_status, hrv_last_night_avg, body_battery_wake, resting_heart_rate")
        .eq("user_id", user.id)
        .eq("day", day)
        .maybeSingle(),
    ),
    softSingle("body_measurements", () =>
      supabase
        .from("body_measurements")
        .select("measured_at, weight_kg")
        .eq("user_id", user.id)
        .order("measured_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ),
  ]);

  // If today missing, fall back to latest sleep/forma row (still useful after late import)
  let sleepRow = sleep;
  let formaRow = forma;
  if (!sleepRow) {
    sleepRow = await softSingle("garmin_sleep_days", () =>
      supabase
        .from("garmin_sleep_days")
        .select("day, sleep_score, sleep_qualifier, sleep_minutes, has_data, hrv_last_night_avg")
        .eq("user_id", user.id)
        .order("day", { ascending: false })
        .limit(1)
        .maybeSingle(),
    );
  }
  if (!formaRow) {
    formaRow = await softSingle("garmin_forma_days", () =>
      supabase
        .from("garmin_forma_days")
        .select("day, hrv_status, hrv_last_night_avg, body_battery_wake, resting_heart_rate")
        .eq("user_id", user.id)
        .order("day", { ascending: false })
        .limit(1)
        .maybeSingle(),
    );
  }

  const sleepScore =
    sleepRow?.has_data === false
      ? null
      : sleepRow?.sleep_score != null
        ? Number(sleepRow.sleep_score)
        : null;
  const sleepDay = sleepRow?.day != null ? String(sleepRow.day) : null;
  const hrvStatus = formaRow?.hrv_status != null ? String(formaRow.hrv_status) : null;
  const bodyBattery =
    formaRow?.body_battery_wake != null ? Number(formaRow.body_battery_wake) : null;
  const weightKg = weight?.weight_kg != null ? Number(weight.weight_kg) : null;

  const metrics: ReadinessMetric[] = [
    {
      key: "sleep",
      label: "Sen",
      value: sleepScore != null ? String(Math.round(sleepScore)) : "—",
      detail:
        sleepScore != null
          ? sleepRow?.sleep_qualifier
            ? String(sleepRow.sleep_qualifier)
            : sleepDay && sleepDay !== day
              ? sleepDay
              : null
          : sleepRow?.has_data === false
            ? "brak danych"
            : null,
    },
    {
      key: "hrv",
      label: "HRV",
      value: formatHrvStatus(hrvStatus),
      detail:
        formaRow?.hrv_last_night_avg != null
          ? `${Math.round(Number(formaRow.hrv_last_night_avg))} ms`
          : null,
    },
    {
      key: "battery",
      label: "BB",
      value: bodyBattery != null ? String(Math.round(bodyBattery)) : "—",
      detail: bodyBattery != null ? "rano" : null,
    },
    {
      key: "weight",
      label: "Waga",
      value: weightKg != null ? formatBodyWeightKg(weightKg).replace(" kg", "") : "—",
      detail: weightKg != null ? "kg" : null,
    },
  ];

  const hasAny =
    sleepScore != null || hrvStatus != null || bodyBattery != null || weightKg != null;

  return {
    day,
    metrics,
    hint: hasAny ? buildHint({ sleepScore, hrvStatus, bodyBattery }) : null,
    empty: !hasAny,
  };
}
