/**
 * Allowlisted AI context export (CSV / JSON) — never dump the whole DB.
 * Inspired by OpenGym coach consent pattern; own implementation.
 */

export const AI_CONTEXT_ALLOWLIST = [
  "profile",
  "bodyweight",
  "training",
  "sleep",
  "daily",
  "forma",
  "activities",
] as const;

export type AiContextAllowlistKey = (typeof AI_CONTEXT_ALLOWLIST)[number];

export type AiContextOptions = {
  /** Inclusive window in days ending today (local). */
  days: number;
  include: AiContextAllowlistKey[];
};

export type AiContextBundle = {
  exportedAt: string;
  days: number;
  include: AiContextAllowlistKey[];
  profile?: Record<string, unknown> | null;
  bodyMeasurements?: Record<string, unknown>[];
  sessions?: Record<string, unknown>[];
  sleep?: Record<string, unknown>[];
  daily?: Record<string, unknown>[];
  forma?: Record<string, unknown>[];
  activities?: Record<string, unknown>[];
};

function escapeCsvCell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsvCell(row[h])).join(","));
  }
  return lines.join("\n");
}

/** Multi-section CSV suitable for pasting into an AI chat. */
export function buildAiContextCsv(bundle: AiContextBundle): string {
  const parts: string[] = [
    `# Jarvis AI context`,
    `# exportedAt=${bundle.exportedAt}`,
    `# days=${bundle.days}`,
    `# include=${bundle.include.join("|")}`,
    "",
  ];

  if (bundle.profile && bundle.include.includes("profile")) {
    parts.push("## profile");
    parts.push(rowsToCsv(Object.keys(bundle.profile), [bundle.profile]));
    parts.push("");
  }

  const sections: {
    key: AiContextAllowlistKey;
    title: string;
    rows?: Record<string, unknown>[];
  }[] = [
    { key: "bodyweight", title: "body_measurements", rows: bundle.bodyMeasurements },
    { key: "training", title: "sessions", rows: bundle.sessions },
    { key: "sleep", title: "sleep", rows: bundle.sleep },
    { key: "daily", title: "daily", rows: bundle.daily },
    { key: "forma", title: "forma", rows: bundle.forma },
    { key: "activities", title: "activities", rows: bundle.activities },
  ];

  for (const section of sections) {
    if (!bundle.include.includes(section.key) || !section.rows?.length) continue;
    const headers = Object.keys(section.rows[0]!);
    parts.push(`## ${section.title}`);
    parts.push(rowsToCsv(headers, section.rows));
    parts.push("");
  }

  return parts.join("\n");
}

export function buildAiContextJson(bundle: AiContextBundle): string {
  return JSON.stringify(bundle, null, 2);
}
