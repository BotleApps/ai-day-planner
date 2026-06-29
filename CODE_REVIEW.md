# AI Day Planner — Engineering Code Review Report

**Date:** 2026-06-24
**Reviewers:** 5 specialist reviewers (Security, API Design, Frontend/React, Database, Architecture)
**Codebase:** Next.js full-stack app (`ai-day-planner`) on SAP BTP Cloud Foundry

> **Status (2026-06-24):** All Critical/High/Medium issues have been addressed. See `CODE_REVIEW_FIXES.md` for the complete change log including 2nd-round regression fixes (user-settings flow, plans list endpoint, activities upsert, initialDaySetRef navigation), 4 new migrations, rate limiting infrastructure, error sanitization, and aria-label/role=dialog patches.

---

## Executive Summary

The codebase delivers a functional AI-powered day-planning product but carries a cluster of **critical security vulnerabilities** that must be resolved before any production hardening can be considered complete: five AI proxy endpoints accept provider credentials from unauthenticated HTTP requests, making the server a free proxy to SAP AI Core and Google Gemini for any actor on the internet. Beyond security, the codebase shows signs of rapid feature addition without consolidation — core logic (AI dispatch, shape helpers, permission checks) is copy-pasted across three or more files, the largest components exceed 2,400 lines, and the database layer lacks transactions in several mutation paths that can corrupt data on partial failure. The overall architecture is sound and the feature set is impressive; the work required is primarily hardening and refactoring rather than redesign.

**Top immediate priorities:** (1) Add authentication to all `/api/ai/*` routes and stop accepting credentials in request bodies. (2) Replace `Math.random()` token generation with `crypto.randomBytes`. (3) Fix two missing `prisma.$transaction` wrappers around destructive bulk mutations. (4) Stop returning decrypted secrets from `GET /api/user-settings`. (5) Fix the open redirect in middleware.

---

## Critical & High Priority Issues (Ordered by Risk)

| # | Title | Severity | File |
|---|-------|----------|------|
| 1 | AI proxy endpoints unauthenticated — credential abuse | CRITICAL | `app/api/ai/*/route.ts` |
| 2 | Middleware bypasses all `/api/` routes | CRITICAL | `middleware.ts:26` |
| 3 | `extract-file` endpoint unauthenticated | CRITICAL | `app/api/ai/extract-file/route.ts` |
| 4 | All share tokens use `Math.random()` — predictable | HIGH | `lib/utils.ts:226`, `app/api/checklists/route.ts:7` |
| 5 | Sensitive API credentials returned in plaintext in GET response | HIGH | `app/api/user-settings/route.ts:22` |
| 6 | SSRF via user-controlled `authUrl`/`apiUrl` | HIGH | `lib/sap-ai-core.ts:22,64` |
| 7 | Open redirect in middleware `callbackUrl` | HIGH | `middleware.ts:50` |
| 8 | `ENCRYPTION_KEY` treated as raw UTF-8 — weak key | HIGH | `lib/crypto.ts:5` |
| 9 | Bulk activity PATCH: delete + createMany not atomic | HIGH | `app/api/activities/route.ts:266` |
| 10 | Plans PUT day-rebuild loop: N+1 queries, no transaction | HIGH | `app/api/plans/route.ts:347` |
| 11 | migrate-runner.js migrations not wrapped in transactions | HIGH | `migrate-runner.js:74` |
| 12 | `fetchPlan` infinite re-fetch loop via stale `useCallback` | HIGH | `components/plan-view.tsx:94` |
| 13 | AI credentials sent in request body from browser | HIGH | `app/api/ai/chat/route.ts:8` |

---

## Security

### [CRITICAL] All API routes bypassed by middleware — no defence-in-depth

**File:** `middleware.ts:26-28`

The middleware explicitly skips authentication for every path under `/api/`:

```ts
// middleware.ts:26
if (nextUrl.pathname.startsWith('/api/')) {
  return NextResponse.next(); // ALL api routes pass through unauthenticated
}
```

This means a single missing `auth()` call in any route handler fully exposes that endpoint. The three AI route findings below directly exploit this gap.

**Fix:** Remove the blanket bypass. Maintain an explicit allowlist of public API paths:

```ts
const PUBLIC_API_PATHS = ['/api/auth', '/api/health'];
if (PUBLIC_API_PATHS.some(p => nextUrl.pathname.startsWith(p))) {
  return NextResponse.next();
}
// All other /api/* routes require a session
const session = await auth();
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

---

### [CRITICAL] AI proxy endpoints accept credentials from request body with no authentication

**Files:** `app/api/ai/chat/route.ts:79-113`, `app/api/ai/parse-itinerary/route.ts:122-164`, `app/api/ai/generate-checklist/route.ts:63-103`, `app/api/ai/models/route.ts:5-28`, `app/api/ai/gemini-models/route.ts:4-25`

None of these five routes call `auth()`. Any unauthenticated actor can POST a crafted body containing their own `authUrl`/`apiUrl` (SSRF), consume AI provider quotas at zero cost, or exfiltrate credentials passed through by legitimate users.

**Fix:** Add to the top of every AI route handler:

```ts
const session = await auth();
if (!session?.user?.id) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
// Load credentials from DB — never accept from request body
const settings = await prisma.userSettings.findUnique({
  where: { userId: session.user.id }
});
const clientSecret = settings?.clientSecretEnc ? decrypt(settings.clientSecretEnc) : null;
```

Remove the `settings` field from all AI endpoint request bodies entirely.

---

### [CRITICAL] `extract-file` endpoint processes arbitrary uploads with no authentication

**File:** `app/api/ai/extract-file/route.ts:6-54`

Any anonymous user can upload PDF, PPTX, DOCX, or plain text files and consume server CPU via `pdf-parse` and `officeparser`. Malformed PDFs are a known exploit surface for PDF parsing libraries.

**Fix:**

```ts
// Top of handler
const session = await auth();
if (!session?.user?.id) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
// Also add a hard size cap before reading ArrayBuffer
const contentLength = parseInt(req.headers.get('content-length') ?? '0');
if (contentLength > 10 * 1024 * 1024) { // 10 MB max
  return NextResponse.json({ error: 'File too large' }, { status: 413 });
}
```

---

### [HIGH] All share-link and ID generation uses `Math.random()` — cryptographically insecure

**Files:** `lib/utils.ts:226-228`, `app/api/checklists/route.ts:7-14`, `app/api/plans/share/route.ts:40`, `app/api/checklists/share/route.ts:39`

`generateId()` in `lib/utils.ts` is:

```ts
// lib/utils.ts:226
export const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
```

`Math.random()` is not a CSPRNG. An attacker observing a handful of generated IDs can narrow down future values. Share tokens built on this are enumerable.

**Fix:** Replace everywhere a token gates access:

```ts
import { randomBytes, randomUUID } from 'crypto';

// For share tokens (URLs):
export const generateShareToken = () => randomBytes(24).toString('base64url');

// For internal DB IDs:
export const generateId = () => randomUUID();
```

Update call sites in `app/api/plans/route.ts:408`, `app/api/plans/share/route.ts:40`, `app/api/checklists/share/route.ts:39`, and `app/api/checklists/route.ts:7-14` (remove the custom `generateShareLink()` function entirely).

---

### [HIGH] Sensitive API credentials returned in plaintext in `GET /api/user-settings`

**File:** `app/api/user-settings/route.ts:22-35`

The route decrypts and returns `clientSecret` and `geminiApiKey` in the JSON response body. Any XSS, browser extension, or network interception leaks production AI credentials.

**Fix:** Never return plaintext secrets. Return configured-status flags only:

```ts
return NextResponse.json({
  provider: settings.provider,
  clientSecretConfigured: !!settings.clientSecretEnc,
  geminiApiKeyConfigured: !!settings.geminiApiKeyEnc,
  // last 4 chars for display confirmation only:
  clientSecretHint: settings.clientSecretEnc
    ? '••••' + decrypt(settings.clientSecretEnc).slice(-4)
    : null,
});
```

---

### [HIGH] SSRF — user-controlled `authUrl` and `apiUrl` proxied to arbitrary endpoints

**Files:** `lib/sap-ai-core.ts:22-31`, `lib/sap-ai-core.ts:64`, `app/api/ai/models/route.ts:21`

`authUrl` and `apiUrl` arrive from the client request body and are directly used in `fetch()` calls. An attacker can supply `http://169.254.169.254/latest/meta-data/` (AWS IMDSv1) or `http://localhost:5432/` to probe internal infrastructure.

**Fix:** Stop accepting these from the client entirely (see the auth fix above — load from DB). If dynamic URLs are unavoidable, validate against an allowlist:

```ts
const ALLOWED_AUTH_HOSTS = /^https:\/\/[a-z0-9-]+\.authentication\.(eu10|us10)\.hana\.ondemand\.com$/;
if (!ALLOWED_AUTH_HOSTS.test(settings.authUrl)) {
  return NextResponse.json({ error: 'Invalid authUrl' }, { status: 400 });
}
```

Also block RFC-1918 ranges and cloud metadata addresses before any outbound `fetch`.

---

### [HIGH] Open redirect in middleware `callbackUrl` parameter

**File:** `middleware.ts:50-52`

```ts
const callbackUrl = nextUrl.searchParams.get('callbackUrl') ?? '/';
return NextResponse.redirect(new URL(callbackUrl, base));
```

A URL like `/sign-in?callbackUrl=https://evil.com` redirects users to an arbitrary external domain — a classic phishing vector.

**Fix:**

```ts
const raw = nextUrl.searchParams.get('callbackUrl') ?? '/';
const safe = raw.startsWith('/') && !raw.startsWith('//') && !raw.includes(':') ? raw : '/';
return NextResponse.redirect(new URL(safe, base));
```

---

### [HIGH] `ENCRYPTION_KEY` used as raw UTF-8 — key entropy not validated

**File:** `lib/crypto.ts:5-10`

A 32-character human-chosen string has far less than 256 bits of entropy. The code silently truncates keys longer than 32 characters with no warning.

**Fix:** Require a 64-character hex string (32 bytes of actual random entropy):

```ts
function getKey(): Buffer {
  const k = process.env.ENCRYPTION_KEY ?? '';
  if (!/^[0-9a-fA-F]{64}$/.test(k)) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 random bytes)');
  }
  return Buffer.from(k, 'hex');
}
```

Generate a valid key with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

### [HIGH] Google token verification skips audience check when no client IDs are configured

**File:** `lib/verify-google-token.ts:26`

If all three Google client ID environment variables are unset, `audience` is passed as `undefined` to `verifyIdToken`, which causes the Google auth library to accept tokens issued for **any** Google application — including one registered by an attacker.

**Fix:**

```ts
if (audiences.length === 0) {
  console.error('FATAL: No Google OAuth client IDs configured — rejecting all tokens');
  return null;
}
```

---

### [HIGH] File upload writes to `public/` with client-controlled MIME type and predictable filename

**File:** `app/api/upload/route.ts:19-39`

1. Filename is derived from `Math.random()` — predictable.
2. MIME type comes from `file.type` — client-controlled, trivially spoofed.
3. Files land in `public/uploads/` — directly accessible by URL with no authentication.

**Fix:**

```ts
import { randomBytes } from 'crypto';
import { fileTypeFromBuffer } from 'file-type'; // add this dependency

const bytes = await file.arrayBuffer();
const buffer = Buffer.from(bytes);
const detected = await fileTypeFromBuffer(buffer);
const ALLOWED = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
if (!detected || !ALLOWED[detected.mime]) {
  return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
}
const filename = `${randomBytes(16).toString('hex')}.${ALLOWED[detected.mime]}`;
```

Consider moving uploads outside `public/` and serving via a signed or authenticated endpoint.

---

### [HIGH] SSL certificate validation disabled for all database connections

**File:** `lib/db.ts:16`

`ssl: { rejectUnauthorized: false }` is set unconditionally, removing MITM protection on the DB connection in production.

**Fix:**

```ts
ssl: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false'
  ? { rejectUnauthorized: false }
  : { rejectUnauthorized: true, ca: process.env.DB_SSL_CA ?? undefined }
```

Set `DB_SSL_REJECT_UNAUTHORIZED=false` only for local dev, never in production.

---

### [MEDIUM] No rate limiting on any endpoint

**Files:** All routes under `app/api/`

AI routes, share-link lookups, and the file-extract endpoint can all be called in tight loops. There is no throttling at any layer.

**Recommended minimum:** Use `@upstash/ratelimit` or equivalent:
- `/api/auth/*` — 10 requests/minute per IP (credential stuffing protection)
- `/api/ai/*` — 20 requests/minute per authenticated user (quota protection)
- Unauthenticated share-link lookups — 30 requests/minute per IP

---

### [MEDIUM] `trustHost: true` — host header injection risk

**File:** `auth.config.ts:13`

If infrastructure does not strip/overwrite `X-Forwarded-Host`, attackers can inject a malicious host to hijack OAuth callbacks.

**Fix:** Replace with an explicit canonical URL or ensure the reverse proxy always sets and strips these headers:

```ts
// auth.config.ts
url: process.env.NEXTAUTH_URL,
// Remove trustHost: true
```

---

### [MEDIUM] Authorization bypass — any authenticated user can read unpublished checklist templates

**File:** `app/api/checklists/templates/route.ts:32-38`

When `?id=` is supplied, there is no check for `isPublished` or matching author.

**Fix:**

```ts
where: {
  id,
  OR: [{ isPublished: true }, { authorId: session.user.id }]
}
```

---

### [MEDIUM] Member removal does not scope delete to the owning plan/checklist

**Files:** `app/api/plans/members/route.ts:65`, `app/api/checklists/members/route.ts:65`

An owner of Plan A can supply a `memberId` from Plan B and delete that member's access.

**Fix:** Use `deleteMany` with both IDs:

```ts
await prisma.sharedAccess.deleteMany({
  where: { id: memberId, planId }
});
```

---

### [LOW] Detailed internal error messages returned to API clients

**File:** `app/api/plans/route.ts:309-312` and widespread across all route handlers

```ts
// Current — leaks DB column names, Prisma errors, stack traces
return NextResponse.json({ error: 'Failed to create plan: ' + msg });
```

**Fix:**

```ts
console.error('[POST /api/plans] Create failed:', error);
return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 });
```

---

### [LOW] No CSRF protection beyond SameSite cookie

State-changing routes (`POST`/`PUT`/`PATCH`/`DELETE`) have no CSRF token check. `SameSite=Lax` (NextAuth default) leaves top-level navigation POST unprotected.

**Fix:** Upgrade session cookies to `SameSite=Strict` and add an `X-Requested-With: XMLHttpRequest` header requirement on all state-changing calls as a defence-in-depth measure.

---

## API Design & Backend

### [HIGH] N+1 queries in plans PUT date-range rebuild — not transactional

**File:** `app/api/plans/route.ts:347-364`

Up to 30 sequential `prisma.dayPlan.create`/`update` calls in a plain `for` loop, with no wrapping transaction. A partial failure leaves the day list in an inconsistent state.

**Fix:**

```ts
await prisma.$transaction(async (tx) => {
  await tx.dayPlan.deleteMany({ where: { planId, date: { notIn: newDates } } });
  await tx.dayPlan.createMany({
    data: newDates.map((date, i) => ({ planId, date, dayNumber: i + 1 })),
    skipDuplicates: true,
  });
});
```

---

### [HIGH] Bulk activity PATCH: delete + createMany not atomic

**File:** `app/api/activities/route.ts:266-297`

`deleteMany` then `createMany` run as two separate awaited calls. If `createMany` fails, the day loses all activities with no rollback.

**Fix:**

```ts
await prisma.$transaction([
  prisma.activity.deleteMany({ where: { dayPlanId: dayId } }),
  prisma.activity.createMany({ data: newActivities }),
]);
```

---

### [HIGH] Share link DELETE and creation not transactional

**Files:** `app/api/plans/share/route.ts:80-83`, `app/api/checklists/share/route.ts:77-78`, `app/api/plans/share/route.ts:41-46`, `app/api/checklists/share/route.ts:40-44`

Two separate awaited calls — member deletion and link deactivation can desync on failure; share link creation and `plan.isPublic` update can also desync.

**Fix for both:** Wrap each pair in `prisma.$transaction([...])`.

---

### [HIGH] Plans list endpoint eagerly loads all days and all activities on every list view

**File:** `app/api/plans/route.ts:83-85, 212-218`

For 20 plans × 7 days × 10 activities = 1,400 activity rows fetched on every dashboard load just to render plan cards.

**Fix:** Strip the nested include from list queries:

```ts
// List view — summary only
prisma.plan.findMany({
  where: { createdBy: userId },
  select: { id: true, title: true, destination: true, startDate: true, endDate: true, status: true, coverImage: true }
})

// Single plan — full detail
prisma.plan.findUnique({ where: { id }, include: { days: { include: { activities: true } } } })
```

---

### [MEDIUM] Inconsistent error response shapes across routes

**Files:** `app/api/tasks/route.ts:9`, `app/api/checklists/route.ts:114`, `app/api/plans/members/route.ts:66`

Some 401s return `{ error, tasks: [] }`, others return `{ error }`. Success responses use `{ success: true }` in some routes and `{ ok: true }` in others.

**Fix:** Create `lib/api-response.ts`:

```ts
export const apiError = (msg: string, status: number) =>
  NextResponse.json({ error: msg }, { status });

export const apiOk = <T>(data: T) =>
  NextResponse.json({ data });
```

Use these helpers uniformly across all route handlers.

---

### [MEDIUM] No pagination on list endpoints

**Files:** `app/api/plans/route.ts:213`, `app/api/tasks/route.ts:12`, `app/api/checklists/route.ts:159`, `app/api/checklists/templates/route.ts:41`

All return unbounded record sets. As data grows these will be slow and response payloads large.

**Fix:** Add cursor-based or offset pagination to all collection endpoints:

```ts
const { cursor, take = 20 } = await req.json();
const items = await prisma.plan.findMany({
  where: { createdBy: userId },
  take: take + 1,
  ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  orderBy: { updatedAt: 'desc' }
});
const nextCursor = items.length > take ? items[take].id : null;
return apiOk({ items: items.slice(0, take), nextCursor });
```

---

### [MEDIUM] No input validation library — all validation is ad-hoc

**Files:** `app/api/tasks/route.ts:34`, `app/api/plans/route.ts:236`, `app/api/checklists/items/route.ts:28`

No Zod/Yup. String fields have no max-length checks, enabling storage exhaustion and potential DoS via oversized payloads.

**Fix:** Introduce Zod schemas at each route boundary:

```ts
import { z } from 'zod';

const CreatePlanSchema = z.object({
  title: z.string().min(1).max(200),
  destination: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const parsed = CreatePlanSchema.safeParse(body);
if (!parsed.success) {
  return apiError(parsed.error.message, 400);
}
```

---

### [MEDIUM] `resolveChecklistPermission` makes 2 sequential DB round-trips per write

**File:** `lib/checklist-access.ts:15-29`

Every checklist write triggers two queries before the actual mutation.

**Fix:** Merge into one query:

```ts
const checklist = await prisma.checklist.findUnique({
  where: { id: checklistId },
  include: { sharedAccess: { where: { userId } } }
});
if (!checklist) return 'not_found';
if (checklist.userId === userId) return 'owner';
if (checklist.sharedAccess[0]?.permission === 'edit') return 'editor';
return 'forbidden';
```

---

### [MEDIUM] `getPlanAccess` grants read to any `isPublic` plan — bypasses link revocation

**File:** `app/api/activities/route.ts:36-43`

Revoking a share link sets `ShareLink.isActive = false` but does not set `Plan.isPublic = false`. The `isPublic` check in `getPlanAccess` remains true, leaving all activities of that plan readable by any authenticated user.

**Fix:** Remove the `isPublic: true` OR clause from `getPlanAccess`. Route all access through `SharedAccess` records with active links. Also add `plan.isPublic = false` to every share-link deactivation code path.

---

### [MEDIUM] `plans/route.ts` PATCH logic defect — share token inconsistency

**File:** `app/api/plans/route.ts:408-421`

Line 420 reads `plan.shareLink ?? token`. If the plan already has a `shareLink` field set, it returns the old value while the newly created `ShareLink` row holds a different token. These two identifiers diverge.

**Fix:** Always write the same token to both the `ShareLink` row and `plan.shareLink` column inside a transaction, and return that single value.

---

### [MEDIUM] Duplicate `runChat` function across three AI route files

**Files:** `app/api/ai/chat/route.ts:69`, `app/api/ai/generate-checklist/route.ts:53`, `app/api/ai/parse-itinerary/route.ts:112`

Identical provider-dispatch logic copy-pasted in three places. A bug fix or new provider requires three simultaneous edits.

**Fix:** Create `lib/ai-dispatch.ts`:

```ts
export async function callAI(
  settings: AISettings,
  systemPrompt: string,
  userMessage: string,
  maxTokens?: number
): Promise<string> {
  if (settings.provider === 'gemini') {
    return geminiChat(settings.geminiApiKey!, settings.geminiModel!, systemPrompt, userMessage, maxTokens);
  }
  return chat(settings, systemPrompt, userMessage, maxTokens);
}
```

Import `callAI` in all three routes and remove the local `runChat` copies.

---

### [INFO] `shapeActivity`, `shapeChecklist`, `shapeItem` helpers are duplicated

**Files:** `app/api/activities/route.ts:7`, `app/api/plans/route.ts:56`, `app/api/checklists/route.ts:16`, `app/api/checklists/items/route.ts:11`

Move all shape helpers into `lib/shapes.ts` and import from there.

---

## Frontend & React Patterns

### [HIGH] `fetchPlan` infinite re-fetch loop — `selectedDayId` in `useCallback` deps

**File:** `components/plan-view.tsx:94-120`

`fetchPlan` is in `useCallback([planId, shareToken, selectedDayId])`. Inside `fetchPlan`, `setSelectedDayId` is called, which changes `selectedDayId`, which invalidates the callback, which triggers the `useEffect`, causing a re-fetch loop every time the user changes day.

**Fix:** Remove `selectedDayId` from the dependency array. Track initial selection with a ref:

```ts
const initialDaySetRef = useRef(false);

const fetchPlan = useCallback(async () => {
  const data = await ...;
  if (!initialDaySetRef.current && data.days.length > 0) {
    setSelectedDayId(data.days[0].id);
    initialDaySetRef.current = true;
  }
}, [planId, shareToken]); // No selectedDayId here
```

---

### [HIGH] AI settings fetched independently in 4+ components — N redundant network calls

**Files:** `components/home-page.tsx:97`, `components/ai-panel.tsx:65`, `app/settings/page.tsx:40`, `components/import-itinerary-modal.tsx:50`

Each component mounts its own `useEffect` that calls `loadAISettingsFromServer()`, firing 4-5 parallel requests on a single page load, with race conditions on `localStorage` writes.

**Fix:** Create `contexts/AISettingsContext.tsx`, initialize once in the root layout, and provide the settings + setter via context. All components subscribe with `useAISettings()` instead of fetching individually.

---

### [HIGH] Missing error state for plan and checklist fetches — silent blank screens

**Files:** `components/plan-view.tsx:111`, `components/checklist-list.tsx:38-42`

On fetch failure the loading spinner stops and the user sees an empty or "not found" screen with no error message or retry option.

**Fix:**

```ts
const [fetchError, setFetchError] = useState<string | null>(null);
// In catch block:
setFetchError(error instanceof Error ? error.message : 'Failed to load. Please try again.');
// In render:
if (fetchError) return <ErrorState message={fetchError} onRetry={fetchPlan} />;
```

---

### [HIGH] `handleQuickPrompt` uses `setTimeout` as a state-sync workaround

**File:** `components/ai-panel.tsx:162-203`

`setTimeout(() => {...}, 50)` is used to defer reading input state that was just set. This is a race condition with an arbitrary delay — it breaks in React concurrent mode.

**Fix:** Extract the actual AI call logic and call it directly with the prompt string in scope, bypassing `setInput` entirely:

```ts
const handleQuickPrompt = async (prompt: string) => {
  setInput(prompt); // for display only
  await callAIWithMessage(prompt); // pass directly, don't re-read from input state
};
```

---

### [HIGH] Prop drilling 3 levels deep — navigation callbacks

**Files:** `app/page.tsx` → `components/home-page.tsx:47` → `components/checklist-list.tsx:11` → `components/templates-section.tsx`

`onSelectChecklist`, `onCreateChecklist`, and `onUseTemplate` are drilled through three component layers.

**Fix:** Create a `NavigationContext` or use the Next.js router directly in leaf components. For URL-based navigation, `router.push('/?checklistId=xyz')` in the leaf is cleaner than a callback chain.

---

### [MEDIUM] Mutation fetches never check `response.ok` — silent failures leave stale optimistic UI

**Files:** `components/plan-view.tsx:255,290`, `components/checklist-detail.tsx:115,127,137`

A server `401`, `403`, or `500` is silently ignored and the optimistic UI update persists.

**Fix:** Create a shared fetch wrapper:

```ts
async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}
```

Use `apiFetch` across all mutation handlers and roll back optimistic state in `catch`.

---

### [MEDIUM] Optimistic UI in `checklist-detail` not rolled back on failure

**File:** `components/checklist-detail.tsx:110-138`

`handleToggle`, `handleUpdateItem`, `handleDeleteItem` mutate state first, then fire a fetch with no response check and no rollback.

**Fix:**

```ts
const prev = checklist;
setChecklist(optimisticState);
try {
  await apiFetch('/api/checklists/items', { method: 'PUT', body: JSON.stringify(payload) });
} catch (e) {
  setChecklist(prev);
  showToast('Update failed — please try again');
}
```

---

### [MEDIUM] Large monolithic components — plan-view.tsx (2,467 lines), home-page.tsx (1,795 lines)

**Files:** `components/plan-view.tsx`, `components/home-page.tsx`, `components/checklist-detail.tsx`

These files contain multiple distinct UI areas that are impossible to test or maintain in isolation.

**Recommended extractions:**

From `plan-view.tsx`: `<ShareModal>`, `<EditPlanModal>`, `<DayPickerModal>`, `<ActivityDetailPopup>`, `<DayStrip>`
From `home-page.tsx`: `<PlansTab>`, `<SharedPlansTab>`, `<ProfileTab>`, `<ThemePicker>`
From `checklist-detail.tsx`: `<ChecklistShareModal>`, `<SaveTemplateModal>`, `<EditMetadataModal>`

Target: no component file exceeds 400 lines.

---

### [MEDIUM] All data fetching is manual `useEffect + fetch` — no caching or deduplication

**Files:** All major component files

Navigation between views re-fetches data from scratch every time. There is no deduplication of concurrent requests or revalidation on window focus.

**Fix:** Adopt **SWR** or **TanStack Query**:

```ts
const { data: plan, error, mutate } = useSWR(
  planId ? `/api/plans?id=${planId}` : null,
  fetcher
);
```

---

### [MEDIUM] `useEffect` dependency arrays omit callbacks — stale closure risk

**File:** `components/home-page.tsx:86-103`

`fetchPlans` and `fetchSharedPlans` are defined as plain `async` functions (recreated every render) but the `useEffect` has `[]` dependencies, capturing stale closures.

**Fix:** Define them with `useCallback` (with explicit dependencies) or move their definitions inside the `useEffect` body.

---

### [MEDIUM] Modal overlays lack focus trapping and Escape key handling — keyboard accessibility failure

**Files:** `components/plan-view.tsx:857,1007,1067,1116`, `components/checklist-detail.tsx:719,781,866`

No modal implements `role="dialog"`, `aria-modal="true"`, focus trapping, or Escape-to-close. This violates WCAG 2.1 guideline 2.1.2.

**Fix:** Create a shared `<ModalShell>` component:

```tsx
export function ModalShell({ onClose, title, children }: ModalShellProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={title}>
      <FocusTrap>{children}</FocusTrap>
    </div>
  );
}
```

---

### [MEDIUM] No `aria-label` on icon-only buttons

**Files:** `components/plan-view.tsx:496,792,801,615`, `components/home-page.tsx:387,500`, `components/checklist-list.tsx:113`

```tsx
// Fix — representative examples:
<button aria-label="Go back"><ChevronLeft /></button>
<button className="fab-add" aria-label="Add activity"><Plus /></button>
<button className="sf-clear" aria-label="Clear search" onClick={clearSearch}><X /></button>
```

---

### [MEDIUM] `copyLink` setTimeout not cleared on unmount — setState after unmount

**Files:** `components/plan-view.tsx:246`, `components/checklist-detail.tsx:364`

**Fix:**

```ts
const copyTimerRef = useRef<ReturnType<typeof setTimeout>>();

const copyLink = () => {
  navigator.clipboard.writeText(url);
  setShareCopied(true);
  clearTimeout(copyTimerRef.current);
  copyTimerRef.current = setTimeout(() => setShareCopied(false), 2000);
};

useEffect(() => () => clearTimeout(copyTimerRef.current), []);
```

---

### [MEDIUM] `app/templates/[id]/page.tsx` is `'use client'` but should be a Server Component

**File:** `app/templates/[id]/page.tsx:1-49`

The page uses `useEffect` to fetch data on the client, missing LCP and SEO benefits of server-side rendering.

**Fix:** Convert to an `async` Server Component and extract interactive parts as small `'use client'` sub-components.

---

### [LOW] `components/day-selector.tsx` is unused dead code

**File:** `components/day-selector.tsx` — never imported; confirm and delete or integrate.

---

### [LOW] `key={index}` used for list items

**Files:** `app/templates/[id]/page.tsx:178`, `components/ai-panel.tsx:302,273`

**Fix:** Use stable IDs: `key={item.id}` or `key={`${groupName}-${item.title}`}`.

---

## Database & Data Layer

### [HIGH] `migrate-runner.js` does not wrap migrations in transactions

**File:** `migrate-runner.js:74-89`

Multi-statement migration files applied with a bare `client.query(sql)`. A partial failure commits partial DDL, leaving schema and migration history table out of sync.

**Fix:** Wrap each migration in `BEGIN`/`COMMIT`/`ROLLBACK`. **Better fix:** Replace with `prisma migrate deploy`.

---

### [HIGH] `migrate-runner.js` stores but never verifies checksums

**File:** `migrate-runner.js:44-91`

Edited migration files are silently skipped, allowing schema drift from tampered history.

**Fix:** Compare stored checksum against current file hash on each run; abort if they differ.

---

### [HIGH] `DayPlan` lacks unique constraints on `(planId, date)` and `(planId, dayNumber)`

**File:** `prisma/schema.prisma` — `DayPlan` model

Concurrent `PUT` requests can create duplicate day rows.

**Fix:**

```prisma
model DayPlan {
  // ...
  @@unique([planId, date])
  @@unique([planId, dayNumber])
}
```

---

### [MEDIUM] Date and time fields stored as `String`/`TEXT` instead of `DATE`/`TIMESTAMP`

**File:** `prisma/schema.prisma` — `Plan`, `DayPlan`, `Checklist`, `ChecklistItem`, `Activity` models

Lexicographic sorting, no DB-level date arithmetic, no timezone support, no format enforcement.

**Fix:** Migrate `startDate`, `endDate`, `DayPlan.date`, `Checklist.dueDate`, `ChecklistItem.dueDate` → `DateTime`. Store time fields as minutes-since-midnight `Int` or use `Time`.

---

### [MEDIUM] Status/permission/type fields use unconstrained `TEXT` — no enum enforcement

**File:** `prisma/schema.prisma`

**Fix:** Define Prisma enums:

```prisma
enum PlanStatus { draft active completed }
enum Permission { view edit }
enum ActivityStatus { planned in_progress completed }
enum Priority { low medium high }
```

---

### [MEDIUM] Connection pool not configured — default sizing exhausts Postgres under load

**File:** `lib/db.ts`

No `max`, `idleTimeoutMillis`, or `connectionTimeoutMillis` set.

**Fix:** Configure the pool explicitly:

```ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: ...,
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
});
```

---

### [MEDIUM] Bulk activity replace loses activity IDs — breaks deep links and audit trail

**File:** `app/api/activities/route.ts:262-297`

Every bulk save deletes all activities and recreates them with new IDs.

**Fix:** Use an upsert pattern — delete only activities not in the incoming set, upsert existing ones.

---

### [MEDIUM] `ShareLink.token` and `Plan.shareLink` have redundant indexes

**File:** `prisma/schema.prisma`

`@unique` already creates an implicit unique index. Explicit `@@index([token])` / `@@index([shareLink])` creates duplicate B-tree indexes.

**Fix:** Remove the redundant `@@index` entries on `ShareLink`, `ChecklistShareLink`, `Plan`, and `Checklist`.

---

### [MEDIUM] `ChecklistTemplate.authorName` and `SharedAccess.userName` are denormalized and can go stale

**Fix for templates:** Resolve display name at read time from session. For `SharedAccess`, document the point-in-time snapshot is intentional.

---

### [LOW] `UserSettings` has no `createdAt` column

**Fix:** Add `createdAt DateTime @default(now())` — additive migration, zero risk.

---

### [LOW] `migrate-runner.js` grants `ALL PRIVILEGES` — violates least privilege

**File:** `migrate-runner.js:96-110`

**Fix:** Narrow to `SELECT, INSERT, UPDATE, DELETE` on tables and `USAGE, SELECT` on sequences. Use a separate migration role for DDL.

---

### [INFO] `lib/ai-settings.ts` localStorage cache has no invalidation on page focus

**File:** `lib/ai-settings.ts:59-98`

Settings updated on another device shadow the stale `localStorage` copy.

**Fix:** Call `loadAISettingsFromServer` on `window focus` events and on every app mount.

---

## Architecture & Code Quality

### [HIGH] `ENCRYPTION_KEY` deployment gap — not listed as required in `manifest.yml` or `DEPLOYMENT.md`

**Files:** `deploy.sh:337`, `manifest.yml:19-24`, `DEPLOYMENT.md`

A deployment without `ENCRYPTION_KEY` causes every `encrypt()`/`decrypt()` call to throw as a generic 500.

**Fix:** Add to `deploy.sh` required-variable validation, `manifest.yml` env docs, and add a startup assertion in `lib/crypto.ts`.

---

### [HIGH] `pdfjs-dist` in `serverExternalPackages` but never imported

**File:** `next.config.ts:22`

A leftover from an earlier implementation. Confirm with `grep -r 'pdfjs-dist' app/ lib/` and remove if not found.

---

### [MEDIUM] No unified AI provider interface — two diverging integration shapes

**Files:** `lib/sap-ai-core.ts:109-190`, `lib/gemini.ts:50-88`

**Fix:** Define an `AIProvider` interface in `lib/ai-provider.ts` with a single `chat()` method; implement for SAP and Gemini.

---

### [MEDIUM] SAP OAuth token cache is process-level — cold on CF restarts and multi-instance

**File:** `lib/sap-ai-core.ts:7-43`

**Fix (short term):** Add LRU eviction. **Fix (proper):** Store in a shared DB row or Redis.

---

### [MEDIUM] `manifest.yml` references `MONGODB_URI` — stale after PostgreSQL migration

**File:** `manifest.yml:19` — replace with `DATABASE_URL`.

---

### [MEDIUM] TypeScript: `noUnusedLocals`, `noUnusedParameters` not enabled; `any` types on Prisma results

**Files:** `tsconfig.json`, `app/api/plans/route.ts:8,44,55-56`, `app/api/activities/route.ts:7`

**Fix:** Enable stricter compiler options and use `Prisma.PlanGetPayload<...>` types.

---

### [MEDIUM] Dual-write divergence: `saveAISettingsToServer` swallows errors silently

**File:** `lib/ai-settings.ts:91-98`

**Fix:** Await the server response; only update localStorage on success; throw on failure so callers can surface the error.

---

### [MEDIUM] No structured observability — plain `console.error` with no correlation IDs

**Files:** ~46 locations across `app/api/`

**Fix:** Introduce `pino` with `{ requestId, userId, route, durationMs }` on all API handlers.

---

### [LOW] `DEPLOYMENT.md` is stale — documents MongoDB/Vercel for a PostgreSQL/BTP app

**Fix:** Rewrite to lead with SAP BTP CF. Move Vercel/MongoDB to a clearly labelled legacy section.

---

### [LOW] `deploy.sh` Turbopack hash-alias workaround is undocumented and fragile

**File:** `deploy.sh:231-263`

**Fix:** Add a comment citing the specific Turbopack/Next.js issue number so it can be tracked and removed when fixed upstream.

---

### [INFO] Dual deployment artefacts for a single target platform

**Files:** `Procfile`, `manifest.yml`, `mta.yml`, `deploy.sh`, `DEPLOYMENT.md`

Decide on one authoritative deployment path and clearly label or remove the others.

---

## Quick Wins (Fixable in < 30 Minutes Each)

1. **`middleware.ts:50`** — Fix open redirect with a 3-line `callbackUrl` validation.
2. **`lib/utils.ts:226`** — Replace `generateId()` with `crypto.randomUUID()` and add `generateShareToken()` using `crypto.randomBytes(24).toString('base64url')`.
3. **`app/api/checklists/route.ts:7-14`** — Delete `generateShareLink()` and use the new `generateShareToken()`.
4. **`app/api/user-settings/route.ts:22-35`** — Return `clientSecretConfigured: boolean` instead of the decrypted value.
5. **`prisma/schema.prisma`** — Remove the 4 redundant `@@index` entries for fields that already have `@unique`.
6. **`lib/verify-google-token.ts:26`** — Add 4-line guard: return null if `audiences.length === 0`.
7. **`app/api/plans/members/route.ts:65` and `app/api/checklists/members/route.ts:65`** — Change `delete` to `deleteMany` with scoped `where` clause.
8. **`manifest.yml:19`** — Replace `MONGODB_URI` reference with `DATABASE_URL`.
9. **`next.config.ts:22`** — Remove `pdfjs-dist` from `serverExternalPackages` (confirm with grep first).
10. **`tsconfig.json`** — Add `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`.
11. **`prisma/schema.prisma UserSettings`** — Add `createdAt DateTime @default(now())`.
12. **`migrate-runner.js:96-110`** — Narrow `GRANT ALL PRIVILEGES` to `SELECT, INSERT, UPDATE, DELETE`.
13. **`app/api/ai/extract-file/route.ts`** — Add `const session = await auth(); if (!session) return 401` at the top.
14. **`components/plan-view.tsx:246` and `checklist-detail.tsx:364`** — Store and clear `copyLink` timer ID in a ref.

---

## Roadmap (Prioritized Bigger Improvements)

### Sprint 1 — Critical Security (1-2 days)
1. Add `auth()` session check to all 5 `/api/ai/*` routes; remove `settings` from request bodies — load from DB instead. Resolves SSRF simultaneously.
2. Validate `ENCRYPTION_KEY` as a 64-character hex string; document as required in `deploy.sh` and `manifest.yml`.
3. Fix `ENCRYPTION_KEY` derivation in `lib/crypto.ts` to use `Buffer.from(k, 'hex')`.
4. Remove blanket `/api/` bypass from `middleware.ts`; add explicit public-path allowlist.
5. Stop returning decrypted secrets from `GET /api/user-settings`.

### Sprint 2 — Data Integrity (2-3 days)
6. Wrap all non-atomic mutations in `prisma.$transaction`: activity PATCH, plans PUT day rebuild, share link create/delete.
7. Replace `migrate-runner.js` with `prisma migrate deploy` (or add `BEGIN`/`COMMIT`/`ROLLBACK` and checksum verification as interim).
8. Add `@@unique([planId, date])` and `@@unique([planId, dayNumber])` constraints to `DayPlan`.
9. Define Prisma enums for `status`, `permission`, `priority`, `type` fields.

### Sprint 3 — API Hardening (3-5 days)
10. Introduce Zod schemas for all route request bodies (start with plans, checklists, activities, tasks, user-settings).
11. Add rate limiting (`@upstash/ratelimit`) for AI routes, auth routes, and unauthenticated share-link lookups.
12. Add cursor-based pagination to all list endpoints; strip nested `days`/`activities` from the plans list query.
13. Extract `callAI` into `lib/ai-dispatch.ts`; delete three copies of `runChat`.
14. Extract all shape helpers into `lib/shapes.ts`.
15. Merge `resolveChecklistPermission` into a single Prisma query.

### Sprint 4 — Frontend Quality (1 week)
16. Fix `fetchPlan` `useCallback` dependency (remove `selectedDayId`).
17. Add `AISettingsContext` to replace N-component individual fetches.
18. Add `apiFetch` wrapper with `response.ok` checks and optimistic rollback in `checklist-detail.tsx`.
19. Implement `<ModalShell>` with focus trapping and Escape key; retrofit all custom modals.
20. Add `aria-label` to all icon-only buttons (audit with axe-core or Lighthouse a11y scan).
21. Begin component decomposition: extract `<ShareModal>`, `<EditPlanModal>`, `<DayStrip>` from `plan-view.tsx`.

### Sprint 5 — Observability & Architecture (1 week)
22. Introduce `pino` structured logging with `requestId`, `userId`, `route`, `durationMs` on all API handlers.
23. Define `AIProvider` interface; refactor SAP/Gemini into implementations.
24. Move SAP OAuth token cache to a shared DB row or Redis for multi-instance CF correctness.
25. Adopt SWR or TanStack Query for all client-side data fetching.
26. Migrate date/time columns from `TEXT` to `DATE`/`TIMESTAMP`.
27. Convert `app/templates/[id]/page.tsx` to a React Server Component.
