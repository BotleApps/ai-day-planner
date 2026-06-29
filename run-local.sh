#!/usr/bin/env bash
# =============================================================================
# run-local.sh — Local development launcher for AI Day Planner
#
# Usage:
#   ./run-local.sh              # Start the Next.js web app (http://localhost:3000)
#   ./run-local.sh ios          # Start backend + run on iOS Simulator (needs macOS + Xcode)
#   ./run-local.sh android      # Start backend + run on Android Emulator (needs Android Studio)
# =============================================================================
set -euo pipefail

PLATFORM="${1:-web}"
PORT=3000
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

DEV_LOG="${TMPDIR:-/tmp}/ai-day-planner-dev.log"
DEV_PID=""

# ── Helpers ──────────────────────────────────────────────────────────────────
backend_up() { curl -sf -o /dev/null "http://localhost:${PORT}/api/health" 2>/dev/null || curl -sf -o /dev/null "http://localhost:${PORT}" 2>/dev/null; }

cleanup() {
  if [ -n "$DEV_PID" ] && kill -0 "$DEV_PID" 2>/dev/null; then
    echo ""
    echo "Stopping dev server (pid $DEV_PID)..."
    kill "$DEV_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

start_backend() {
  if backend_up; then
    echo "✓ Backend already running on http://localhost:${PORT}"
  else
    echo "Starting Next.js dev server on http://localhost:${PORT} ..."
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
}

# ── Modes ────────────────────────────────────────────────────────────────────
case "$PLATFORM" in

  web)
    echo "──────────────────────────────────────────────────────────"
    echo " AI Day Planner — Web Dev Server"
    echo " http://localhost:${PORT}"
    echo "──────────────────────────────────────────────────────────"
    exec npm run dev
    ;;

  ios)
    echo "──────────────────────────────────────────────────────────"
    echo " AI Day Planner — iOS Simulator"
    echo "──────────────────────────────────────────────────────────"
    SERVER_URL="http://localhost:${PORT}"
    start_backend

    export CAP_SERVER_URL="$SERVER_URL"
    echo "CAP_SERVER_URL=$CAP_SERVER_URL"

    if [ ! -d "$ROOT/ios" ]; then
      echo "Adding iOS platform (one-time scaffold)..."
      npx cap add ios
    fi

    echo "Syncing native iOS project..."
    npx cap sync ios

    echo "Launching on iOS Simulator — choose a device when prompted..."
    npx cap run ios

    if [ -n "$DEV_PID" ] && kill -0 "$DEV_PID" 2>/dev/null; then
      echo ""
      echo "──────────────────────────────────────────────────────────"
      echo "iOS app launched. Backend is running — Ctrl+C to stop."
      echo "──────────────────────────────────────────────────────────"
      tail -f "$DEV_LOG"
    fi
    ;;

  android)
    echo "──────────────────────────────────────────────────────────"
    echo " AI Day Planner — Android Emulator"
    echo "──────────────────────────────────────────────────────────"
    SERVER_URL="http://10.0.2.2:${PORT}"
    start_backend

    export CAP_SERVER_URL="$SERVER_URL"
    echo "CAP_SERVER_URL=$CAP_SERVER_URL"

    if [ ! -d "$ROOT/android" ]; then
      echo "Adding Android platform (one-time scaffold)..."
      npx cap add android
    fi

    echo "Syncing native Android project..."
    npx cap sync android

    echo "Launching on Android Emulator — choose a device when prompted..."
    npx cap run android

    if [ -n "$DEV_PID" ] && kill -0 "$DEV_PID" 2>/dev/null; then
      echo ""
      echo "──────────────────────────────────────────────────────────"
      echo "Android app launched. Backend is running — Ctrl+C to stop."
      echo "──────────────────────────────────────────────────────────"
      tail -f "$DEV_LOG"
    fi
    ;;

  *)
    echo "Usage: ./run-local.sh [web|ios|android]"
    echo ""
    echo "  (no args)   Start Next.js web dev server on http://localhost:3000"
    echo "  ios         Start backend + launch iOS Simulator (needs macOS + Xcode)"
    echo "  android     Start backend + launch Android Emulator (needs Android Studio)"
    exit 1
    ;;
esac
