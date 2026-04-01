#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Deploy AI Day Planner to SAP BTP Cloud Foundry
#
# Static config (CF_API, CF_ORG, CF_SPACE, CF_APP_URL) is read from .env.local.
# The script checks for a valid CF session and does `cf login --sso` if needed.
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[deploy]${NC} $*"; }
die()  { echo -e "${RED}[deploy] ERROR:${NC} $*" >&2; exit 1; }

# ── 1. Require CF CLI ─────────────────────────────────────────────────────────
command -v cf >/dev/null 2>&1 || die "CF CLI not found — https://github.com/cloudfoundry/cli"
log "CF CLI: $(cf version | head -1)"

# ── 2. Load .env.local ────────────────────────────────────────────────────────
ENV_FILE=".env.local"
[ -f "$ENV_FILE" ] || die "$ENV_FILE not found. Copy .env.example → .env.local and fill in values."

# Export every non-comment, non-empty line
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# ── 3. Validate required variables ───────────────────────────────────────────
for var in CF_API CF_ORG CF_SPACE CF_APP_URL \
           MONGODB_URI NEXTAUTH_SECRET NEXTAUTH_URL \
           GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET; do
  [ -n "${!var:-}" ] || die "$var is not set in $ENV_FILE"
done

log "Target: $CF_API  |  Org: $CF_ORG  |  Space: $CF_SPACE"

# ── 4. Check for a valid CF session, login only if needed ─────────────────────
# Try targeting the org/space first — if the token is still valid this succeeds
# without touching the API endpoint (which can invalidate tokens).
if cf target -o "$CF_ORG" -s "$CF_SPACE" > /dev/null 2>&1; then
  log "Already authenticated. Using existing session."
else
  # Set API endpoint only when we actually need to (re-)authenticate
  cf api "$CF_API" --skip-ssl-validation 2>/dev/null || cf api "$CF_API"
  warn "No valid CF session found. Starting SSO login..."
  echo ""
  cf login --sso -a "$CF_API" -o "$CF_ORG" -s "$CF_SPACE"
fi

# ── 6. Build ─────────────────────────────────────────────────────────────────
log "Installing dependencies..."
npm ci --prefer-offline 2>/dev/null || npm ci

log "Building Next.js (standalone)..."
npm run build

[ -d ".next/standalone" ] || die ".next/standalone not found. Check next.config.ts has output: 'standalone'"

log "Copying static assets into standalone..."
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static

# ── 6b. Strip native-only modules & write a minimal package.json ─────────────
# Next.js standalone traces node_modules but does NOT include build/install
# scripts for native modules like sharp. The CF nodejs_buildpack runs
# `npm rebuild` on vendored node_modules, which fails when those scripts are
# missing. Fix: physically remove native modules we don't need at runtime
# (image optimisation is disabled via next.config.ts) and replace the
# package.json with a minimal one so the buildpack doesn't try to install or
# rebuild anything.

log "Removing native modules not needed at runtime (sharp, @img, SWC)..."
rm -rf .next/standalone/node_modules/sharp \
       .next/standalone/node_modules/@img \
       .next/standalone/node_modules/@next/swc-* \
       .next/standalone/node_modules/@swc

# Replace the standalone package.json with a minimal stub — NO dependencies.
# The CF nodejs_buildpack runs `npm install` on whatever package.json it finds.
# If dependencies are listed it will overwrite or conflict with the already-
# vendored node_modules that Next.js standalone bundled at build time.
# With no dependencies, `npm install` is a no-op and the vendored modules stay.
# Also remove package-lock.json because `npm ci` would delete node_modules first.
node -e "
  const stub = {
    name: 'ai-day-planner',
    version: '1.0.0',
    private: true,
    engines: { node: '20.x' }
  };
  require('fs').writeFileSync(
    './.next/standalone/package.json',
    JSON.stringify(stub, null, 2) + '\n'
  );
"
rm -f .next/standalone/package-lock.json
log "Wrote minimal standalone/package.json (no deps — buildpack npm install is a no-op)"

# Write a .cfignore as a safety net (prevents re-uploading if dirs re-appear).
cat > .next/standalone/.cfignore <<'EOF'
node_modules/@next/swc-*
node_modules/@swc/
node_modules/sharp
node_modules/@img/
EOF

# ── 7. Push (no-start) ───────────────────────────────────────────────────────
log "Pushing to CF..."
cf push --no-start

# Detect app name from manifest
APP_NAME=$(grep -E '^\s*- name:' manifest.yml | head -1 | sed 's/.*name: *//' | tr -d '[:space:]')
[ -n "$APP_NAME" ] || die "Could not read app name from manifest.yml"
log "App: $APP_NAME"

# ── 8. Set environment variables ─────────────────────────────────────────────
# Override NEXTAUTH_URL with the public CF app URL (not localhost).
log "Setting environment variables..."
cf set-env "$APP_NAME" NODE_ENV             production
cf set-env "$APP_NAME" MONGODB_URI          "$MONGODB_URI"
cf set-env "$APP_NAME" NEXTAUTH_SECRET      "$NEXTAUTH_SECRET"
cf set-env "$APP_NAME" NEXTAUTH_URL         "$CF_APP_URL"
cf set-env "$APP_NAME" GOOGLE_CLIENT_ID     "$GOOGLE_CLIENT_ID"
cf set-env "$APP_NAME" GOOGLE_CLIENT_SECRET "$GOOGLE_CLIENT_SECRET"

# ── 9. Start ──────────────────────────────────────────────────────────────────
log "Starting $APP_NAME..."
cf start "$APP_NAME"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
log "Deployment complete!"
echo ""
echo -e "  App URL : ${GREEN}$CF_APP_URL${NC}"
echo ""
warn "Make sure this redirect URI is in your Google Cloud Console credentials:"
echo -e "  ${YELLOW}$CF_APP_URL/api/auth/callback/google${NC}"
echo ""
log "Useful commands:"
echo "  cf logs $APP_NAME --recent"
echo "  cf app  $APP_NAME"
