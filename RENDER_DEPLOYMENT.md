# Render Deployment Guide — SortedPlan

Production deployment of the SortedPlan web app to [Render](https://render.com)
via the `render.yaml` Blueprint. The native iOS/Android shells load this
deployed web app.

```
┌────────────────────┐        HTTPS        ┌────────────────────────────┐
│  iOS / Android app │  ───────────────▶   │  Next.js on Render (web)   │
│  (Capacitor shell) │                     │  + managed Postgres        │
└────────────────────┘                     └────────────────────────────┘
```

---

## One-time setup

### 1. Create the Render account + project

1. Sign in at [dashboard.render.com](https://dashboard.render.com).
2. **New +** → **Blueprint** → connect this GitHub repo.
3. Render reads `render.yaml` and shows you the plan: `sortedplan-web` (web
   service) + `sortedplan-db` (PostgreSQL). Click **Apply**.

Render creates:
- The Postgres instance (`basic-256mb` plan — bump in `render.yaml` for prod
  traffic).
- The web service with `buildCommand` and `startCommand` from the blueprint.
- A `preDeployCommand` hook that runs `node migrate-runner.js` before each
  deploy switches traffic.

It will fail the first deploy because the secrets aren't set yet. That's expected — go to step 2.

### 2. Set the secrets

Render Dashboard → `sortedplan-web` → **Environment** → add each of these.
`DATABASE_URL` and `NEXTAUTH_URL` are wired automatically by the blueprint.

| Key | Value |
|---|---|
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_SECRET` | same value as `AUTH_SECRET` |
| `ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — 64 hex chars |
| `GOOGLE_CLIENT_ID` | Web OAuth client ID from Google Cloud |
| `GOOGLE_CLIENT_SECRET` | Web OAuth client secret |
| `GOOGLE_IOS_CLIENT_ID` | `650060721357-j01pfklfe15a5be1aacc408v5j9dpon2.apps.googleusercontent.com` |
| `GOOGLE_ANDROID_CLIENT_ID` | `650060721357-6dl26dt2jq4h5ibm9nostlt8q8pdt1u0.apps.googleusercontent.com` |
| `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Same as `GOOGLE_CLIENT_ID` |
| `NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Same as `GOOGLE_IOS_CLIENT_ID` |

⚠️ `NEXT_PUBLIC_*` values are inlined at **build time**. After setting them,
**Manual Deploy → Clear build cache & deploy** so a fresh bundle picks them up.

### 3. Add the Google redirect URI

In Google Cloud Console → APIs & Services → Credentials → your **Web** OAuth
client → Authorized redirect URIs, add:

```
https://sortedplan-web.onrender.com/api/auth/callback/google
```

(The exact URL is shown in the Render dashboard once the service is deployed —
it ends in `.onrender.com` unless you've attached a custom domain.)

### 4. Verify

```bash
curl -i https://sortedplan-web.onrender.com/api/health
# expect: 200 OK
```

Sign in via the deployed UI to smoke-test the full OAuth round-trip.

---

## Continuous deployment

Once Step 1 is done, every push to `main` triggers:

1. `npm ci && npx prisma generate && npm run build` (Render builder)
2. `node migrate-runner.js` (Render preDeploy — runs **before** traffic switch)
3. New web container goes live; old one is drained.

If migrations fail, Render **does not** switch traffic. The previous build
keeps serving.

The `.github/workflows/deploy-render.yml` GitHub Action additionally pings the
Render Deploy Hook (set `RENDER_DEPLOY_HOOK_URL` repo secret) so the deploy
record is captured in Actions.

---

## Backing up the database

Render Dashboard → `sortedplan-db` → **Backups** — daily auto-backups on the
`basic-256mb` plan. Snapshots include WAL up to 5 minutes.

Manual export:

```bash
# Render gives you a Postgres connection string in the Info panel
pg_dump "$RENDER_DB_EXTERNAL_URL" > backup-$(date +%Y%m%d).sql
```

---

## Custom domain (optional)

Dashboard → service → **Settings** → **Custom Domains** → add your domain →
follow the DNS instructions (CNAME `your-domain.com → sortedplan-web.onrender.com`).
Render handles TLS via Let's Encrypt.

After the domain resolves, also:

1. Update `NEXTAUTH_URL` in env vars to the new URL.
2. Add `https://your-domain.com/api/auth/callback/google` to the Google OAuth
   client's Authorized redirect URIs.
3. Rebuild (`Manual Deploy → Clear build cache & deploy`).

---

## Local development

Render isn't required for local dev. Use a local Postgres:

```bash
# Docker
docker run --name sortedplan-pg -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:16

# Or Render external DB connection string (slower, but always-fresh data)
# Get it from Dashboard → sortedplan-db → External Connection
```

Then:

```bash
cp .env.example .env.local         # fill in the values
node migrate-runner.js              # apply migrations to local DB
npm run dev                         # http://localhost:3000
```

---

## Scaling notes

- **Web service** — `starter` plan never sleeps. Scale up to `standard` or
  enable autoscaling once usage warrants. Edit `render.yaml` and push, or use
  the dashboard.
- **Database** — `basic-256mb` is fine for early stages. Upgrade plan in
  `render.yaml`; Render does an in-place resize with brief downtime.
- **Multi-instance caveat** — the in-memory rate limiter and SAP OAuth token
  cache are per-process. With multiple instances, both buckets are
  per-instance — abuse from one source could get `instances × limit`. Move to
  Render Redis for true multi-instance enforcement when scaling out.

---

## Rollback

Render keeps every successful build. Dashboard → service → **Manual Deploy** →
pick any previous successful deploy → **Deploy**. Migrations are NOT rolled
back automatically; if a deploy ran a destructive migration, restore the DB
from a snapshot first.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Build fails on `npx prisma generate` | Missing `@prisma/client` in deps | `npm i @prisma/client` then push |
| `ENCRYPTION_KEY must be 64-character hex` | Key not set or wrong format | Re-generate and set in env |
| 500 on first request after deploy | Migration failed but somehow didn't block | Check `sortedplan-web` Logs → preDeploy section |
| OAuth redirect loop | Redirect URI not registered | Add the exact `https://…/api/auth/callback/google` |
| `DATABASE_URL` undefined | DB linkage broken | Re-apply Blueprint or set env var manually |
| Slow cold starts | On the `free` tier — service sleeps after 15min | Upgrade to `starter` |
