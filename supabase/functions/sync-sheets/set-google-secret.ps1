# Tylko naprawa sekretu Google (bez pelnego redeploy) — gdy JSON byl uszkodzony przez PowerShell
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
Set-Location $Root

$SaFile = Join-Path $Root "Scripts\import\google-service-account.json"
if (-not (Test-Path $SaFile)) { Write-Error "Brak: $SaFile" }

$SaBytes = [System.IO.File]::ReadAllBytes($SaFile)
$SaB64 = [Convert]::ToBase64String($SaBytes)

Write-Host "Ustawiam GOOGLE_SERVICE_ACCOUNT_JSON_B64..."
npx supabase secrets set "GOOGLE_SERVICE_ACCOUNT_JSON_B64=$SaB64"
npx supabase secrets unset GOOGLE_SERVICE_ACCOUNT_JSON 2>$null
Write-Host "Gotowe. Sprobuj Synchronizuj teraz w apce (bez redeploy funkcji)."
