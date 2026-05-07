# Requires: npx @railway/cli, and this repo linked to Railway (`railway link`).
# Does not print secret values — only names, presence, and safe metadata (e.g. ADMIN key length).
#
# Usage:
#   npx @railway/cli login
#   npx @railway/cli link          # from repo root, pick project + service
#   powershell -ExecutionPolicy Bypass -File scripts/railway-backend-env-audit.ps1
#
# Optional — target a specific service tab name from Railway:
#   powershell ... -File scripts/railway-backend-env-audit.ps1 -Service "tryverse-backend"

param(
  [string]$Service = ""
)

$ErrorActionPreference = "Continue"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "== Railway auth ==" -ForegroundColor Cyan
$whoRaw = npx --yes @railway/cli whoami 2>&1 | Out-String
if ($whoRaw -match "Unauthorized|not logged|Please login") {
  Write-Host "Not logged in. In this folder run:" -ForegroundColor Yellow
  Write-Host "  npx @railway/cli login" -ForegroundColor Yellow
  Write-Host "  npx @railway/cli link" -ForegroundColor Yellow
  Write-Host "Then re-run this script." -ForegroundColor Yellow
  exit 1
}
Write-Host $whoRaw.Trim()

$railwayArgs = @("variable", "list", "--json")
if ($Service) { $railwayArgs += @("-s", $Service) }

Write-Host "`n== Fetching variables (JSON) ==" -ForegroundColor Cyan
$jsonText = npx --yes @railway/cli @railwayArgs 2>&1 | Out-String
if ($jsonText -match "Unauthorized|Please login|Multiple services found|not linked") {
  Write-Host ($jsonText.Trim())
  Write-Host "`nIf you have multiple services, pass -Service `"YourServiceNameFromRailwayDashboard`"" -ForegroundColor Yellow
  exit 1
}

if (($jsonText.Trim().Length -eq 0) -or ($jsonText -notmatch '[\{\[]')) {
  Write-Host "Unexpected CLI output (expected JSON)." -ForegroundColor Red
  Write-Host "Save output locally only: npx @railway/cli variable list --json > railway-vars.json" -ForegroundColor Yellow
  exit 1
}

function Extract-RailwayJsonObject([string]$s) {
  $start = $s.IndexOf('{')
  if ($start -lt 0) { throw "No JSON object start" }
  $end = $s.LastIndexOf('}')
  if ($end -le $start) { throw "No JSON object end" }
  return $s.Substring($start, $end - $start + 1)
}

$table = @{ }
try {
  $canonical = Extract-RailwayJsonObject $jsonText
  $canonical = $canonical.TrimStart([char]0xFEFF)
  $obj = $canonical | ConvertFrom-Json
  if ($obj -is [System.Collections.IDictionary]) {
    foreach ($k in $obj.Keys) {
      $table[$k.ToString()] = $obj[$k]
    }
  }
  elseif ($null -ne $obj) {
    foreach ($p in $obj.PSObject.Properties) {
      $table[$p.Name] = $p.Value
    }
  }
}
catch {
  Write-Host "Could not parse Railway JSON safely. Error: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "(Raw output omitted so secrets do not leak to logs.)" -ForegroundColor Yellow
  Write-Host "Save locally only: npx @railway/cli variable list --json > railway-vars.json" -ForegroundColor Yellow
  exit 1
}

$names = ($table.Keys | Sort-Object)
Write-Host "`nTotal variables:" $names.Count
Write-Host "`nVariable names:" -ForegroundColor Cyan
$names | ForEach-Object { Write-Host "  $_" }

$requiredBackend = @(
  "ADMIN_SECRET_KEY",
  "CONVEX_URL",
  "BACKEND_SHARED_SECRET",
  "REPLICATE_API_TOKEN",
  "NODE_ENV",
  "FRONTEND_URL",
  "WIDGET_ALLOWED_ORIGINS",
  "RESEND_API_KEY"
)

Write-Host "`n== Backend / admin sanity (no secret values printed) ==" -ForegroundColor Cyan
foreach ($k in $requiredBackend) {
  if (-not $table.ContainsKey($k)) {
    Write-Host "  MISSING: $k" -ForegroundColor Red
    continue
  }
  Write-Host "  OK: $k" -ForegroundColor Green
  switch ($k) {
    "ADMIN_SECRET_KEY" {
      $len = "$($table[$k])".Length
      Write-Host "      -> length $len chars (must match exactly what you type on /admin)" -ForegroundColor DarkGray
    }
    "CONVEX_URL" {
      try {
        $h = ([uri]"$($table[$k])").Host
        Write-Host "      -> host $h" -ForegroundColor DarkGray
      } catch {
        Write-Host "      -> (could not parse as URL)" -ForegroundColor Yellow
      }
    }
    "NODE_ENV" {
      Write-Host "      -> $($table[$k])" -ForegroundColor DarkGray
    }
    "FRONTEND_URL" {
      Write-Host "      -> $($table[$k])" -ForegroundColor DarkGray
    }
    "WIDGET_ALLOWED_ORIGINS" {
      $w = "$($table[$k])"
      if ($w.Length -gt 80) { $w = $w.Substring(0, 77) + "..." }
      Write-Host "      -> $w" -ForegroundColor DarkGray
    }
  }
}

Write-Host "`nDone. If ADMIN_SECRET_KEY is OK but /admin still fails, check Vercel VITE_BACKEND_URL" `
  "points at this Railway service URL and that the browser Network tab POST /api/admin/session hits that host." `
  -ForegroundColor DarkGray
