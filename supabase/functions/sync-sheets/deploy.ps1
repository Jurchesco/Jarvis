# Deploy sync-sheets (Windows PowerShell)
# Wymaga: zalogowanego `npx supabase login` oraz service account JSON w Scripts/import/

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
Set-Location $Root

$ProjectRef = "vggkwwyjobfcokwtfljj"
$EnvFile = Join-Path $Root "Scripts\import\.env"
$SaFile = Join-Path $Root "Scripts\import\google-service-account.json"

if (-not (Test-Path $SaFile)) {
  Write-Error "Brak pliku: $SaFile"
}

$SheetId = $null
Get-Content $EnvFile | ForEach-Object {
  if ($_ -match '^\s*GOOGLE_SHEET_ID=(.+)$') { $SheetId = $matches[1].Trim() }
}
if (-not $SheetId) { Write-Error "Brak GOOGLE_SHEET_ID w $EnvFile" }

# Base64 — PowerShell psuje wieloliniowy JSON przy `secrets set`
$SaBytes = [System.IO.File]::ReadAllBytes($SaFile)
$SaB64 = [Convert]::ToBase64String($SaBytes)

Write-Host "Link do projektu $ProjectRef ..."
npx supabase link --project-ref $ProjectRef

Write-Host "Ustawianie sekretow (JSON jako Base64)..."
npx supabase secrets set "GOOGLE_SHEET_ID=$SheetId"
npx supabase secrets set "GOOGLE_SERVICE_ACCOUNT_JSON_B64=$SaB64"
npx supabase secrets set "SYNC_DEFAULT_DAYS=30"

# Usun stary, uszkodzony sekret (opcjonalnie — ignoruj blad jesli nie istnieje)
npx supabase secrets unset GOOGLE_SERVICE_ACCOUNT_JSON 2>$null

Write-Host @"

UWAGA: Ustaw recznie JJ_WORKOUT_ALLOWED_USER_ID (UUID z Ustawien -> Konto w apce):
  npx supabase secrets set JJ_WORKOUT_ALLOWED_USER_ID=twoj-uuid

"@

Write-Host "Deploy funkcji sync-sheets..."
npx supabase functions deploy sync-sheets

Write-Host "Gotowe. Odswiez apke i sprobuj Synchronizuj teraz."
