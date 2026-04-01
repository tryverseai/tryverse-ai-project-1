# TryVerse local dev: Redis (Docker) + API (:3001) + Vite UI (:8080)
# Run from repo root:  powershell -ExecutionPolicy Bypass -File .\start-local-dev.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host "== TryVerse: starting local stack ==" -ForegroundColor Cyan

# Redis only (avoids port clash with npm backend on 3001)
$compose = Join-Path $root "backend\docker-compose.yml"
if (Get-Command docker -ErrorAction SilentlyContinue) {
  try {
    docker compose -f $compose up -d redis
    Write-Host "Redis: docker compose redis service started (or already up)." -ForegroundColor Green
  } catch {
    Write-Host "Redis: docker not running or compose failed — backend will use sync mode. Error: $_" -ForegroundColor Yellow
  }
} else {
  Write-Host "Redis: docker not in PATH — skipping (optional)." -ForegroundColor Yellow
}

function Stop-ListenersOnPorts {
  param([int[]]$Ports)
  foreach ($p in $Ports) {
    Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue |
      ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
  }
  Start-Sleep -Seconds 2
}

Stop-ListenersOnPorts @(3001, 8080)

$backend = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory (Join-Path $root "backend") -PassThru -WindowStyle Normal
$frontend = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory (Join-Path $root "tryverse-ai-virtual-fashion") -PassThru -WindowStyle Normal

Write-Host ""
Write-Host "Started processes: backend PID $($backend.Id), frontend PID $($frontend.Id)" -ForegroundColor Green
Write-Host "Open the app: http://localhost:8080/  (HTTP only in dev unless you terminate TLS locally)" -ForegroundColor Cyan
Write-Host "API health:   http://localhost:3001/health" -ForegroundColor Cyan
Write-Host "(Two terminal windows were opened for logs; close them to stop.)" -ForegroundColor Gray
