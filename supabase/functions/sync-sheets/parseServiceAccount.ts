import type { ServiceAccount } from "./googleAuth.ts";

function decodeBase64Utf8(b64: string): string {
  const binary = atob(b64.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/** Czyta GOOGLE_SERVICE_ACCOUNT_JSON lub GOOGLE_SERVICE_ACCOUNT_JSON_B64 (zalecane na Windows). */
export function loadServiceAccountFromEnv(): ServiceAccount {
  const b64 = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON_B64")?.trim();
  if (b64) {
    try {
      return JSON.parse(decodeBase64Utf8(b64)) as ServiceAccount;
    } catch {
      throw new Error(
        "GOOGLE_SERVICE_ACCOUNT_JSON_B64 ma nieprawidłowy format — uruchom ponownie deploy.ps1",
      );
    }
  }

  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")?.trim();
  if (!raw) {
    throw new Error(
      "Brak GOOGLE_SERVICE_ACCOUNT_JSON — ustaw sekrety Edge Function (deploy.ps1)",
    );
  }

  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON ma nieprawidłowy format — uruchom ponownie deploy.ps1 (używa Base64)",
    );
  }
}
