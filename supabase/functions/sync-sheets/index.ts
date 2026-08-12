import { createClient } from "npm:@supabase/supabase-js@2";
import { runWorkoutImport } from "./importWorkout.ts";
import { loadServiceAccountFromEnv } from "./parseServiceAccount.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const sheetId = Deno.env.get("GOOGLE_SHEET_ID");
    const hasGoogleSecret =
      !!Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON_B64")?.trim() ||
      !!Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")?.trim();
    const allowedUserId =
      Deno.env.get("JJ_WORKOUT_ALLOWED_USER_ID") ??
      Deno.env.get("STRAVIO_ALLOWED_USER_ID");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse({ error: "Brak konfiguracji Supabase po stronie serwera" }, 500);
    }
    if (!sheetId || !hasGoogleSecret) {
      return jsonResponse(
        {
          error:
            "Brak GOOGLE_SHEET_ID lub GOOGLE_SERVICE_ACCOUNT_JSON_B64 — uruchom deploy.ps1",
        },
        500,
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Brak autoryzacji — zaloguj się w aplikacji" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Nieprawidłowa sesja — zaloguj się ponownie" }, 401);
    }

    if (allowedUserId && user.id !== allowedUserId) {
      return jsonResponse(
        { error: "Synchronizacja jest skonfigurowana tylko dla konta właściciela (testy osobiste)." },
        403,
      );
    }

    let body: { days?: number } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const defaultDays = parseInt(Deno.env.get("SYNC_DEFAULT_DAYS") ?? "30", 10);
    const days = typeof body.days === "number" && body.days >= 1 && body.days <= 365
      ? Math.floor(body.days)
      : defaultDays;

    let serviceAccount;
    try {
      serviceAccount = loadServiceAccountFromEnv();
    } catch (parseErr) {
      const message = parseErr instanceof Error ? parseErr.message : "Nieprawidłowy service account JSON";
      return jsonResponse({ error: message }, 500);
    }

    const stats = await runWorkoutImport({
      supabaseUrl,
      serviceRoleKey,
      spreadsheetId: sheetId,
      serviceAccount,
      userId: user.id,
      days,
    });

    return jsonResponse({
      ok: true,
      syncedAt: new Date().toISOString(),
      days,
      spreadsheetId: sheetId,
      worksheet: "Silownia_import",
      ...stats,
      message: `Zaktualizowano ${stats.updated}, dopisano ${stats.appended} wierszy (${stats.exerciseRows} ćwiczeń, ${days} dni wstecz).`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Nieznany błąd synchronizacji";
    console.error("[sync-sheets]", message);
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
