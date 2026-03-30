#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Deploy AI Day Planner to SAP BTP Cloud Foundry
#
# Usage:
#   ./deploy.sh
#
# The script will prompt for any required values that are not already set as
# environment variables. You can pre-export them for non-interactive / CI use:
#
#   export CF_API="https://api.cf.eu10.hana.ondemand.com"
#   export CF_ORG="my-org"
#   export CF_SPACE="dev"
#   export MONGODB_URI="mongodb+srv://..."
#   export NEXTAUTH_SECRET="$(openssl rand -base64 32)"
#   export GOOGLE_CLIENT_ID="..."
#   export GOOGLE_CLIENT_SECRET="..."
#   export NEXTAUTH_URL="https://ai-day-planner.cfapps.eu10.hana.ondemand.com"
#
# For CI pipelines, also set:
#   export CF_USERNAME="..."
#   export CF_PASSWORD="..."
#
# Prerequisites:
#   - CF CLI v8+: https://github.com/cloudfoundry/cli
#   - Node.js 20+ and npm 9+
#   - manifest.yml present in the current directory
# =============================================================================

set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[deploy]${NC} $*"; }
die()  { echo -e "${RED}[deploy] ERROR:${NC} $*" >&2; exit 1; }

# ── Prompt helper (skips if variable already set) ─────────────────────────────
require_var() {
  local var="$1" prompt="$2" secret="${3:-false}"
  if [ -z "${!var:-}" ]; then
    if [ "$secret" = "true" ]; then
      read -rsp "$prompt: " "$var"; echo
    else
      read -rp "$prompt: " "$var"
    fi
    export "$var"
  fi
}

# ── Step 1: Check CF CLI ──────────────────────────────────────────────────────
command -v cf >/dev/null 2>&1 || \
  die "CF CLI not found. Install from https://github.com/cloudfoundry/cli"
log "CF CLI: $(cf version | head -1)"

# ── Step 2: Collect required variables ───────────────────────────────────────
log "Collecting deployment configuration..."
require_var CF_API    "CF API endpoint (e.g. https://api.cf.eu10.hana.ondemand.com)"
require_var CF_ORG    "CF organisation name"
require_var CF_SPACE  "CF space name"
require_var MONGODB_URI       "MongoDB URI" true
require_var NEXTAUTH_SECRET   "NextAuth secret (run: openssl rand -base64 32)" true
require_var GOOGLE_CLIENT_ID  "Google OAuth Client ID"
require_var GOOGLE_CLIENT_SECRET "Google OAuth Client Secret" true
require_var NEXTAUTH_URL      "App public URL (e.g. https://ai-day-planner.cfapps.eu10.hana.ondemand.com)"

# ── Step 3: CF login and target ───────────────────────────────────────────────
log "Setting CF API endpoint: $CF_API"
cf api "$CF_API"

if [ -n "${CF_USERNAME:-}" ] && [ -n "${CF_PASSWORD:-}" ]; then
  log "Authenticating (non-interactive)..."
  cf auth "$CF_USERNAME" "$CF_PASSWORD"
  cf target -o "$CF_ORG" -s "$CF_SPACE"
else
  log "Logging in interactively..."
  cf login -a "$CF_API" -o "$CF_ORG" -s "$CF_SPACE"
fi

# ── Step 4: Build the Next.js app ─────────────────────────────────────────────
log "Installing dependencies..."
npm ci --prefer-offline 2>/dev/null || npm ci

log "Building Next.js (standalone output)..."
npm run build

# Verify standalone output was generated
[ -d ".next/standalone" ] || \
  die ".next/standalone not found. Ensure next.config.ts has output: 'standalone'"

# Copy static assets into standalone (required by Next.js docs)
log "Copying static assets into standalone..."
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static

# ── Step 5: Push to CF (without starting yet) ────────────────────────────────
log "Pushing application to CF (--no-start)..."
cf push --no-start

# ── Step 6: Detect app name from manifest ────────────────────────────────────
APP_NAME=$(grep -E '^\s*- name:' manifest.yml | head -1 | sed 's/.*name: *//')
[ -n "$APP_NAME" ] || die "Could not detect app name from manifest.yml"
log "App name: $APP_NAME"

# ── Step 7: Set environment variables ────────────────────────────────────────
log "Setting environment variables..."
cf set-env "$APP_NAME" NODE_ENV             production
cf set-env "$APP_NAME" MONGODB_URI          "$MONGODB_URI"
cf set-env "$APP_NAME" NEXTAUTH_SECRET      "$NEXTAUTH_SECRET"
cf set-env "$APP_NAME" NEXTAUTH_URL         "$NEXTAUTH_URL"
cf set-env "$APP_NAME" GOOGLE_CLIENT_ID     "$GOOGLE_CLIENT_ID"
cf set-env "$APP_NAME" GOOGLE_CLIENT_SECRET "$GOOGLE_CLIENT_SECRET"

# ── Step 8: Start the application ────────────────────────────────────────────
log "Starting application..."
cf start "$APP_NAME"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
log "Deployment complete!"
echo ""
echo -e "  App URL:   ${GREEN}$NEXTAUTH_URL${NC}"
echo ""
warn "IMPORTANT — Add this redirect URI to your Google Cloud Console OAuth credentials:"
echo -e "  ${YELLOW}$NEXTAUTH_URL/api/auth/callback/google${NC}"
echo ""
echo "  https://console.cloud.google.com/ → APIs & Services → Credentials"
echo ""
log "Useful commands:"
echo "  cf logs $APP_NAME --recent   # check startup logs"
echo "  cf app  $APP_NAME            # check instance health"
