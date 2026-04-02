#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Deploy AI Day Planner to SAP BTP Cloud Foundry
#
# Uses PostgreSQL on SAP BTP (bound via CF service binding).
# DATABASE_URL is derived from the CF service binding credentials.
# Migrations run inside CF as a task (the DB is not reachable from local).
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

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# ── 3. Validate required variables ───────────────────────────────────────────
for var in CF_API CF_ORG CF_SPACE CF_APP_URL CF_DB_SERVICE_NAME \
           NEXTAUTH_SECRET NEXTAUTH_URL \
           GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET; do
  [ -n "${!var:-}" ] || die "$var is not set in $ENV_FILE"
done

log "Target: $CF_API  |  Org: $CF_ORG  |  Space: $CF_SPACE"

# ── 4. Check for a valid CF session, login only if needed ─────────────────────
if cf target -o "$CF_ORG" -s "$CF_SPACE" > /dev/null 2>&1; then
  log "Already authenticated. Using existing session."
else
  cf api "$CF_API" --skip-ssl-validation 2>/dev/null || cf api "$CF_API"
  warn "No valid CF session found. Starting SSO login..."
  echo ""
  cf login --sso -a "$CF_API" -o "$CF_ORG" -s "$CF_SPACE"
fi

# ── 5. Ensure PostgreSQL service exists ───────────────────────────────────────
if cf service "$CF_DB_SERVICE_NAME" > /dev/null 2>&1; then
  log "PostgreSQL service '$CF_DB_SERVICE_NAME' already exists."
else
  log "Creating PostgreSQL service '$CF_DB_SERVICE_NAME' (plan: development)..."
  cf create-service postgresql-db development "$CF_DB_SERVICE_NAME"
  log "Waiting for service to be ready..."
  for i in $(seq 1 30); do
    STATUS=$(cf service "$CF_DB_SERVICE_NAME" | grep -i "status:" | awk '{print $2}' || true)
    [ "$STATUS" = "create" ] && sleep 10 || break
  done
fi

# ── 6. Extract DATABASE_URL from CF service key ───────────────────────────────
# The RDS instance is inside the CF private network — not reachable from local.
# We still extract the URL here so we can pass it as an env var to the app.
# Migrations will run as a CF task (step 12) where the DB is reachable.
SERVICE_KEY="${CF_DB_SERVICE_NAME}-deploy-key"
cf create-service-key "$CF_DB_SERVICE_NAME" "$SERVICE_KEY" 2>/dev/null || true
# Skip the CF CLI header line(s) to get pure JSON
DB_CREDS=$(cf service-key "$CF_DB_SERVICE_NAME" "$SERVICE_KEY" | tail -n +3)

DATABASE_URL=$(echo "$DB_CREDS" | node -e "
let d='';
process.stdin.on('data',c=>d+=c).on('end',()=>{
  const j=JSON.parse(d);
  // SAP BTP wraps fields under 'credentials'; some services return flat JSON
  const cr=j.credentials||j;
  // Use a ready-made uri/url if provided
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
log "Database URL derived from service binding."

# ── 7. Build ──────────────────────────────────────────────────────────────────
log "Installing dependencies..."
npm ci --prefer-offline 2>/dev/null || npm ci

log "Generating Prisma client..."
npx prisma generate

log "Building Next.js (standalone)..."
npm run build

[ -d ".next/standalone" ] || die ".next/standalone not found. Check next.config.ts has output: 'standalone'"

log "Copying static assets into standalone..."
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static

# Copy migration runner (standalone JS script — no Prisma CLI needed)
cp migrate-runner.js .next/standalone/migrate-runner.js

# Copy Prisma client + CLI into standalone (CLI is needed for the migrate task)
log "Copying Prisma into standalone..."
cp -r node_modules/.prisma     .next/standalone/node_modules/.prisma     2>/dev/null || true
cp -r node_modules/@prisma     .next/standalone/node_modules/@prisma     2>/dev/null || true
cp -r node_modules/prisma      .next/standalone/node_modules/prisma      2>/dev/null || true
mkdir -p .next/standalone/prisma
cp -r prisma/migrations        .next/standalone/prisma/migrations         2>/dev/null || true
cp    prisma/schema.prisma     .next/standalone/prisma/schema.prisma      2>/dev/null || true
cp    prisma.config.ts         .next/standalone/prisma.config.ts          2>/dev/null || true

# Copy pg driver and adapter (required for Prisma 7 WASM client engine)
log "Copying pg driver into standalone..."
cp -r node_modules/pg          .next/standalone/node_modules/pg          2>/dev/null || true
cp -r node_modules/pg-pool     .next/standalone/node_modules/pg-pool     2>/dev/null || true
cp -r node_modules/pg-protocol .next/standalone/node_modules/pg-protocol 2>/dev/null || true
cp -r node_modules/pg-types    .next/standalone/node_modules/pg-types    2>/dev/null || true
cp -r node_modules/pgpass      .next/standalone/node_modules/pgpass      2>/dev/null || true

# Turbopack appends a content-hash to scoped package names in the bundle (e.g.
# @prisma/adapter-pg-<hash>). Scan the built chunks and create alias directories
# in standalone/node_modules so Node can resolve the hashed names at runtime.
log "Creating Turbopack hash aliases in standalone node_modules..."
node -e "
const fs   = require('fs');
const path = require('path');
const chunksDir = '.next/server/chunks';
const modDir    = '.next/standalone/node_modules';

// Find all hashed @-scoped package names used in the bundle
const seen = new Set();
for (const f of fs.readdirSync(chunksDir)) {
  if (!f.endsWith('.js')) continue;
  const src = fs.readFileSync(path.join(chunksDir, f), 'utf8');
  const re = /[\"'](@[^/\"']+\/[^\"']*)-([0-9a-f]{16})[\"']/g;
  let m;
  while ((m = re.exec(src)) !== null) seen.add(m[0].slice(1,-1));
}

for (const hashed of seen) {
  // Strip the trailing -<hex> to get the real package name
  const real = hashed.replace(/-[0-9a-f]{16,}$/, '');
  // Resolve scope dir (e.g. @prisma)
  const [scope, pkg] = real.split('/');
  const realDir  = path.join(modDir, scope, pkg);
  const aliasDir = path.join(modDir, hashed.split('/')[0] ?? '', hashed.includes('/') ? hashed.split('/').slice(1).join('/') : hashed);

  // For scoped packages like @prisma/adapter-pg-<hash>
  const hashedScope = hashed.split('/')[0];       // '@prisma'
  const hashedPkg   = hashed.split('/').slice(1).join('/');  // 'adapter-pg-<hash>'
  const dest        = path.join(modDir, hashedScope, hashedPkg);

  if (!fs.existsSync(realDir)) { console.log('  skip (no source):', real); continue; }
  if (fs.existsSync(dest))     { console.log('  already exists:', hashed); continue; }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  // Copy the real package dir to the hashed name
  fs.cpSync(realDir, dest, { recursive: true });
  console.log('  aliased:', real, '->', hashed);
}
"

log "Removing native modules not needed at runtime (sharp, @img, SWC)..."
rm -rf .next/standalone/node_modules/sharp \
       .next/standalone/node_modules/@img \
       .next/standalone/node_modules/@next/swc-* \
       .next/standalone/node_modules/@swc

node -e "
  const fs = require('fs');
  // Read versions from local node_modules for all packages needed at runtime
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
      // Next.js server
      'next': v('next'),
      // PostgreSQL driver (for migrate-runner.js and @prisma/adapter-pg)
      'pg': v('pg'),
      // Prisma runtime packages (prevent buildpack from pruning them)
      '@prisma/client':      v('@prisma/client'),
      '@prisma/adapter-pg':  v('@prisma/adapter-pg'),
    },
    scripts: {}
  };
  fs.writeFileSync('./.next/standalone/package.json', JSON.stringify(stub, null, 2) + '\n');
"
rm -f .next/standalone/package-lock.json
log "Wrote minimal standalone/package.json"

cat > .next/standalone/.npmrc <<'EOF'
ignore-scripts=true
EOF

cat > .next/standalone/.cfignore <<'EOF'
node_modules/@next/swc-*
node_modules/@swc/
node_modules/sharp
node_modules/@img/
EOF

# ── 8. Push (no-start) ───────────────────────────────────────────────────────
APP_NAME="ai-day-planner"
log "Pushing $APP_NAME to CF (no-start)..."
cf push "$APP_NAME" \
  --no-start \
  -p .next/standalone \
  -b nodejs_buildpack \
  -m 512M \
  -k 1024M \
  --health-check-type http \
  --endpoint /api/health \
  -c "node server.js"

# ── 9. Bind PostgreSQL service ────────────────────────────────────────────────
log "Binding PostgreSQL service..."
cf bind-service "$APP_NAME" "$CF_DB_SERVICE_NAME" 2>/dev/null || log "Service already bound."

# ── 10. Set environment variables ─────────────────────────────────────────────
log "Setting environment variables..."
cf set-env "$APP_NAME" NODE_ENV             production
cf set-env "$APP_NAME" DATABASE_URL         "$DATABASE_URL"
cf set-env "$APP_NAME" NEXTAUTH_SECRET      "$NEXTAUTH_SECRET"
cf set-env "$APP_NAME" NEXTAUTH_URL         "$CF_APP_URL"
cf set-env "$APP_NAME" GOOGLE_CLIENT_ID     "$GOOGLE_CLIENT_ID"
cf set-env "$APP_NAME" GOOGLE_CLIENT_SECRET "$GOOGLE_CLIENT_SECRET"

# ── 11. Start the app ────────────────────────────────────────────────────────
log "Starting $APP_NAME..."
cf start "$APP_NAME"

# ── 12. Run Prisma migrations as a CF task ────────────────────────────────────
# Run AFTER start so the new droplet (with migrate-runner.js) is active.
# The DB is inside CF's private network — only reachable from within CF.
log "Running Prisma migrations as CF task..."
TASK_NAME="prisma-migrate-$(date +%s)"
cf run-task "$APP_NAME" \
  --command "node migrate-runner.js" \
  --name "$TASK_NAME" \
  -m 256M

log "Waiting for migration task to complete..."
for i in $(seq 1 60); do
  TASK_STATE=$(cf tasks "$APP_NAME" | grep "$TASK_NAME" | awk '{print $3}' || true)
  if [ "$TASK_STATE" = "SUCCEEDED" ]; then
    log "Migrations complete."
    break
  elif [ "$TASK_STATE" = "FAILED" ]; then
    warn "Migration task failed. Checking task logs..."
    cf logs "$APP_NAME" --recent 2>&1 | grep -A5 "$TASK_NAME" | tail -30
    die "Migrations failed — fix the issue and redeploy."
  fi
  log "Migration task state: ${TASK_STATE:-pending}... (${i}/60)"
  sleep 5
done

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
echo "  cf tasks $APP_NAME"
echo "  cf app   $APP_NAME"
