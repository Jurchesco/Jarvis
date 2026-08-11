#Requires -Version 5.1
<#
.SYNOPSIS
  Przygotowuje wartości sekretów dla GitHub Actions (hosted runner).
#>
$ErrorActionPreference = "Stop"
$ImportDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$OutDir = Join-Path $env:TEMP "jarvis-github-secrets"
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

Write-Host "=== Jarvis — przygotowanie sekretow GitHub ===" -ForegroundColor Cyan
Write-Host ""

function Read-DotEnvValue([string]$Name) {
    $envFile = Join-Path $ImportDir ".env"
    if (-not (Test-Path $envFile)) { return $null }
    foreach ($line in Get-Content $envFile) {
        if ($line -match "^\s*$Name=(.+)$") {
            return $Matches[1].Trim()
        }
    }
    return $null
}

$sheetId = Read-DotEnvValue "GOOGLE_SHEET_ID"
$supabaseUrl = Read-DotEnvValue "SUPABASE_URL"
$supabaseKey = Read-DotEnvValue "SUPABASE_SECRET_KEY"
$driveFileId = Read-DotEnvValue "OPENSCALE_DRIVE_FILE_ID"

$saPath = Join-Path $ImportDir "google-service-account.json"
if (-not (Test-Path $saPath)) {
    $saPath = Join-Path $ImportDir "..\garmin-sheets\google-service-account.json"
}
if (-not (Test-Path $saPath)) {
    Write-Warning "Nie znaleziono google-service-account.json"
}

Write-Host "Skopiuj do GitHub -> Settings -> Secrets -> Actions:" -ForegroundColor Yellow
Write-Host ""

if ($sheetId) {
    Write-Host "GOOGLE_SHEET_ID"
    Write-Host "  $sheetId"
    Write-Host ""
}

if (Test-Path $saPath) {
    $json = Get-Content $saPath -Raw
    $jsonFile = Join-Path $OutDir "GOOGLE_SERVICE_ACCOUNT_JSON.txt"
    Set-Content -Path $jsonFile -Value $json -NoNewline -Encoding UTF8
    Write-Host "GOOGLE_SERVICE_ACCOUNT_JSON"
    Write-Host "  (pelna zawartosc JSON -> zapisano: $jsonFile)"
    Write-Host ""
}

if ($supabaseUrl) {
    Write-Host "SUPABASE_URL"
    Write-Host "  $supabaseUrl"
    Write-Host ""
}

if ($supabaseKey) {
    Write-Host "SUPABASE_SECRET_KEY"
    Write-Host "  (z .env — wklej recznie, nie wyswietlam pelnej wartosci)"
    Write-Host ""
}

if ($driveFileId) {
    Write-Host "OPENSCALE_DRIVE_FILE_ID"
    Write-Host "  $driveFileId"
} else {
    Write-Host "OPENSCALE_DRIVE_FILE_ID" -ForegroundColor Yellow
    Write-Host "  Ustaw recznie — ID pliku openScale.db_auto_backup.zip na Google Drive"
    Write-Host "  URL: https://drive.google.com/file/d/FILE_ID/view"
}
Write-Host ""

$garminDir = Join-Path $ImportDir ".garminconnect"
if (Test-Path $garminDir) {
    $zipPath = Join-Path $OutDir "garminconnect.zip"
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    Compress-Archive -Path (Join-Path $garminDir "*") -DestinationPath $zipPath -Force
    $bytes = [IO.File]::ReadAllBytes($zipPath)
    $b64 = [Convert]::ToBase64String($bytes)
    $b64File = Join-Path $OutDir "GARMINCONNECT_ZIP.base64.txt"
    Set-Content -Path $b64File -Value $b64 -NoNewline -Encoding ASCII
    Write-Host "GARMINCONNECT_ZIP (opcjonalnie)"
    Write-Host "  Base64 zapisano: $b64File"
    Write-Host "  ($([math]::Round($b64.Length / 1024)) KB tekstu — wklej calosc jako secret)"
} else {
    Write-Host "GARMINCONNECT_ZIP — brak .garminconnect (modul Garmin bedzie wymagal logowania)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Nastepne kroki:" -ForegroundColor Green
Write-Host "  1. Utworz PRYWATNE repo na GitHubie"
Write-Host "  2. git remote add origin https://github.com/TWOJ_USER/Jarvis.git"
Write-Host "  3. git push -u origin main"
Write-Host "  4. Wklej sekrety w Settings -> Secrets -> Actions"
Write-Host "  5. Actions -> Jarvis Import -> Run workflow"
Write-Host ""
Write-Host "Szczegoly: docs\jarvis\GITHUB_ACTIONS.md"
Write-Host "Pliki tymczasowe: $OutDir (usun po uzyciu)" -ForegroundColor DarkGray
