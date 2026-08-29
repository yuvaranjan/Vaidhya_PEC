#!/usr/bin/env bash
# Project Vaidhya — one-click start (macOS / Linux).
#
#   ./start.sh            install what is missing, then run both servers
#   ./start.sh --check    verify the machine is ready, start nothing
#   ./start.sh --web-only portal only, no Python service (mock AI mode)
#
# The team builds on Windows — start.ps1 is the maintained path. This exists so a
# teammate on a Mac is not stuck.

set -euo pipefail
cd "$(dirname "$0")"

CHECK=false
WEB_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --check) CHECK=true ;;
    --web-only) WEB_ONLY=true ;;
  esac
done

ok()   { printf '  \033[32m[ok]\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m[!!]\033[0m %s\n' "$1"; }
die()  { printf '  \033[31m[xx]\033[0m %s\n' "$1"; exit 1; }

echo
printf '\033[36mProject Vaidhya\033[0m\n'
echo

command -v node >/dev/null || die "Node.js not found. Install Node 20+."
[ "$(node -v | sed 's/^v//' | cut -d. -f1)" -ge 20 ] || die "Node $(node -v) is too old. Need 20+."
ok "node $(node -v)"

PY=""
if ! $WEB_ONLY; then
  PY=$(command -v python3 || command -v python || true)
  [ -n "$PY" ] || { warn "Python not found — web only."; WEB_ONLY=true; }
  [ -n "$PY" ] && ok "$($PY --version)"
fi

if [ ! -f apps/web/.env.local ]; then
  cp apps/web/.env.local.example apps/web/.env.local
  SECRET=$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")
  # BSD and GNU sed disagree about -i, so rewrite the file instead.
  node -e "
    const fs=require('fs'),f='apps/web/.env.local';
    fs.writeFileSync(f, fs.readFileSync(f,'utf8').replace(/^SESSION_SECRET=\$/m,'SESSION_SECRET=$SECRET'));
  "
  ok "created apps/web/.env.local (SESSION_SECRET generated)"
else
  ok "apps/web/.env.local exists"
fi

if ! $WEB_ONLY && [ ! -f services/edge-ai/.env ]; then
  cp services/edge-ai/.env.example services/edge-ai/.env
  ok "created services/edge-ai/.env"
fi

grep -q '^SUPABASE_URL=.\+' apps/web/.env.local 2>/dev/null ||
  warn "SUPABASE_URL is empty — anything touching the database will fail. See SETUP.md."

if [ ! -d node_modules ]; then
  echo "  installing npm packages (first run)..."
  npm install --silent
  ok "npm packages installed"
else
  ok "npm packages present"
fi

VENV_PY="services/edge-ai/.venv/bin/python"
if ! $WEB_ONLY; then
  if [ ! -x "$VENV_PY" ]; then
    echo "  creating the Python venv (first run)..."
    "$PY" -m venv services/edge-ai/.venv
    "$VENV_PY" -m pip install --quiet --upgrade pip
    "$VENV_PY" -m pip install --quiet -r services/edge-ai/requirements.txt
    ok "python packages installed"
  else
    ok "python venv present"
  fi
fi

node scripts/update-progress.mjs >/dev/null
node scripts/check-setup.mjs --warn >/dev/null
ok "progress board regenerated"

if $CHECK; then echo; ok "Everything is ready."; echo; exit 0; fi

cleanup() { kill 0 2>/dev/null || true; }
trap cleanup EXIT INT TERM

if ! $WEB_ONLY; then
  (cd services/edge-ai && ../../"$VENV_PY" -m uvicorn main:app --reload --port 8000) &
  ok "edge-ai   -> http://localhost:8000/health"
fi

npm run dev &
ok "portal    -> http://localhost:3000"

echo
echo "  Demo logins"
echo "    patient   9000000001   OTP 123456"
echo "    doctor    9100000001   password vaidhya123"
echo
echo "  Ctrl-C to stop both."
wait
