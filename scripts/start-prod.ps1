param(
    [switch]$Rebuild,
    [int]$Port = 3000
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

if (-not (Test-Path ".env.local")) {
    Write-Warning "Aucun fichier .env.local détecté : /admin et /configure seront ouverts sans mot de passe."
    Write-Warning "Copiez .env.example vers .env.local et définissez ADMIN_PASSWORD avant d'exposer le site sur Internet."
}

if ($Rebuild -or -not (Test-Path ".next")) {
    Write-Host "Compilation de production en cours..." -ForegroundColor Cyan
    if (Test-Path ".next") {
        Remove-Item -Recurse -Force ".next"
    }
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "La compilation npm run build a échoué."
    }
}

Write-Host "Démarrage de JOCURI • TIMECODE sur http://127.0.0.1:$Port ..." -ForegroundColor Green
npx next start -H 127.0.0.1 -p $Port
