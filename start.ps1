# Project Vaidhya — one-click start (Windows).
#
#   Double-click start.bat, or:  .\start.ps1
#   .\start.ps1 -Check     verify the machine is ready, start nothing
#   .\start.ps1 -WebOnly   portal only, no Python service (mock AI mode)
#
# Safe to run repeatedly. It installs only what is missing.

param(
  [switch]$Check,
  [switch]$WebOnly
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

function Say($msg)  { Write-Host "  $msg" }
function Ok($msg)   { Write-Host "  [ok] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "  [!!] $msg" -ForegroundColor Yellow }
function Die($msg)  { Write-Host "  [xx] $msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "Project Vaidhya" -ForegroundColor Cyan
Write-Host "Edge-AI telemedicine - starting up" -ForegroundColor Cyan
Write-Host ""

# --- 1. prerequisites --------------------------------------------------------

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Die "Node.js not found. Install Node 20+ from https://nodejs.org and re-run." }
$nodeMajor = [int](((node -v) -replace '^v','') -split '\.')[0]
if ($nodeMajor -lt 20) { Die "Node $(node -v) is too old. Need 20 or newer." }
Ok "node $(node -v)"

$python = $null
if (-not $WebOnly) {
  foreach ($candidate in @("python", "py")) {
    $c = Get-Command $candidate -ErrorAction SilentlyContinue
    if ($c) { $python = $c.Source; break }
  }
  if (-not $python) {
    Warn "Python not found - starting the web portal only (mock AI mode)."
    $WebOnly = $true
  } else {
    Ok "python $((& $python --version) -replace 'Python ','')"
  }
}

# --- 2. environment files ----------------------------------------------------

$webEnv = Join-Path $root "apps\web\.env.local"
if (-not (Test-Path $webEnv)) {
  Copy-Item (Join-Path $root "apps\web\.env.local.example") $webEnv
  # A session secret must exist and must be at least 32 chars, so generate one.
  $secret = -join ((1..48) | ForEach-Object { "0123456789abcdef"[(Get-Random -Maximum 16)] })
  (Get-Content $webEnv) -replace '^SESSION_SECRET=$', "SESSION_SECRET=$secret" |
    Set-Content $webEnv -Encoding utf8
  Ok "created apps\web\.env.local (SESSION_SECRET generated)"
} else {
  Ok "apps\web\.env.local exists"
}

$edgeEnv = Join-Path $root "services\edge-ai\.env"
if (-not $WebOnly -and -not (Test-Path $edgeEnv)) {
  Copy-Item (Join-Path $root "services\edge-ai\.env.example") $edgeEnv
  Ok "created services\edge-ai\.env"
}

if ((Get-Content $webEnv -Raw) -notmatch 'SUPABASE_URL=\S') {
  Warn "SUPABASE_URL is empty - anything that touches the database will fail."
  Say  "Create a Supabase project, run db\001_schema.sql then db\002_seed.sql,"
  Say  "and paste the URL + service key into apps\web\.env.local. See SETUP.md."
}

# --- 3. dependencies ---------------------------------------------------------

if (-not (Test-Path (Join-Path $root "node_modules"))) {
  Say "installing npm packages (first run, ~1 min)..."
  npm install --silent
  if ($LASTEXITCODE -ne 0) { Die "npm install failed." }
  Ok "npm packages installed"
} else {
  Ok "npm packages present"
}

$venv = Join-Path $root "services\edge-ai\.venv"
$venvPy = Join-Path $venv "Scripts\python.exe"
if (-not $WebOnly) {
  if (-not (Test-Path $venvPy)) {
    Say "creating the Python venv and installing packages (first run, ~2 min)..."
    & $python -m venv $venv
    & $venvPy -m pip install --quiet --upgrade pip
    & $venvPy -m pip install --quiet -r (Join-Path $root "services\edge-ai\requirements.txt")
    if ($LASTEXITCODE -ne 0) { Die "pip install failed." }
    Ok "python packages installed"
  } else {
    Ok "python venv present"
  }
}

# --- 4. refresh the generated docs ------------------------------------------

node scripts\update-progress.mjs | Out-Null
node scripts\check-setup.mjs --warn | Out-Null
Ok "progress board regenerated"

if ($Check) {
  Write-Host ""
  Ok "Everything is ready. Run .\start.ps1 to launch."
  Write-Host ""
  exit 0
}

# --- 5. clear servers left over from the last run ----------------------------
#
# Three failure modes that all look like different bugs, and are not:
#   port 3000 -> EADDRINUSE            (node says it plainly)
#   port 8002 -> WinError 10048        (the literal "address in use" code)
#   port 8000 -> WinError 10013        (WSAEACCES - the holder claimed the port
#                                       exclusively, so Windows returns "access
#                                       denied" instead of "in use")
# In every case the previous run's server is still alive, the new one dies on
# bind, and its window sits there at a prompt looking like it closed itself.
#
# This also used to conceal itself: the readiness probe below polls port 3000,
# the OLD portal answered it, and the script cheerfully reported "portal is up"
# and opened a browser. Clearing the ports first is what makes the promise at
# the top of this file - "safe to run repeatedly" - actually true.

# This script's own process and everything that launched it. Climbing a parent
# chain without this would happily kill the console you are standing in.
function Get-SelfAncestry {
  $ids = @()
  $cur = $PID
  for ($i = 0; $i -lt 24; $i++) {
    if (-not $cur -or $cur -eq 0) { break }
    $ids += [int]$cur
    $ci = Get-CimInstance Win32_Process -Filter "ProcessId=$cur" -ErrorAction SilentlyContinue
    if (-not $ci) { break }
    $cur = [int]$ci.ParentProcessId
  }
  return $ids
}

$selfAncestry = Get-SelfAncestry

function Stop-StaleServer($port, $label) {
  $conns = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)

  foreach ($procId in @($conns | Select-Object -ExpandProperty OwningProcess -Unique)) {
    if (-not $procId -or $procId -eq 0) { continue }
    if ($selfAncestry -contains [int]$procId) { continue }

    $ci = Get-CimInstance Win32_Process -Filter "ProcessId=$procId" -ErrorAction SilentlyContinue
    # An owner that has already exited leaves the listener behind for a moment.
    # Nothing to kill - just fall through to the wait below.
    if (-not $ci) { continue }

    $cmd = [string]$ci.CommandLine

    # Only ever stop this project's own servers. Something else on one of these
    # ports is the user's business - name it and stop, never kill it blind.
    if ($cmd -notlike "*$root*") {
      Die ("port $port ($label) is held by $($ci.Name) (PID $procId), which is not " +
           "part of this project. Stop it yourself or free the port, then re-run.")
    }

    # uvicorn --reload, and the specialist's api.py, run a supervisor that owns
    # the socket and re-spawns its worker. Killing only the PID holding the port
    # either leaves the parent holding the socket or lets it start a replacement,
    # so climb to the top of this project's chain and take the whole tree.
    $top = [int]$procId
    for ($i = 0; $i -lt 8; $i++) {
      $node = Get-CimInstance Win32_Process -Filter "ProcessId=$top" -ErrorAction SilentlyContinue
      if (-not $node) { break }
      $parentId = [int]$node.ParentProcessId
      if ($parentId -eq 0 -or $selfAncestry -contains $parentId) { break }
      $parent = Get-CimInstance Win32_Process -Filter "ProcessId=$parentId" -ErrorAction SilentlyContinue
      if (-not $parent) { break }
      if ([string]$parent.CommandLine -notlike "*$root*") { break }
      $top = $parentId
    }

    # /T takes the descendants with it, which is the point.
    & taskkill /PID $top /T /F 2>&1 | Out-Null
    Ok "stopped a stale $label holding port $port (PID $procId, tree from $top)"
  }

  # Orphaned workers. uvicorn --reload runs its worker through multiprocessing,
  # and that worker inherits the listening socket. If the supervisor dies first
  # the worker keeps the port alive while netstat still credits it to the dead
  # supervisor's PID - which is the "held by a process that does not exist"
  # state that stalled this script for 30s. The worker's command line is a bare
  #   python.exe -c "from multiprocessing.spawn import spawn_main; parent_pid=NNN"
  # so it never mentions this repo: lineage is the only thing tying it back here.
  foreach ($procId in @($conns | Select-Object -ExpandProperty OwningProcess -Unique)) {
    if (-not $procId -or $procId -eq 0) { continue }
    if ($selfAncestry -contains [int]$procId) { continue }

    $orphans = @(Get-CimInstance Win32_Process -Filter "Name='python.exe' OR Name='node.exe'" -ErrorAction SilentlyContinue |
      Where-Object {
        [int]$_.ParentProcessId -eq [int]$procId -or
        [string]$_.CommandLine -like "*parent_pid=$procId*"
      })

    foreach ($orphan in $orphans) {
      if ($selfAncestry -contains [int]$orphan.ProcessId) { continue }
      & taskkill /PID $orphan.ProcessId /T /F 2>&1 | Out-Null
      Ok "stopped an orphaned $label worker (PID $($orphan.ProcessId), inherited the socket from $procId)"
    }
  }

  # A killed process does not release its listener instantly - Windows can leave
  # the socket owner-less for a few seconds - and losing that race puts us right
  # back at the 10013/10048 this whole section exists to prevent.
  foreach ($i in 1..60) {
    $still = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
    if ($still.Count -eq 0) { return }
    Start-Sleep -Milliseconds 500
  }
  Die "port $port ($label) is still held after 30s. Close that window by hand and re-run."
}

$portsToClear = @()
if (-not $WebOnly) {
  $portsToClear += ,@(8000, "edge-ai")
  $portsToClear += ,@(8002, "specialist")
}
$portsToClear += ,@(3000, "portal")

foreach ($entry in $portsToClear) { Stop-StaleServer $entry[0] $entry[1] }

# --- 6. launch ---------------------------------------------------------------

Write-Host ""
Say "starting servers in separate windows..."

if (-not $WebOnly) {
  Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$root\services\edge-ai'; " +
    "& '$venvPy' -m uvicorn main:app --reload --port 8000"
  ) -WindowStyle Normal
  Ok "edge-ai   -> http://localhost:8000/health"

  Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$root\multi_agent_specialist'; " +
    "& '.\venv\Scripts\python.exe' api.py"
  ) -WindowStyle Normal
  Ok "specialist-> http://localhost:8002/consult"
}

Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "Set-Location '$root'; npm run dev"
) -WindowStyle Normal
Ok "portal    -> http://localhost:3000"

# Wait for Next to answer before opening a browser at a dead port. This is only
# trustworthy because section 5 guaranteed the port was free a moment ago -
# otherwise a leftover server answers on the new one's behalf.
Say "waiting for the portal..."
$up = $false
foreach ($i in 1..60) {
  try {
    Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 2 -UseBasicParsing | Out-Null
    $up = $true; break
  } catch { Start-Sleep -Seconds 1 }
}

if ($up) {
  Start-Process "http://localhost:3000"
  Ok "portal is up"
} else {
  Warn "portal did not answer within 60s - check the npm window for errors."
}

# The Python services fail silently from here: their windows stay open on a
# prompt whether or not the server inside survived. Say which ones actually
# answered, so a dead backend is visible now instead of mid-demo.
if (-not $WebOnly) {
  # /openapi.json for the specialist because it only serves POST /consult - a
  # GET anywhere else is a correct 404, not a dead server. Both services load
  # model providers on boot and routinely need more than 20s on a cold start.
  $services = @(
    @{ Label = "edge-ai";    Port = 8000; Url = "http://localhost:8000/health" },
    @{ Label = "specialist"; Port = 8002; Url = "http://localhost:8002/openapi.json" }
  )
  foreach ($svc in $services) {
    $ok = $false
    foreach ($i in 1..45) {
      try {
        Invoke-WebRequest -Uri $svc.Url -TimeoutSec 3 -UseBasicParsing | Out-Null
        $ok = $true; break
      } catch {
        # An HTTP status - any status - means something answered, which is all
        # this check claims. Only a connection-level failure means "not up yet".
        if ($_.Exception.Response) { $ok = $true; break }
        Start-Sleep -Seconds 1
      }
    }
    if ($ok) { Ok "$($svc.Label) is up on port $($svc.Port)" }
    else { Warn "$($svc.Label) did not answer on port $($svc.Port) - check its window." }
  }
}

Write-Host ""
Write-Host "  Demo logins" -ForegroundColor Cyan
Write-Host "    patient   9000000001   OTP 123456"
Write-Host "    doctor    9100000001   password vaidhya123"
Write-Host ""
Write-Host "  Close the two server windows to stop. See SETUP.md for details."
Write-Host ""
