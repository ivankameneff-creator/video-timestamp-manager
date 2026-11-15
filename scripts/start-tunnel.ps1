param(
    [string]$TunnelName = "",
    [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
    Write-Error "cloudflared est introuvable. Installez-le avec : winget install Cloudflare.cloudflared"
    exit 1
}

if ([string]::IsNullOrWhiteSpace($TunnelName)) {
    Write-Host "Lancement d'un tunnel Cloudflare temporaire vers http://127.0.0.1:$Port ..." -ForegroundColor Cyan
    Write-Host "Copiez l'URL https://....trycloudflare.com affichée ci-dessous." -ForegroundColor Yellow
    cloudflared tunnel --url "http://127.0.0.1:$Port"
} else {
    Write-Host "Lancement du tunnel Cloudflare '$TunnelName'..." -ForegroundColor Green
    cloudflared tunnel run $TunnelName
}
