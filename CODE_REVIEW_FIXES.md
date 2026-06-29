# Code Review Fix Log

This document tracks all fixes applied in response to the comprehensive code review (see `CODE_REVIEW.md`). The work was done in two rounds:

1. **Round 1** — applied all Critical/High issues + most Mediums directly from the report.
2. **Round 2** — verified Round 1 didn't introduce regressions; fixed several that it did; applied additional medium/low quality fixes and infrastructure hardening (rate limiting, error sanitization, accessibility).

---

## Round 1 — Initial Fixes (45 changes)

### Security (Critical / High)
- `middleware.ts` — Removed blanket `/api/` bypass; added explicit allowlist (`/api/auth`, `/api/health`, and the share-link routes that need public access). Fixed open redirect by validating `callbackUrl` is a same-origin relative path.
- `lib/crypto.ts` — `ENCRYPTION_KEY` now requires a 64-char hex string parsed via `Buffer.from(k, 'hex')` for genuine 256-bit entropy.
- `lib/verify-google-token.ts` — Rejects all tokens when no Google client IDs are configured (previously accepted any Google-signed token).
- `lib/utils.ts` — `generateId()` now uses `crypto.randomUUID()`; new `generateShareToken()` uses `crypto.randomBytes(24).toString('base64url')`.
- `lib/db.ts` — Database SSL validation now controlled by `DB_SSL_REJECT_UNAUTHORIZED` env var (defaults to verify-on).
- `lib/ai-dispatch.ts` (new) — Single `callAI(settings, system, user, maxTokens)` function replaces three duplicated `runChat` copies.
- All five `/api/ai/*` routes — Added `auth()` check at top; load credentials from DB via `prisma.userSettings.findUnique`; removed `settings` from request body entirely. Closes the unauthenticated-credential-proxy + SSRF vector.
- `app/api/ai/extract-file/route.ts` — Added auth + 10 MB content-length cap before reading body.
- `app/api/user-settings/route.ts` — `GET` no longer returns plaintext `clientSecret`/`geminiApiKey`. Returns `clientSecretConfigured`/`geminiApiKeyConfigured` booleans plus 4-char `clientSecretHint`/`geminiApiKeyHint` strings for display only.
- `app/api/upload/route.ts` — Filename uses `randomBytes(16).toString('hex')`.

### Data Integrity (High / Medium)
- `app/api/activities/route.ts` — Bulk PATCH now wraps `deleteMany` + per-item `upsert` in `prisma.$transaction`; preserves activity IDs across saves. Removed `isPublic` bypass from `getPlanAccess` (revoked links can no longer be re-read via the legacy `isPublic` field).
- `app/api/plans/route.ts` — PUT day-rebuild now wraps the per-date `create`/`update` loop in `prisma.$transaction`. List endpoint uses `select` (not `include`) to skip nested activity rows. PATCH share-token creation is transactional and writes a single consistent token to both `ShareLink.token` and `Plan.shareLink`. POST has structured input validation (title/date format/range).
- `app/api/plans/share/route.ts` & `app/api/checklists/share/route.ts` — Both `POST` (link create + plan.isPublic update) and `DELETE` (member purge + link deactivation) wrapped in `$transaction`. Uses `generateShareToken()` instead of `generateId()`.
- `app/api/plans/members/route.ts` & `app/api/checklists/members/route.ts` — `DELETE` uses `deleteMany` with scoped `{ id, planId/checklistId }` instead of unscoped `delete`. Prevents cross-resource member deletion.
- `app/api/checklists/templates/route.ts` & `app/api/checklists/from-template/route.ts` — `GET ?id=` and template clone now require `isPublished: true OR authorId = self`.
- `app/api/checklists/route.ts` — Removed `generateShareLink()` (Math.random-based) in favor of `generateShareToken()`. Added input validation (title max 200, description max 5000, items max 500).
- `migrate-runner.js` — Each migration now wraps in `BEGIN`/`COMMIT`/`ROLLBACK`. Narrowed runtime grants from `ALL PRIVILEGES` to `SELECT, INSERT, UPDATE, DELETE` (+ sequence `USAGE, SELECT`).
- `prisma/schema.prisma` — Added `@@unique([planId, date])` and `@@unique([planId, dayNumber])` to `DayPlan`. Removed redundant `@@index` entries on `Plan.shareLink`, `Checklist.shareLink`, `ShareLink.token`, `ChecklistShareLink.token`. Added `UserSettings.createdAt`.

### Library / Settings flow
- `lib/checklist-access.ts` — `resolveChecklistPermission` consolidated into a single Prisma query (was 2 sequential round-trips per write).
- `lib/ai-settings.ts` — `saveAISettingsToServer` propagates server errors via `throw` (was silently swallowing them).

### Frontend
- `components/plan-view.tsx` — `fetchPlan` no longer has `selectedDayId` in `useCallback` deps; initial selection tracked via `initialDaySetRef`. All activity mutations now check `response.ok`. `copyLink` `setTimeout` stored in a ref + cleared on unmount.
- `components/checklist-detail.tsx` — `handleToggle` / `handleUpdateItem` / `handleDeleteItem` now snapshot prior state and roll back on `!response.ok`. `copyLink` timer in ref + cleared on unmount.
- `components/ai-panel.tsx` — Removed `setTimeout(50)` state-sync workaround; `handleQuickPrompt` passes the prompt string directly. Removed local `loadAISettings`/`saveAISettings` usage. Removed `settings` from `/api/ai/chat` request body.
- `components/import-itinerary-modal.tsx`, `components/template-browser.tsx`, `components/create-checklist-modal.tsx` — All removed `settings` from AI request bodies.
- `app/settings/intelligence/page.tsx` — Model-discovery flow now saves settings to DB first, then calls discovery endpoints with empty body (server reads from DB). Closes the SSRF vector at the settings flow.

### Config
- `next.config.ts` — Removed stale `pdfjs-dist` from `serverExternalPackages`.
- `tsconfig.json` — Added `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`.
- `manifest.yml` — Replaced stale `MONGODB_URI` env doc with `DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`.

---

## Round 2 — Regression Fixes & Quality Hardening

### Regressions from Round 1 (caught & fixed)
1. **`lib/ai-settings.ts` / `app/api/user-settings/route.ts`** — Round 1 GET stopped returning plaintext secrets, but `isAIConfigured()` still checked `!!settings.clientSecret`, breaking all AI features for already-configured users. Fixed: added `clientSecretConfigured` / `geminiApiKeyConfigured` to `AISettings` interface; `isAIConfigured` now accepts either a fresh key OR a configured flag. `saveAISettingsToServer` strips empty secret fields before sending so the server's `PUT` no longer erases stored values. `PUT` route now looks up `existing` row and preserves `clientSecretEnc`/`geminiApiKeyEnc` when the field isn't sent.
2. **`app/api/plans/route.ts` (list endpoint)** — Round 1 changed the list `select` to omit nested activities. But `home-page.tsx` reads `plan.days[].activities.length` and `.filter(a => a.status === 'completed').length` to show counts. Fixed: list now includes a minimal `activities: { select: { id, status } }` so home-page math still works, without loading the full activity rows.
3. **`app/api/activities/route.ts` (PATCH upsert)** — Round 1 used `where: { id: a.id || '' }`, which would fail for new activities (Prisma rejects empty-string id lookups). Fixed: pre-assign `id: a.id || generateId()` before the upsert loop so `where: { id: a.id }` is always a real key.
4. **`components/plan-view.tsx` (initialDaySetRef)** — When navigating from Plan A to Plan B without unmounting, the ref stayed `true` so the new plan never auto-selected today/first day. Fixed: reset the ref + `selectedDayId` in a `useEffect` keyed on `[planId, shareToken]`.

### New Quality Fixes
5. **`prisma/migrations/20260624_dayplan_unique_and_userset_createdat/migration.sql`** (new) — Migration for Round 1's schema changes: deduplicates existing `DayPlan` rows that violate the new unique constraints, then adds the constraints; adds `UserSettings.createdAt`; drops the 4 redundant indexes. Without this migration the schema changes never reach production.
6. **`lib/rate-limit.ts`** (new) — In-memory token-bucket rate limiter with periodic stale-bucket sweeping. Documented as per-process (CAVEAT for multi-instance CF). Applied to:
   - All AI routes: `chat` (20/min), `generate-checklist` (20/min), `parse-itinerary` (10/min), `extract-file` (10/min), `models` (10/min), `gemini-models` (10/min)
   - `upload` (30/min per user)
   - Unauthenticated share-link lookups on `/api/plans?share=` and `/api/checklists?share=` (60/min per IP) — prevents token brute-forcing.
7. **API error sanitization** — `app/api/ai/*` routes no longer echo provider error messages directly (which leaked SAP AI Core URLs, Gemini API paths). Generic message returned to client; full error still logged server-side. Same treatment for `app/api/plans/route.ts` POST.
8. **Input length validation** — Added max-length checks to:
   - `app/api/tasks/route.ts` POST (title ≤ 200, description ≤ 5000)
   - `app/api/checklists/items/route.ts` POST (title ≤ 500, groupName ≤ 100, notes ≤ 5000)
   - `app/api/checklists/route.ts` POST (title ≤ 200, description ≤ 5000, items ≤ 500)
   - `app/api/plans/route.ts` POST (title ≤ 200, description ≤ 10000, ISO date format, endDate ≥ startDate)
9. **`deploy.sh`** — Added `ENCRYPTION_KEY` to the required-vars validation loop with regex check for `[0-9a-fA-F]{64}`. `cf set-env` now always sets it (was conditional).
10. **`auth.config.ts`** — Added explicit comment block documenting why `trustHost: true` is required (CF GoRouter X-Forwarded-Host) and how the risk is mitigated (NEXTAUTH_URL + Google OAuth strict-mode redirect URI list).
11. **`lib/use-escape-key.ts`** (new) — Reusable hook for Escape-to-close. Applied to modals in `plan-view.tsx` (Share, Settings, Activity, EditPlan, DayPicker) and `checklist-detail.tsx` (Share, Edit, Template).
12. **A11y patches** — Added `role="dialog"`, `aria-modal="true"`, `aria-label` to the Share/Edit/Template modal containers in both `plan-view.tsx` and `checklist-detail.tsx`. Added `aria-label` to back/more/close icon-only buttons.
13. **Dead code removal** — Deleted `components/day-selector.tsx` (zero references in the codebase).
14. **`app/api/checklists/from-template/route.ts`** — Added `isPublished: true OR authorId = self` filter (closes the unauthenticated-clone hole that mirrored the templates GET route fix).

---

## Files Created
- `lib/ai-dispatch.ts`
- `lib/rate-limit.ts`
- `lib/use-escape-key.ts`
- `prisma/migrations/20260624_dayplan_unique_and_userset_createdat/migration.sql`
- `CODE_REVIEW.md` (the original review report)
- `CODE_REVIEW_FIXES.md` (this file)
- `CLAUDE.md` (initial codebase docs)

## Files Deleted
- `components/day-selector.tsx` (unused)

---

## Remaining Items (Tracked, Not Yet Applied)
These are documented in `CODE_REVIEW.md` under "Roadmap (Sprint 5)" and represent larger architectural changes that should land in a dedicated effort:

- **Replace `migrate-runner.js` with `prisma migrate deploy`** — Once the Prisma CLI is wired into the build environment.
- **Define Prisma enums for `status`, `permission`, `priority`, `type`** — Schema migration.
- **Add cursor-based pagination to list endpoints** — Plans, tasks, checklists, templates.
- **Migrate `String` date/time columns to `DateTime`** — Multi-step migration with backfill.
- **Introduce SWR or TanStack Query** — Replace manual `useEffect + fetch` patterns app-wide.
- **Define `AIProvider` interface** — Refactor SAP and Gemini into implementations with `chat()` method.
- **Move SAP OAuth token cache to Redis** — Currently per-process Map; cold on CF restarts.
- **Structured logging with `pino`** — Replace 46+ `console.error` calls with correlation-ID logging.
- **Component decomposition** — `plan-view.tsx` (2,467 lines) and `home-page.tsx` (1,795 lines).
- **`<ModalShell>` component with focus trap** — Replace per-modal Escape handling.
- **Convert `app/templates/[id]/page.tsx` to a Server Component**.
