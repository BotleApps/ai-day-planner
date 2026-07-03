/**
 * Test harness for Next.js App Router route handlers.
 *
 * Route handlers are just async functions that accept a Request-ish object
 * and return a NextResponse. We can invoke them directly without spinning up
 * the Next.js server — the two dependencies to control are:
 *
 *   1. `auth()` from `@/auth` — returns a Session or null (session gate).
 *   2. `prisma` from `@/lib/db` — the database client.
 *
 * Each test file that touches routes calls `installMocks()` in a top-level
 * `vi.mock()` factory (vi.mock is hoisted by vitest so it MUST live in the
 * test file itself, not in a helper module — but the mock factories can
 * still delegate to this harness).
 *
 * Usage inside a test file:
 *
 *   import { setAuth, prismaMock } from '../_harness/mocks';
 *
 *   vi.mock('@/auth', () => require('../_harness/mocks').authMockFactory());
 *   vi.mock('@/lib/db', () => require('../_harness/mocks').prismaMockFactory());
 *
 *   // …
 *   setAuth({ user: { id: 'user-1' } });
 *   const res = await GET(makeRequest('/api/tasks'));
 *   expect(res.status).toBe(200);
 */
import { vi } from 'vitest';

// ─── auth() mock state ─────────────────────────────────────────────────────

// Shape mirrors NextAuth's Session.user — id is what routes gate on, but
// email/name are also read by share-link handlers that record who accessed
// a resource, so tests need to be able to set them.
type MockSession = { user?: { id?: string; email?: string | null; name?: string | null } } | null;

let currentSession: MockSession = null;

export function setAuth(session: MockSession): void {
  currentSession = session;
}

export function resetAuth(): void {
  currentSession = null;
}

/**
 * Factory used inside `vi.mock('@/auth', () => require('..').authMockFactory())`.
 * Returns a module shape that matches `@/auth`'s exports.
 */
export function authMockFactory() {
  return {
    auth: vi.fn(async () => currentSession),
  };
}

// ─── prisma mock ───────────────────────────────────────────────────────────

/**
 * A vi.fn() for every model.method combination the routes touch. Tests reach
 * into `prismaMock.<model>.<method>` and call `.mockResolvedValue(...)` etc.
 *
 * Models covered: plan, dayPlan, activity, task, checklist, checklistItem,
 * checklistTemplate, checklistTemplateItem, sharedAccess, shareLink,
 * sharedChecklistAccess, checklistShareLink, userSettings.
 *
 * `$transaction(fn)` invokes the callback with the same mock — tests can
 * assert transactional operations without needing a real DB.
 */
type PrismaModelMock = {
  findUnique: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  createMany: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
};

function makeModel(): PrismaModelMock {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  };
}

// The `& { $transaction }` intersection was slipping past TS's index-signature
// check — the intersection is fine at the value level, but TS's structural
// assignability from an object literal treats every declared key as candidate
// for the `Record<string, PrismaModelMock>` index. Model it as an explicit
// interface so `$transaction` is a distinct field, not an index-covered one.
export interface PrismaMock {
  plan: PrismaModelMock;
  dayPlan: PrismaModelMock;
  activity: PrismaModelMock;
  task: PrismaModelMock;
  checklist: PrismaModelMock;
  checklistItem: PrismaModelMock;
  checklistTemplate: PrismaModelMock;
  checklistTemplateItem: PrismaModelMock;
  sharedAccess: PrismaModelMock;
  shareLink: PrismaModelMock;
  sharedChecklistAccess: PrismaModelMock;
  checklistShareLink: PrismaModelMock;
  userSettings: PrismaModelMock;
  $transaction: ReturnType<typeof vi.fn>;
}

export const prismaMock: PrismaMock = {
  plan: makeModel(),
  dayPlan: makeModel(),
  activity: makeModel(),
  task: makeModel(),
  checklist: makeModel(),
  checklistItem: makeModel(),
  checklistTemplate: makeModel(),
  checklistTemplateItem: makeModel(),
  sharedAccess: makeModel(),
  shareLink: makeModel(),
  sharedChecklistAccess: makeModel(),
  checklistShareLink: makeModel(),
  userSettings: makeModel(),
  $transaction: vi.fn(async (input: unknown) => {
    // Two shapes: array of promises OR a callback receiving `tx`.
    if (typeof input === 'function') {
      return (input as (tx: PrismaMock) => Promise<unknown>)(prismaMock);
    }
    if (Array.isArray(input)) return Promise.all(input);
    return input;
  }),
};

// Keys that address a PrismaModelMock (everything except `$transaction`).
// Kept in sync with the PrismaMock interface — one place to update when a
// new Prisma model gets used by a route under test.
const MODEL_KEYS = [
  'plan', 'dayPlan', 'activity', 'task',
  'checklist', 'checklistItem', 'checklistTemplate', 'checklistTemplateItem',
  'sharedAccess', 'shareLink',
  'sharedChecklistAccess', 'checklistShareLink',
  'userSettings',
] as const satisfies ReadonlyArray<Exclude<keyof PrismaMock, '$transaction'>>;

export function resetPrisma(): void {
  prismaMock.$transaction.mockClear();
  // Re-install the default transaction handler after clearing.
  prismaMock.$transaction.mockImplementation(async (input: unknown) => {
    if (typeof input === 'function') {
      return (input as (tx: PrismaMock) => Promise<unknown>)(prismaMock);
    }
    if (Array.isArray(input)) return Promise.all(input);
    return input;
  });
  for (const key of MODEL_KEYS) {
    const model = prismaMock[key];
    for (const fn of Object.values(model)) {
      (fn as ReturnType<typeof vi.fn>).mockReset();
    }
  }
}

export function prismaMockFactory() {
  return { default: prismaMock };
}

// ─── Request builders ──────────────────────────────────────────────────────

/**
 * Build a `Request` for a route handler. Use this instead of `new Request()`
 * so URL, method, and body serialization are consistent across tests.
 */
export function makeRequest(
  url: string,
  init?: { method?: string; body?: unknown; headers?: Record<string, string> },
): Request {
  const method = init?.method ?? 'GET';
  const headers = new Headers({
    'content-type': 'application/json',
    ...(init?.headers ?? {}),
  });
  const body =
    init?.body === undefined
      ? undefined
      : typeof init.body === 'string'
        ? init.body
        : JSON.stringify(init.body);
  return new Request(new URL(url, 'http://localhost'), { method, headers, body });
}

/**
 * Convenience: read a NextResponse's JSON body without racing.
 * NextResponse is a Response subclass so `.json()` works, but we normalize
 * status + body into a single object for assertions.
 */
export async function readJson<T = unknown>(res: Response): Promise<{ status: number; body: T }> {
  const status = res.status;
  const body = (await res.json()) as T;
  return { status, body };
}
