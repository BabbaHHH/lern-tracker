#!/usr/bin/env bash
# Local dev server. Never kill unrelated processes or delete live Next.js locks.
set -u
cd "$(dirname "$0")/.." || exit 1
stex_clean=0
stex_args=(dev --hostname "${STEX_DEV_HOST:-127.0.0.1}" --port "${STEX_DEV_PORT:-3000}")
for arg in "$@"; do
  case "$arg" in
    --clean) stex_clean=1 ;;
    --webpack) stex_args+=(--webpack) ;;
    *) echo "Unbekannte Option: $arg" >&2; exit 1 ;;
  esac
done
if [ "$stex_clean" = "1" ]; then
  if [ -e .next/dev/lock ]; then
    echo "Der Entwicklungsordner ist gesperrt. Bitte zuerst den laufenden Server beenden." >&2
    exit 1
  fi
  rm -rf .next
fi
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=4096"
stex_pid=""
stop_server() {
  trap - INT TERM
  if [ -n "$stex_pid" ]; then
    kill -TERM "$stex_pid" 2>/dev/null || true
    wait "$stex_pid" 2>/dev/null || true
  fi
  exit 0
}
trap stop_server INT TERM
stex_attempts=0
while true; do
  node node_modules/next/dist/bin/next "${stex_args[@]}" &
  stex_pid=$!
  wait "$stex_pid"
  stex_status=$?
  stex_pid=""
  case "$stex_status" in 0|130|143) exit 0 ;; esac
  stex_attempts=$((stex_attempts + 1))
  if [ "$stex_attempts" -ge 3 ]; then
    echo "Server nach drei Fehlstarts beendet. Bitte die Fehlermeldung oben prüfen." >&2
    exit "$stex_status"
  fi
  echo "Server beendet (Status $stex_status). Neuer Versuch in zwei Sekunden."
  sleep 2
done
