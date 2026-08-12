import { getPref, setPref } from "./prefStorage";

const LAST_SYNC_AT = "sheet_sync_last_at";
const LAST_SYNC_RESULT = "sheet_sync_last_result";

export type SheetSyncResult = {
  ok: boolean;
  syncedAt?: string;
  days?: number;
  updated?: number;
  appended?: number;
  seriesInRange?: number;
  message?: string;
  error?: string;
};

export async function getLastSheetSyncAt(): Promise<string | null> {
  return getPref(LAST_SYNC_AT);
}

export async function getLastSheetSyncResult(): Promise<SheetSyncResult | null> {
  const raw = await getPref(LAST_SYNC_RESULT);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SheetSyncResult;
  } catch {
    return null;
  }
}

export async function saveSheetSyncResult(result: SheetSyncResult): Promise<void> {
  if (result.syncedAt) {
    await setPref(LAST_SYNC_AT, result.syncedAt);
  } else if (result.ok) {
    await setPref(LAST_SYNC_AT, new Date().toISOString());
  }
  await setPref(LAST_SYNC_RESULT, JSON.stringify(result));
}

export function formatRelativeSyncTime(iso: string | null): string {
  if (!iso) return "Nigdy";
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60) return "Przed chwilą";
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60);
    return `${m} min temu`;
  }
  if (diffSec < 86_400) {
    const h = Math.floor(diffSec / 3600);
    return `${h} godz. temu`;
  }
  const d = Math.floor(diffSec / 86_400);
  return `${d} ${d === 1 ? "dzień" : "dni"} temu`;
}
