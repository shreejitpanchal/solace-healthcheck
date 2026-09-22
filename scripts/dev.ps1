# Developer task runner (PowerShell). Mirrors scripts/dev.sh.
# Usage: scripts\dev.ps1 <task> [<task> ...]
#   build  - bundle src/*.js into app.js (classic script, works from file://)
#   lint   - load every module to catch syntax and import errors
#   test   - run the node:test suite
#   all    - build + lint + test (fast post-change loop)
#   serve  - static server on http://127.0.0.1:8788 (Ctrl+C to stop; not logged)
#   help   - this text
# Each logged task writes scripts/logs/<task>.log (fresh file per run, plain UTF-8 text).

param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Tasks)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$LogDir = Join-Path $ScriptDir "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Write-Step($Message) { Write-Host "==> $Message" -ForegroundColor Cyan }
function Write-Ok($Message) { Write-Host "OK   $Message" -ForegroundColor Green }
function Write-Warn($Message) { Write-Host "WARN $Message" -ForegroundColor Yellow }
function Die($Message) { Write-Host "FAIL $Message" -ForegroundColor Red; exit 1 }

$SelfPath = $PSCommandPath

function Show-Usage {
  Get-Content $SelfPath -TotalCount 10 | ForEach-Object { $_ -replace '^#\s?', '' }
}

function Invoke-Logged([string]$Task, [string]$Command, [string[]]$Arguments) {
  $log = Join-Path $LogDir "$Task.log"
  $header = "# task: $Task`r`n# started: $(Get-Date -Format o)`r`n# command: $Command $($Arguments -join ' ')`r`n"
  Set-Content -Path $log -Value $header -Encoding utf8
  $env:NO_COLOR = "1"
  $env:FORCE_COLOR = "0"
  Push-Location $RepoRoot
  # Native stderr lines become ErrorRecords under 2>&1; they must not terminate the run.
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $out = (& $Command @Arguments 2>&1 | ForEach-Object { "$_" } | Out-String -Width 4096)
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousPreference
    Pop-Location
  }
  $out = $out -replace "\x1b\[[0-9;]*[mGKHF]", ""
  Add-Content -Path $log -Value $out -Encoding utf8
  Write-Host $out
  return $code
}

function Task-Build {
  Write-Step "build app.js from src/"
  $code = Invoke-Logged "build" "node" @("scripts/build.mjs")
  if ($code -ne 0) { Die "build failed (see scripts/logs/build.log)" }
  Write-Ok "build"
}

function Task-Lint {
  Write-Step "lint (module load check)"
  $code = Invoke-Logged "lint" "node" @("scripts/lint.mjs")
  if ($code -ne 0) { Die "lint failed (see scripts/logs/lint.log)" }
  Write-Ok "lint"
}

function Task-Test {
  Write-Step "test (node --test)"
  $code = Invoke-Logged "test" "node" @("--test", "test/**/*.test.js")
  if ($code -ne 0) { Die "tests failed (see scripts/logs/test.log)" }
  Write-Ok "test"
}

function Task-Serve {
  Write-Step "serve http://127.0.0.1:8788"
  Push-Location $RepoRoot
  try { & node scripts/serve.mjs } finally { Pop-Location }
}

if (-not $Tasks -or $Tasks.Count -eq 0 -or $Tasks -contains "help" -or $Tasks -contains "-h") {
  Show-Usage
  exit 0
}

foreach ($task in $Tasks) {
  switch ($task) {
    "build" { Task-Build }
    "lint" { Task-Lint }
    "test" { Task-Test }
    "all" { Task-Build; Task-Lint; Task-Test }
    "serve" { Task-Serve }
    default { Die "unknown task '$task' (try: scripts\dev.ps1 help)" }
  }
}
