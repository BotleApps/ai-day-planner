# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev            # Start Next.js dev server (http://localhost:3000)
npm run build          # Production build (Next.js standalone)
npm run lint           # ESLint check
npm run lint:fix       # ESLint auto-fix
npm run type-check     # TypeScript check without emit
npm test               # Vitest — run once
npm run test:watch     # Vitest — watch mode
npm run test:coverage  # Vitest with v8 coverage (writes coverage/)
npm run audit:ci       # npm audit (high+ severity, prod deps)

# Database migrations (no Prisma CLI installed — use the custom runner)
node migrate-runner.js   # Apply pending migrations (requires DATABASE_URL)

# Mobile (Capacitor — remote-server pattern)
CAP_SERVER_URL="https://sortedplan-web.onrender.com" npx cap sync
npm run mobile:ios       # Boot dev server, point at localhost:3000, open iOS sim
npm run mobile:android   # Boot dev server, point at 10.0.2.2:3000, open emulator
npm run cap:add:android  # One-time scaffold (writes android/)
./scripts/wire-ios-oauth.sh com.googleusercontent.apps.<id>  # Wire iOS OAuth URL scheme
```

## Required Environment Variables

See [.env.example](.env.example) for the full annotated list. Minimum to run:

```env
DATABASE_URL=postgresql://...         # PostgreSQL connection string
AUTH_SECRET=...                       # NextAuth — `openssl rand -base64 32`
NEXTAUTH_SECRET=...                   # Same value (NextAuth v5 reads either)
NEXTAUTH_URL=http://localhost:3000    # Render injects RENDER_EXTERNAL_URL automatically
GOOGLE_CLIENT_ID=...                  # Web OAuth client
GOOGLE_CLIENT_SECRET=...
ENCRYPTION_KEY=...                    # 64-char hex (32 random bytes) for AES-256-GCM
NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID=...  # Inlined into JS bundle at build time
```

For native sign-in also set: `GOOGLE_IOS_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID`,
`NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID`.

## Deployment

**Production target: [Render](https://render.com)** — see [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md).
`render.yaml` is the Blueprint (IaC). Push to `main` → Render auto-deploys → migrations
run as `preDeployCommand` before traffic switches. The SAP BTP CF setup is archived
under [legacy/sap-cf/](legacy/sap-cf/).

## CI/CD (GitHub Actions)

- **[.github/workflows/ci.yml](.github/workflows/ci.yml)** — runs on every push/PR
  to main: ESLint, type-check, unit tests with coverage, Next.js build,
  `npm audit`, CodeQL (security-extended), gitleaks (secret scanning).
- **[.github/workflows/deploy-render.yml](.github/workflows/deploy-render.yml)**
  — on push to main: gates on CI, pings Render Deploy Hook, polls `/api/health`
  until the new revision is up.
- **[.github/workflows/build-ios.yml](.github/workflows/build-ios.yml)** —
  on `v*` tag or `ios/`/`mobile/`/`capacitor.config.ts` change: macOS runner,
  `cap sync`, `pod install`, signed archive + IPA if signing secrets present.
- **[.github/workflows/build-android.yml](.github/workflows/build-android.yml)**
  — on `v*` tag or `android/`/`mobile/`/`capacitor.config.ts` change: Ubuntu
  runner, `cap sync`, `./gradlew bundleRelease`, signed AAB if keystore present.

Dependabot ([.github/dependabot.yml](.github/dependabot.yml)) opens weekly PRs
for npm + GitHub Actions, monthly for iOS CocoaPods + Android Gradle.

## Architecture

**Stack:** Next.js 16 App Router · React 19 · TypeScript · Tailwind CSS 4 · Prisma 7 (PostgreSQL) · NextAuth v5 · Capacitor 7 · Vitest

### App Router layout (`app/`)

The single-page app lives at `app/page.tsx`. Navigation between views (plans,
checklists, tasks) is driven by URL search params (`?plan=`, `?checklist=`,
`?share=`, `?cshare=`) rather than separate routes. All authenticated API
surface lives under `app/api/`.

API route groups:
- `api/plans/` — CRUD for Plans + DayPlans + Activities; sub-routes for `share/`, `members/`
- `api/tasks/` — daily task management
- `api/checklists/` — Checklist CRUD; sub-routes for `items/`, `share/`, `members/`, `templates/`, `from-template/`
- `api/ai/` — AI chat/generation endpoints (server-side only, per-user rate-limited)
- `api/user-settings/` — AI provider settings (encrypted in DB; never returns plaintext secrets)
- `api/upload/` — file upload for itinerary parsing
- `api/auth/` — NextAuth handlers
- `api/health/` — health check (public — used by Render and middleware allowlist)

### Middleware

[middleware.ts](middleware.ts) enforces auth on all routes except:
- `/api/auth/*`, `/api/health/*` (always public)
- `/api/plans/*`, `/api/checklists/*`, `/api/activities/*` (handle their own auth so share-link viewing works)
- `/` (landing), `/templates/*` (public template browser)

State-changing API routes handle their own `auth()` checks. The middleware is
defence-in-depth.

### Auth

Two-config split for Edge runtime safety:
- [auth.config.ts](auth.config.ts) — edge-safe (Google OAuth, JWT strategy). Used by middleware.
- [auth.ts](auth.ts) — full Node config extending `authConfig` with the `google-native` Credentials provider that accepts Google ID tokens from the Capacitor mobile shell.

User identity = Google `sub` stored as `session.user.id` in the JWT. API routes
call `auth()` from `auth.ts` to get the session server-side.

`lib/verify-google-token.ts` accepts tokens whose `aud` matches any of
`GOOGLE_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`, or `GOOGLE_ANDROID_CLIENT_ID` — so
a user gets the same identity across web, iOS, and Android.

### Database

Prisma 7 with `@prisma/adapter-pg` (driver-adapter pattern — no native binaries
needed for Render's Node runtime). Global singleton in `lib/db.ts` prevents
connection exhaustion in dev. SSL strict by default; set
`DB_SSL_REJECT_UNAUTHORIZED=false` only for local dev with self-signed certs.

**Do not use `npx prisma migrate`** — the Prisma CLI is not installed. Use
`node migrate-runner.js` to apply migrations. Each migration runs in a
`BEGIN`/`COMMIT`/`ROLLBACK` transaction. Add new migrations as SQL files at
`prisma/migrations/<timestamp_name>/migration.sql`.

Schema models: `Plan`, `DayPlan`, `Activity`, `Task`, `Checklist`,
`ChecklistItem`, `ChecklistTemplate`, `ChecklistTemplateItem`, `SharedAccess`,
`ShareLink`, `SharedChecklistAccess`, `ChecklistShareLink`, `UserSettings`.

### AI Integration (`lib/`)

Two providers, both server-side only. Unified via `lib/ai-dispatch.ts`:

```ts
import { callAI } from '@/lib/ai-dispatch';
const result = await callAI(settings, systemPrompt, userMessage, maxTokens);
```

- **SAP AI Core** ([lib/sap-ai-core.ts](lib/sap-ai-core.ts)) — OAuth
  client-credentials flow, supports OpenAI/Bedrock/Vertex backends.
- **Google Gemini** ([lib/gemini.ts](lib/gemini.ts)) — direct Gemini API.

Provider selection + credentials stored in `UserSettings` (DB). Sensitive
fields (`clientSecretEnc`, `geminiApiKeyEnc`) are AES-256-GCM encrypted via
[lib/crypto.ts](lib/crypto.ts) using `ENCRYPTION_KEY`. **The GET response
never includes plaintext secrets** — only `clientSecretConfigured` boolean
flags and 4-char hints for display. Client never sends secrets in AI request
bodies; the server loads them from DB per-request.

### Rate Limiting

[lib/rate-limit.ts](lib/rate-limit.ts) — minimal in-memory token-bucket per
process. Applied to:
- AI routes: 10–20/min per user
- Upload: 30/min per user
- Unauthenticated share-link lookups: 60/min per IP

For multi-instance deployments, swap to Redis (e.g. @upstash/ratelimit).

### Sharing model

Both Plans and Checklists support share links + per-user access control:
- `ShareLink` / `ChecklistShareLink` — tokenized links with `view`/`edit` permissions. Tokens are `crypto.randomBytes(24).toString('base64url')`.
- `SharedAccess` / `SharedChecklistAccess` — per-user resolved permission records.
- [lib/checklist-access.ts](lib/checklist-access.ts) provides
  `resolveChecklistPermission()` — single-query permission resolution. Use it
  in API routes rather than re-implementing the check.

### Mobile (Capacitor — "remote server" pattern)

The native iOS/Android shell loads the deployed web app over HTTPS (set via
`CAP_SERVER_URL` at sync time). There is no static export. The fallback
`mobile/www/index.html` is only shown when no server URL is configured.

Native Google Sign-In ([lib/native-google-auth.ts](lib/native-google-auth.ts))
posts an ID token to the `google-native` Credentials provider rather than
using a browser OAuth redirect (Google blocks OAuth in WebViews).

See [MOBILE_OAUTH_SETUP.md](MOBILE_OAUTH_SETUP.md) for the per-platform OAuth
client setup checklist.

### Testing

Vitest with v8 coverage. Tests in `tests/` cover the pure libs (crypto,
rate-limit, utils, ai-settings, ai-dispatch, verify-google-token). The CI
threshold is 70% lines/functions/statements on the covered files.

UI/integration testing is the next-iteration task (jsdom + msw + Playwright).

### Key conventions

- API routes authenticate with `const session = await auth()` and return 401 if `!session?.user?.id`.
- All user-scoped DB queries must filter by `userId` — never trust client-supplied IDs alone.
- `lib/sap-ai-core.ts`, `lib/gemini.ts`, and `lib/ai-dispatch.ts` are server-only — never import in client components.
- Mutations that touch >1 row should run inside `prisma.$transaction`.
- Generate IDs with `generateId()` (UUID v4) and share tokens with `generateShareToken()` (24 random bytes, base64url). Both from `lib/utils.ts`. Never `Math.random()`.
- Theme via `components/theme-provider.tsx` (next-themes); use CSS variables / Tailwind dark-mode classes.

## Related docs

- [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) — production deployment
- [MOBILE_DEPLOYMENT.md](MOBILE_DEPLOYMENT.md) — building the native apps
- [MOBILE_OAUTH_SETUP.md](MOBILE_OAUTH_SETUP.md) — per-platform Google OAuth setup
- [CODE_REVIEW.md](CODE_REVIEW.md) + [CODE_REVIEW_FIXES.md](CODE_REVIEW_FIXES.md) — security/quality audit & fix log
- [SAP_AI_CORE_INTEGRATION_GUIDE.md](SAP_AI_CORE_INTEGRATION_GUIDE.md) — SAP AI Core setup for users who want to wire that provider in the app's Settings page
