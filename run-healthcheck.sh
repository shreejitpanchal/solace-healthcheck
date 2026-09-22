#!/usr/bin/env bash
# One-command launcher for the Solace Ops Readiness Checklist.
#
#   ./run-healthcheck.sh            build app.js, start the local server, open the browser
#   ./run-healthcheck.sh --file     build app.js and open index.html directly from disk (no server)
#   ./run-healthcheck.sh --check    build, then run lint and tests before starting the server
#   PORT=9000 ./run-healthcheck.sh  use a different port
#
# Requires Node.js 20+. Works from Git Bash on Windows, macOS and Linux.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-8788}"
HOST="${HOST:-127.0.0.1}"
MODE="serve"
CHECK="no"

for arg in "$@"; do
  case "$arg" in
    --file) MODE="file" ;;
    --check) CHECK="yes" ;;
    -h|--help) sed -n '2,9p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $arg (try --help)" >&2; exit 1 ;;
  esac
done

if ! command -v node >/dev/null 2>&1; then
  echo "FAIL node is not on PATH. Install Node.js 20 or newer: https://nodejs.org" >&2
  exit 1
fi

open_url() {
  local target="$1"
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) start "" "$target" 2>/dev/null || cmd.exe /c start "" "$target" ;;
    Darwin*) open "$target" ;;
    *) xdg-open "$target" >/dev/null 2>&1 || echo "Open $target in your browser." ;;
  esac
}

cd "$HERE"

echo "==> building app.js from src/"
node scripts/build.mjs

if [ "$CHECK" = "yes" ]; then
  echo "==> lint"
  node scripts/lint.mjs
  echo "==> tests"
  node --test "test/**/*.test.js"
fi

if [ "$MODE" = "file" ]; then
  echo "==> opening index.html from disk"
  open_url "$HERE/index.html"
  exit 0
fi

URL="http://$HOST:$PORT/"
echo "==> serving $HERE at $URL (Ctrl+C to stop)"
# Open the browser once the server is listening, without blocking the server itself.
(
  for _ in $(seq 1 40); do
    if node -e "require('node:net').connect($PORT,'$HOST').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))" 2>/dev/null; then
      open_url "$URL"
      exit 0
    fi
    sleep 0.25
  done
  echo "server did not start; open $URL manually" >&2
) &

PORT="$PORT" HOST="$HOST" exec node scripts/serve.mjs
