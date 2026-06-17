#!/usr/bin/env bash
# =============================================================================
# run-mobile.sh — Run the SortedPlan native shell on a simulator / emulator.
#
# Usage:
#   ./scripts/run-mobile.sh ios        # iOS Simulator      (needs macOS + Xcode)
#   ./scripts/run-mobile.sh android    # Android Emulator   (needs Android Studio)
#
# What it does (so it "just works" from one command):
#   1. Makes sure the Next.js backend is running on http://localhost:3000.
#      If it isn't, it starts `npm run dev` in the background and waits for it.
#   2. Points the native shell at that backend via CAP_SERVER_URL:
#        • iOS      → http://localhost:3000      (simulator shares the host loopback)
#        • Android  → http://10.0.2.2:3000       (emulator alias for the host)
#   3. Adds the native platform if missing, syncs, then `cap run` (you pick a
#      device when prompted).
#   4. If it started the backend, it keeps streaming its logs afterwards so the
#      app keeps working — press Ctrl+C to stop everything.
# =============================================================================
set -euo pipefail

PLATFORM="${1:-}"
case "$PLATFORM" in
  ios)     SERVER_URL="http://localhost:3000" ;;
  android) SERVER_URL="http://10.0.2.2:3000" ;;
  *)
    echo "Usage: ./scripts/run-mobile.sh <ios|android>"
    exit 1
    ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT=3000
DEV_LOG="${TMPDIR:-/tmp}/sortedplan-dev.log"
DEV_PID=""

backend_up() { curl -sf -o /dev/null "http://localhost:${PORT}"; }

cleanup() {
  if [ -n "$DEV_PID" ] && kill -0 "$DEV_PID" 2>/dev/null; then
    echo ""
    echo "Stopping dev server (pid $DEV_PID)..."
    kill "$DEV_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if backend_up; then
  echo "✓ Backend already running on http://localhost:${PORT}"
else
  echo "Starting Next.js backend (npm run dev) on http://localhost:${PORT} ..."
  npm run dev > "$DEV_LOG" 2>&1 &
  DEV_PID=$!
  printf "  waiting for backend"
  for i in $(seq 1 60); do
    if backend_up; then echo " — ready ✓"; break; fi
    printf "."
    sleep 1
    if [ "$i" -eq 60 ]; then
      echo ""
      echo "✗ Backend did not become ready in 60s. Recent log:"
      tail -n 40 "$DEV_LOG" || true
      exit 1
    fi
  done
fi

export CAP_SERVER_URL="$SERVER_URL"
echo "CAP_SERVER_URL=$CAP_SERVER_URL"

if [ ! -d "$PLATFORM" ]; then
  echo "Adding $PLATFORM platform (one-time scaffold)..."
  npx cap add "$PLATFORM"
fi

echo "Syncing native project ($PLATFORM)..."
npx cap sync "$PLATFORM"

echo "Launching on $PLATFORM — choose a device/simulator when prompted..."
npx cap run "$PLATFORM"

# If we started the backend, keep it alive (the app needs it) and show its logs.
if [ -n "$DEV_PID" ] && kill -0 "$DEV_PID" 2>/dev/null; then
  echo ""
  echo "──────────────────────────────────────────────────────────"
  echo "App launched. Backend is running — Ctrl+C to stop it."
  echo "──────────────────────────────────────────────────────────"
  tail -f "$DEV_LOG"
fi
