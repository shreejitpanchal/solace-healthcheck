#!/usr/bin/env bash
# Developer task runner (bash). Mirrors scripts/dev.ps1.
# Usage: scripts/dev.sh <task> [<task> ...]
#   build  - bundle src/*.js into app.js (classic script, works from file://)
#   lint   - load every module to catch syntax and import errors
#   test   - run the node:test suite
#   all    - build + lint + test (fast post-change loop)
#   serve  - static server on http://127.0.0.1:8788 (Ctrl+C to stop; not logged)
#   help   - this text
# Each logged task writes scripts/logs/<task>.log (fresh file per run, plain UTF-8 text).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"

if [ -t 1 ]; then
  C_STEP=$'\033[36m'; C_OK=$'\033[32m'; C_WARN=$'\033[33m'; C_DIE=$'\033[31m'; C_END=$'\033[0m'
else
  C_STEP=""; C_OK=""; C_WARN=""; C_DIE=""; C_END=""
fi

step() { printf '%s==> %s%s\n' "$C_STEP" "$*" "$C_END"; }
ok()   { printf '%sOK   %s%s\n' "$C_OK" "$*" "$C_END"; }
warn() { printf '%sWARN %s%s\n' "$C_WARN" "$*" "$C_END"; }
die()  { printf '%sFAIL %s%s\n' "$C_DIE" "$*" "$C_END" >&2; exit 1; }

usage() { sed -n '2,10p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

run_logged() {
  local task="$1"; shift
  local log="$LOG_DIR/$task.log"
  {
    echo "# task: $task"
    echo "# started: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "# command: $*"
  } > "$log"
  (
    cd "$REPO_ROOT"
    NO_COLOR=1 FORCE_COLOR=0 "$@" 2>&1 | sed -r 's/\x1b\[[0-9;]*[mGKHF]//g' | tee -a "$log"
    exit "${PIPESTATUS[0]}"
  )
}

task_build() {
  step "build app.js from src/"
  run_logged build node scripts/build.mjs || die "build failed (see scripts/logs/build.log)"
  ok build
}

task_lint() {
  step "lint (module load check)"
  run_logged lint node scripts/lint.mjs || die "lint failed (see scripts/logs/lint.log)"
  ok lint
}

task_test() {
  step "test (node --test)"
  run_logged test node --test "test/**/*.test.js" || die "tests failed (see scripts/logs/test.log)"
  ok test
}

task_serve() {
  step "serve http://127.0.0.1:8788"
  (cd "$REPO_ROOT" && node scripts/serve.mjs)
}

if [ $# -eq 0 ]; then usage; exit 0; fi

for task in "$@"; do
  case "$task" in
    build) task_build ;;
    lint) task_lint ;;
    test) task_test ;;
    all) task_build; task_lint; task_test ;;
    serve) task_serve ;;
    help|-h|--help) usage ;;
    *) die "unknown task '$task' (try: scripts/dev.sh help)" ;;
  esac
done
