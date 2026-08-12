import {
  getSupabaseProjectRef,
  supabase,
  supabaseAnonKey,
  supabaseConfigError,
  supabaseUrl,
} from "./supabase";
import { saveSheetSyncResult, type SheetSyncResult } from "./sheetSyncPrefs";

const FUNCTION_NAME = "sync-sheets";
const DEPLOYED_PROJECT_REF = "vggkwwyjobfcokwtfljj";

function projectMismatchMessage(): string | null {
  const ref = getSupabaseProjectRef();
  if (!ref) return "Nieprawidłowy EXPO_PUBLIC_SUPABASE_URL w konfiguracji aplikacji.";
  if (ref !== DEPLOYED_PROJECT_REF) {
    return (
      `Aplikacja łączy się z projektem „${ref}”, a Edge Function sync-sheets jest wdrożona na „${DEPLOYED_PROJECT_REF}”. ` +
      "Ustaw EXPO_PUBLIC_SUPABASE_URL na https://vggkwwyjobfcokwtfljj.supabase.co (lokalnie .env, na Vercel — zmienne środowiskowe) i zrestartuj dev server."
    );
  }
  return null;
}

/** 404 = brak deployu; 200/401/405 = funkcja istnieje */
export async function isSyncFunctionDeployed(): Promise<boolean> {
  const mismatch = projectMismatchMessage();
  if (mismatch) return false;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/${FUNCTION_NAME}`, { method: "OPTIONS" });
    return res.status !== 404;
  } catch {
    return false;
  }
}

export async function syncWorkoutsToGoogleSheets(days = 30): Promise<SheetSyncResult> {
  if (supabaseConfigError) {
    const result: SheetSyncResult = { ok: false, error: supabaseConfigError };
    await saveSheetSyncResult(result);
    return result;
  }

  const mismatch = projectMismatchMessage();
  if (mismatch) {
    const result: SheetSyncResult = { ok: false, error: mismatch };
    await saveSheetSyncResult(result);
    return result;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    const result: SheetSyncResult = {
      ok: false,
      error: "Brak sesji — zaloguj się ponownie.",
    };
    await saveSheetSyncResult(result);
    return result;
  }

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/${FUNCTION_NAME}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: supabaseAnonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ days }),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Błąd sieci przy wywołaniu Edge Function";
    const result: SheetSyncResult = { ok: false, error: message };
    await saveSheetSyncResult(result);
    return result;
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  if (response.status === 404) {
    const result: SheetSyncResult = {
      ok: false,
      error:
        "Edge Function sync-sheets nie istnieje na tym projekcie Supabase (404). Uruchom deploy.ps1",
    };
    await saveSheetSyncResult(result);
    return result;
  }

  if (!response.ok) {
    const serverError =
      typeof payload.error === "string"
        ? payload.error
        : typeof payload.message === "string"
          ? payload.message
          : `HTTP ${response.status}`;
    const result: SheetSyncResult = { ok: false, error: serverError };
    await saveSheetSyncResult(result);
    return result;
  }

  const result: SheetSyncResult = payload.ok
    ? {
        ok: true,
        syncedAt: (payload.syncedAt as string) ?? new Date().toISOString(),
        days: payload.days as number | undefined,
        updated: payload.updated as number | undefined,
        appended: payload.appended as number | undefined,
        seriesInRange: payload.seriesInRange as number | undefined,
        message: payload.message as string | undefined,
      }
    : {
        ok: false,
        error: (payload.error as string) ?? "Synchronizacja nie powiodła się",
      };

  await saveSheetSyncResult(result);
  return result;
}
