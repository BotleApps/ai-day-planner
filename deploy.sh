#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Deploy AI Day Planner to SAP BTP Cloud Foundry
#
# Usage:
#   ./deploy.sh <env>          # env = dev | qual | prod
#   ./deploy.sh dev            # Deploy to development space
#   ./deploy.sh qual           # Deploy to qualification space
#   ./deploy.sh prod           # Deploy to production space
#
# Environment routing is read from cf-environments.conf (non-sensitive).
# Secrets are read from .env.<env>.local, falling back to .env.local.
#
# Required secret variables (in .env.<env>.local or .env.local):
#   CF_APP_URL           — Full HTTPS URL of this CF app
#   CF_DB_SERVICE_NAME   — CF PostgreSQL service instance name
#   NEXTAUTH_SECRET      — Random secret (openssl rand -base64 32)
#   NEXTAUTH_URL         — Same as CF_APP_URL
#   GOOGLE_CLIENT_ID     — Google OAuth client ID
#   GOOGLE_CLIENT_SECRET — Google OAuth client secret
#   ENCRYPTION_KEY       — Optional: encryption key for AI settings
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
log()    { echo -e "${GREEN}[deploy]${NC} $*"; }
info()   { echo -e "${CYAN}[deploy]${NC} $*"; }
warn()   { echo -e "${YELLOW}[deploy]${NC} $*"; }
die()    { echo -e "${RED}[deploy] ERROR:${NC} $*" >&2; exit 1; }
banner() { echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${CYAN}  $*${NC}"; echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"; }

# ── 0. Parse environment argument ─────────────────────────────────────────────
ENV="${1:-}"
if [[ -z "$ENV" ]]; then
  echo -e "${RED}Usage: ./deploy.sh <env>${NC}"
  echo -e "  Environments: ${YELLOW}dev${NC} | ${YELLOW}qual${NC} | ${YELLOW}prod${NC}"
  echo ""
  echo -e "  Example: ${GREEN}./deploy.sh dev${NC}"
  exit 1
fi

case "$ENV" in
  dev|qual|prod) ;;
  *) die "Unknown environment '$ENV'. Must be one of: dev, qual, prod" ;;
esac

ENV_UPPER=$(echo "$ENV" | tr '[:lower:]' '[:upper:]')
banner "Deploying AI Day Planner → ${ENV_UPPER}"

# ── 1. Require CF CLI ─────────────────────────────────────────────────────────
command -v cf >/dev/null 2>&1 || die "CF CLI not found — https://github.com/cloudfoundry/cli"
log "CF CLI: $(cf version | head -1)"

# ── 2. Load cf-environments.conf ─────────────────────────────────────────────
CONF_FILE="cf-environments.conf"
[ -f "$CONF_FILE" ] || die "$CONF_FILE not found. Run from the project root."

set -a
# shellcheck disable=SC1090
source "$CONF_FILE"
set +a

# Resolve env-specific CF variables using indirect reference
CF_API_VAR="${ENV_UPPER}_CF_API";    CF_API="${!CF_API_VAR:-}"
CF_ORG_VAR="${ENV_UPPER}_CF_ORG";    CF_ORG="${!CF_ORG_VAR:-}"
CF_SPACE_VAR="${ENV_UPPER}_CF_SPACE"; CF_SPACE="${!CF_SPACE_VAR:-}"
MTAEXT_VAR="${ENV_UPPER}_MTAEXT";    MTAEXT="${!MTAEXT_VAR:-}"
CF_SSO_URL_VAR="${ENV_UPPER}_CF_SSO_URL"; CF_SSO_URL="${!CF_SSO_URL_VAR:-}"

[ -n "$CF_API"   ] || die "$CF_API_VAR   is not set in $CONF_FILE"
[ -n "$CF_ORG"   ] || die "$CF_ORG_VAR   is not set in $CONF_FILE"
[ -n "$CF_SPACE" ] || die "$CF_SPACE_VAR is not set in $CONF_FILE"

info "CF API   : $CF_API"
info "CF Org   : $CF_ORG"
info "CF Space : $CF_SPACE"
[ -n "$MTAEXT" ] && info "MTA ext  : $MTAEXT"

# ── 3. Load secrets (.env.<env>.local → .env.local fallback) ─────────────────
ENV_FILE=".env.${ENV}.local"
if [ -f "$ENV_FILE" ]; then
  log "Loading secrets from $ENV_FILE"
else
  ENV_FILE=".env.local"
  warn "No .env.${ENV}.local found — falling back to $ENV_FILE"
fi
[ -f "$ENV_FILE" ] || die "$ENV_FILE not found. Create it with your secrets."

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# ── 4. Validate required secret variables ────────────────────────────────────
for var in CF_APP_URL CF_DB_SERVICE_NAME \
           NEXTAUTH_SECRET NEXTAUTH_URL \
           GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET; do
  [ -n "${!var:-}" ] || die "$var is not set in $ENV_FILE"
done

log "App URL  : $CF_APP_URL"
log "DB svc   : $CF_DB_SERVICE_NAME"

# ── 5. Authenticate with CF ───────────────────────────────────────────────────
banner "CF Authentication"

cf api "$CF_API" --skip-ssl-validation 2>/dev/null || cf api "$CF_API"

if cf target -o "$CF_ORG" -s "$CF_SPACE" > /dev/null 2>&1; then
  log "Already authenticated — targeting Org=$CF_ORG | Space=$CF_SPACE"
else
  warn "No valid CF session found. Starting SSO login..."
  [ -n "$CF_SSO_URL" ] && info "SSO URL: $CF_SSO_URL"
  cf login --sso -a "$CF_API" -o "$CF_ORG" -s "$CF_SPACE"
fi

# ── 6. Ensure PostgreSQL service exists ───────────────────────────────────────
banner "Provisioning PostgreSQL"

if cf service "$CF_DB_SERVICE_NAME" > /dev/null 2>&1; then
  log "PostgreSQL service '$CF_DB_SERVICE_NAME' already exists."
else
  log "Creating PostgreSQL service '$CF_DB_SERVICE_NAME' (plan: development)..."
  cf create-service postgresql-db development "$CF_DB_SERVICE_NAME"
  log "Waiting for service to be ready (up to 5 min)..."
  for i in $(seq 1 30); do
    STATUS=$(cf service "$CF_DB_SERVICE_NAME" | grep -i "status:" | awk '{print $2}' || true)
    if [ "$STATUS" != "create" ]; then log "Service ready."; break; fi
    echo "  ... waiting (${i}/30)"; sleep 10
  done
fi

# ── 7. Extract DATABASE_URL from CF service key ───────────────────────────────
log "Extracting DATABASE_URL from service key..."
SERVICE_KEY="${CF_DB_SERVICE_NAME}-deploy-key"
cf create-service-key "$CF_DB_SERVICE_NAME" "$SERVICE_KEY" 2>/dev/null || true
DB_CREDS=$(cf service-key "$CF_DB_SERVICE_NAME" "$SERVICE_KEY" | tail -n +3)

DATABASE_URL=$(echo "$DB_CREDS" | node -e "
let d='';
process.stdin.on('data',c=>d+=c).on('end',()=>{
  const j=JSON.parse(d);
  const cr=j.credentials||j;
  if(cr.uri)  { console.log(cr.uri); return; }
  if(cr.url)  { console.log(cr.url); return; }
  const host=cr.hostname||cr.host;
  const port=cr.port||5432;
  const name=cr.dbname||cr.name||cr.database||cr.db;
  const user=cr.username||cr.user;
  const pass=encodeURIComponent(cr.password||'');
  console.log('postgresql://'+user+':'+pass+'@'+host+':'+port+'/'+name+'?sslmode=require');
});
")
export DATABASE_URL
log "DATABASE_URL derived from service binding."

# ── 8. Build ──────────────────────────────────────────────────────────────────
banner "Building"

log "Installing dependencies..."
npm ci --prefer-offline 2>/dev/null || npm ci

log "Generating Prisma client..."
./node_modules/.bin/prisma generate

log "Building Next.js (standalone)..."
npm run build

[ -d ".next/standalone" ] || die ".next/standalone not found. Ensure next.config.ts has output: 'standalone'"

log "Copying static assets into standalone..."
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static

cp migrate-runner.js .next/standalone/migrate-runner.js

log "Copying Prisma into standalone..."
cp -r node_modules/.prisma     .next/standalone/node_modules/.prisma     2>/dev/null || true
cp -r node_modules/@prisma     .next/standalone/node_modules/@prisma     2>/dev/null || true
cp -r node_modules/prisma      .next/standalone/node_modules/prisma      2>/dev/null || true
mkdir -p .next/standalone/prisma
cp -r prisma/migrations        .next/standalone/prisma/migrations        2>/dev/null || true
cp    prisma/schema.prisma     .next/standalone/prisma/schema.prisma     2>/dev/null || true
cp    prisma.config.ts         .next/standalone/prisma.config.ts         2>/dev/null || true

log "Copying pg driver into standalone..."
for pkg in pg pg-pool pg-protocol pg-types pgpass; do
  cp -r "node_modules/$pkg" ".next/standalone/node_modules/$pkg" 2>/dev/null || true
done

log "Copying pdf-parse and officeparser into standalone..."
cp -r node_modules/pdf-parse    .next/standalone/node_modules/pdf-parse    2>/dev/null || true
cp -r node_modules/officeparser .next/standalone/node_modules/officeparser 2>/dev/null || true

log "Creating Turbopack hash aliases in standalone node_modules..."
node -e "
const fs   = require('fs');
const path = require('path');
const chunksDir = '.next/server/chunks';
const modDir    = '.next/standalone/node_modules';
const seen = new Set();
for (const f of fs.readdirSync(chunksDir)) {
  if (!f.endsWith('.js')) continue;
  const src = fs.readFileSync(path.join(chunksDir, f), 'utf8');
  const re = /[\"'](@[^/\"']+\/[^\"']+|[a-z][a-z0-9_-]+)-([0-9a-f]{16})[\"']/g;
  let m;
  while ((m = re.exec(src)) !== null) seen.add(m[0].slice(1,-1));
}
for (const hashed of seen) {
  const real = hashed.replace(/-[0-9a-f]{16,}\$/, '');
  let realDir, dest;
  if (real.startsWith('@')) {
    const hashedScope = hashed.split('/')[0];
    const hashedPkg   = hashed.split('/').slice(1).join('/');
    const [scope, pkg] = real.split('/');
    realDir = path.join(modDir, scope, pkg);
    dest    = path.join(modDir, hashedScope, hashedPkg);
  } else {
    realDir = path.join(modDir, real);
    dest    = path.join(modDir, hashed);
  }
  if (!fs.existsSync(realDir)) { console.log('  skip (no source):', real); continue; }
  if (fs.existsSync(dest))     { console.log('  already exists:', hashed); continue; }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(realDir, dest, { recursive: true });
  console.log('  aliased:', real, '->', hashed);
}
"

log "Removing native modules not needed at runtime..."
rm -rf .next/standalone/node_modules/sharp \
       .next/standalone/node_modules/@img \
       .next/standalone/node_modules/@next/swc-* \
       .next/standalone/node_modules/@swc

node -e "
  const fs = require('fs');
  const v = (pkg) => {
    try { return JSON.parse(fs.readFileSync('./node_modules/' + pkg + '/package.json', 'utf8')).version; }
    catch(e) { return '*'; }
  };
  const stub = {
    name: 'ai-day-planner',
    version: '1.0.0',
    private: true,
    engines: { node: '20.x' },
    dependencies: {
      'next':                v('next'),
      'pg':                  v('pg'),
      '@prisma/client':      v('@prisma/client'),
      '@prisma/adapter-pg':  v('@prisma/adapter-pg'),
      'pdf-parse':           v('pdf-parse'),
      'officeparser':        v('officeparser'),
    },
    scripts: {}
  };
  fs.writeFileSync('./.next/standalone/package.json', JSON.stringify(stub, null, 2) + '\n');
"
rm -f .next/standalone/package-lock.json

cat > .next/standalone/.npmrc   <<'EOF'
ignore-scripts=true
EOF

cat > .next/standalone/.cfignore <<'EOF'
node_modules/@next/swc-*
node_modules/@swc/
node_modules/sharp
node_modules/@img/
EOF

log "Build complete."

# ── 9. Push (no-start) ────────────────────────────────────────────────────────
banner "Pushing to CF [$ENV_UPPER]"

APP_NAME="ai-day-planner"
log "Pushing $APP_NAME (no-start)..."
cf push "$APP_NAME" \
  --no-start \
  -p .next/standalone \
  -b nodejs_buildpack \
  -m 512M \
  -k 1024M \
  --health-check-type http \
  --endpoint /api/health \
  -c "node server.js"

# ── 10. Bind PostgreSQL service ───────────────────────────────────────────────
log "Binding PostgreSQL service '$CF_DB_SERVICE_NAME'..."
cf bind-service "$APP_NAME" "$CF_DB_SERVICE_NAME" 2>/dev/null || log "Service already bound."

# ── 11. Set environment variables ─────────────────────────────────────────────
log "Setting environment variables..."
NODE_ENV_VALUE="$([ "$ENV" = "dev" ] && echo "development" || echo "production")"
cf set-env "$APP_NAME" NODE_ENV             "$NODE_ENV_VALUE"
cf set-env "$APP_NAME" DATABASE_URL         "$DATABASE_URL"
cf set-env "$APP_NAME" NEXTAUTH_SECRET      "$NEXTAUTH_SECRET"
cf set-env "$APP_NAME" NEXTAUTH_URL         "$CF_APP_URL"
cf set-env "$APP_NAME" GOOGLE_CLIENT_ID     "$GOOGLE_CLIENT_ID"
cf set-env "$APP_NAME" GOOGLE_CLIENT_SECRET "$GOOGLE_CLIENT_SECRET"
[ -n "${ENCRYPTION_KEY:-}" ] && cf set-env "$APP_NAME" ENCRYPTION_KEY "$ENCRYPTION_KEY"

# ── 12. Start the app ─────────────────────────────────────────────────────────
log "Starting $APP_NAME..."
cf start "$APP_NAME"

# ── 13. Run Prisma migrations as a CF task ─────────────────────────────────────
banner "Running DB Migrations"

TASK_NAME="prisma-migrate-$(date +%s)"
cf run-task "$APP_NAME" \
  --command "node migrate-runner.js" \
  --name "$TASK_NAME" \
  -m 256M

log "Waiting for migration task (up to 5 min)..."
for i in $(seq 1 60); do
  TASK_STATE=$(cf tasks "$APP_NAME" | grep "$TASK_NAME" | awk '{print $3}' || true)
  if [ "$TASK_STATE" = "SUCCEEDED" ]; then
    log "Migrations complete."
    break
  elif [ "$TASK_STATE" = "FAILED" ]; then
    warn "Migration task failed. Recent logs:"
    cf logs "$APP_NAME" --recent 2>&1 | grep -A5 "$TASK_NAME" | tail -30
    die "Migrations failed — fix the issue and redeploy."
  fi
  echo "  ... task state: ${TASK_STATE:-pending} (${i}/60)"
  sleep 5
done

# ── Done ──────────────────────────────────────────────────────────────────────
banner "Deployment Complete [$ENV_UPPER]"

echo -e "  Environment : ${CYAN}${ENV_UPPER}${NC}"
echo -e "  App URL     : ${GREEN}$CF_APP_URL${NC}"
echo -e "  CF Org      : $CF_ORG"
echo -e "  CF Space    : $CF_SPACE"
echo ""
warn "Ensure this Google OAuth redirect URI is registered:"
echo -e "  ${YELLOW}$CF_APP_URL/api/auth/callback/google${NC}"
echo ""
log "Useful commands:"
echo "  cf logs   $APP_NAME --recent"
echo "  cf tasks  $APP_NAME"
echo "  cf app    $APP_NAME"
echo "  cf events $APP_NAME"
