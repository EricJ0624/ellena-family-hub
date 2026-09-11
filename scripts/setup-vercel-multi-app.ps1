#Requires -Version 5.1
<#
.SYNOPSIS
  After `vercel login` (or VERCEL_TOKEN), create/link 3 app projects and attach domains.

.EXAMPLE
  .\scripts\setup-vercel-multi-app.ps1
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (-not (Test-Path (Join-Path $root 'hearth-couple'))) {
  $root = 'c:\Dev\ellena-family-app-next.js'
}

$apps = @(
  @{ Dir = 'hearth-couple'; Project = 'hearth-couple'; Domain = 'couple.myhearthfamily.com'; AppId = 'hearth_couple' },
  @{ Dir = 'hearth-biker';  Project = 'hearth-biker';  Domain = 'biker.myhearthfamily.com';  AppId = 'hearth_biker' },
  @{ Dir = 'hearth-camper'; Project = 'hearth-camper'; Domain = 'camper.myhearthfamily.com'; AppId = 'hearth_camper' }
)

Write-Host "Root: $root"
vercel whoami
if ($LASTEXITCODE -ne 0) {
  Write-Error "Run: vercel login   (or set VERCEL_TOKEN)"
}

foreach ($a in $apps) {
  $path = Join-Path $root $a.Dir
  if (-not (Test-Path $path)) {
    Write-Warning "Missing folder: $path"
    continue
  }
  Write-Host "`n=== $($a.Project) ===" -ForegroundColor Cyan
  Push-Location $path
  try {
    # Non-interactive link if possible; may still prompt for team/scope on first run
    vercel link --yes --project $a.Project 2>&1 | Write-Host
    vercel domains add $a.Domain 2>&1 | Write-Host
    Write-Host "Set env NEXT_PUBLIC_APP_ID=$($a.AppId) and APP_ID=$($a.AppId) in Vercel dashboard (copy other secrets from Family)."
    Write-Host "DNS: add CNAME $($a.Domain.Split('.')[0]) -> value shown by: vercel domains inspect $($a.Domain)"
  } finally {
    Pop-Location
  }
}

Write-Host "`nDone. Check Vercel dashboard for DNS instructions per domain." -ForegroundColor Green
