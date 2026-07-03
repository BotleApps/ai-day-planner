import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setAuth, resetAuth, prismaMock, resetPrisma,
  authMockFactory, prismaMockFactory, makeRequest, readJson,
} from './_harness/mocks';

vi.mock('@/auth', () => authMockFactory());
vi.mock('@/lib/db', () => prismaMockFactory());

import { GET, POST, PUT, PATCH, DELETE } from '@/app/api/checklists/route';

// Helper: stub the checklist.findUnique that resolveChecklistPermission calls.
// The include shape is `{ sharedAccess: { where, include: { shareLink } } }`.
function stubPermission(
  args: {
    checklistId: string;
    ownerUserId: string;
    caller?: { userId: string; permission: 'view' | 'edit'; linkActive?: boolean; linkId?: string };
  },
) {
  const shared = args.caller
    ? [{
        permission: args.caller.permission,
        linkId: args.caller.linkId ?? null,
        shareLink: args.caller.linkId ? { isActive: args.caller.linkActive ?? true } : null,
      }]
    : [];
  prismaMock.checklist.findUnique.mockResolvedValueOnce({
    id: args.checklistId,
    userId: args.ownerUserId,
    sharedAccess: shared,
  });
}

// ─── POST /api/checklists ─────────────────────────────────────────────────

describe('POST /api/checklists', () => {
  beforeEach(() => { resetAuth(); resetPrisma(); });

  it('401 when unauthenticated', async () => {
    setAuth(null);
    const res = await POST(makeRequest('/api/checklists', {
      method: 'POST', body: { title: 't' },
    }));
    expect(res.status).toBe(401);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    { case: 'missing title', body: {} },
    { case: 'title too long', body: { title: 'x'.repeat(201) } },
    { case: 'description too long', body: { title: 't', description: 'x'.repeat(5001) } },
    { case: 'too many items', body: { title: 't', items: Array.from({ length: 501 }, (_, i) => ({ title: `i${i}` })) } },
  ])('400 when $case', async ({ body }) => {
    setAuth({ user: { id: 'u1' } });
    const res = await POST(makeRequest('/api/checklists', { method: 'POST', body }));
    expect(res.status).toBe(400);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('creates checklist with userId from session (ignoring client-supplied userId)', async () => {
    setAuth({ user: { id: 'u1' } });
    prismaMock.checklist.create.mockResolvedValue({ id: 'cl1' });
    prismaMock.checklistItem.createMany.mockResolvedValue({ count: 0 });
    prismaMock.checklist.findUnique.mockResolvedValueOnce({
      id: 'cl1', userId: 'u1', title: 't', description: '',
      dueDate: null, dueTime: null, planId: null,
      shareLink: null, isPublic: false,
      createdAt: new Date(), updatedAt: new Date(), items: [],
    });

    await POST(makeRequest('/api/checklists', {
      method: 'POST',
      body: { title: 't', userId: 'attacker' },
    }));
    const call = prismaMock.checklist.create.mock.calls[0][0];
    expect(call.data.userId).toBe('u1');
  });

  it('creates items in the same transaction as the checklist', async () => {
    setAuth({ user: { id: 'u1' } });
    prismaMock.checklist.create.mockResolvedValue({ id: 'cl1' });
    prismaMock.checklistItem.createMany.mockResolvedValue({ count: 2 });
    prismaMock.checklist.findUnique.mockResolvedValueOnce({
      id: 'cl1', userId: 'u1', title: 't', description: '',
      dueDate: null, dueTime: null, planId: null,
      shareLink: null, isPublic: false,
      createdAt: new Date(), updatedAt: new Date(), items: [],
    });

    await POST(makeRequest('/api/checklists', {
      method: 'POST',
      body: { title: 't', items: [{ title: 'a' }, { title: 'b' }] },
    }));

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    // Items get sequential order 0..n-1.
    const createManyArgs = prismaMock.checklistItem.createMany.mock.calls[0][0];
    expect(createManyArgs.data.map((d: { order: number }) => d.order)).toEqual([0, 1]);
  });
});

// ─── PUT /api/checklists — permission required ────────────────────────────

describe('PUT /api/checklists', () => {
  beforeEach(() => { resetAuth(); resetPrisma(); });

  it('403 when caller has view-only shared permission (cannot edit metadata)', async () => {
    setAuth({ user: { id: 'u2' } });
    stubPermission({ checklistId: 'cl1', ownerUserId: 'owner',
      caller: { userId: 'u2', permission: 'view' } });
    const res = await PUT(makeRequest('/api/checklists', {
      method: 'PUT', body: { id: 'cl1', title: 'hijack' },
    }));
    expect(res.status).toBe(403);
    expect(prismaMock.checklist.update).not.toHaveBeenCalled();
  });

  it('403 when caller has no permission at all', async () => {
    setAuth({ user: { id: 'stranger' } });
    stubPermission({ checklistId: 'cl1', ownerUserId: 'owner' /* no caller share */ });
    const res = await PUT(makeRequest('/api/checklists', {
      method: 'PUT', body: { id: 'cl1', title: 'hijack' },
    }));
    expect(res.status).toBe(403);
  });

  it("403 when share link that granted access is REVOKED", async () => {
    setAuth({ user: { id: 'u2' } });
    stubPermission({
      checklistId: 'cl1', ownerUserId: 'owner',
      caller: { userId: 'u2', permission: 'edit', linkId: 'link1', linkActive: false },
    });
    const res = await PUT(makeRequest('/api/checklists', {
      method: 'PUT', body: { id: 'cl1', title: 'hijack' },
    }));
    expect(res.status).toBe(403);
    expect(prismaMock.checklist.update).not.toHaveBeenCalled();
  });

  it("owner CAN edit metadata (all fields)", async () => {
    setAuth({ user: { id: 'owner' } });
    stubPermission({ checklistId: 'cl1', ownerUserId: 'owner' });
    prismaMock.checklist.update.mockResolvedValue({});
    const res = await PUT(makeRequest('/api/checklists', {
      method: 'PUT',
      body: { id: 'cl1', title: 'new', description: 'd', dueDate: '2026-07-05', dueTime: '10:00', planId: null },
    }));
    expect(res.status).toBe(200);
    const args = prismaMock.checklist.update.mock.calls[0][0];
    expect(args.data.title).toBe('new');
    expect(args.data.dueDate).toBe('2026-07-05');
  });

  it("shared 'edit' user CAN edit metadata via active link", async () => {
    setAuth({ user: { id: 'u2' } });
    stubPermission({
      checklistId: 'cl1', ownerUserId: 'owner',
      caller: { userId: 'u2', permission: 'edit', linkId: 'link1', linkActive: true },
    });
    prismaMock.checklist.update.mockResolvedValue({});
    const res = await PUT(makeRequest('/api/checklists', {
      method: 'PUT', body: { id: 'cl1', title: 'updated' },
    }));
    expect(res.status).toBe(200);
  });

  it('400 when id is missing', async () => {
    setAuth({ user: { id: 'owner' } });
    const res = await PUT(makeRequest('/api/checklists', {
      method: 'PUT', body: { title: 'x' },
    }));
    expect(res.status).toBe(400);
    expect(prismaMock.checklist.findUnique).not.toHaveBeenCalled();
  });
});

// ─── DELETE — owner ONLY ──────────────────────────────────────────────────

describe('DELETE /api/checklists', () => {
  beforeEach(() => { resetAuth(); resetPrisma(); });

  it('401 when unauthenticated', async () => {
    setAuth(null);
    const res = await DELETE(makeRequest('/api/checklists?id=cl1', { method: 'DELETE' }));
    expect(res.status).toBe(401);
    expect(prismaMock.checklist.deleteMany).not.toHaveBeenCalled();
  });

  it('400 when id missing', async () => {
    setAuth({ user: { id: 'u1' } });
    const res = await DELETE(makeRequest('/api/checklists', { method: 'DELETE' }));
    expect(res.status).toBe(400);
  });

  it('404 for non-owner (deleteMany result.count=0) — even with share edit permission', async () => {
    setAuth({ user: { id: 'u2' } });
    prismaMock.checklist.deleteMany.mockResolvedValue({ count: 0 });
    const res = await DELETE(makeRequest('/api/checklists?id=cl1', { method: 'DELETE' }));
    expect(res.status).toBe(404);
    // The where clause MUST filter by userId — DELETE is owner-only.
    const args = prismaMock.checklist.deleteMany.mock.calls[0][0];
    expect(args.where).toEqual({ id: 'cl1', userId: 'u2' });
  });

  it('200 on successful owner delete', async () => {
    setAuth({ user: { id: 'owner' } });
    prismaMock.checklist.deleteMany.mockResolvedValue({ count: 1 });
    const res = await DELETE(makeRequest('/api/checklists?id=cl1', { method: 'DELETE' }));
    expect(res.status).toBe(200);
  });
});

// ─── PATCH — legacy share link (owner only) ───────────────────────────────

describe('PATCH /api/checklists (legacy share link)', () => {
  beforeEach(() => { resetAuth(); resetPrisma(); });

  it('404 when the caller is not the owner', async () => {
    setAuth({ user: { id: 'u2' } });
    prismaMock.checklist.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeRequest('/api/checklists', {
      method: 'PATCH', body: { id: 'cl1' },
    }));
    expect(res.status).toBe(404);
    expect(prismaMock.checklist.update).not.toHaveBeenCalled();
    // Ownership filter must be in the where clause.
    expect(prismaMock.checklist.findFirst.mock.calls[0][0].where).toEqual({
      id: 'cl1', userId: 'u2',
    });
  });

  it('reuses an existing shareLink token (idempotent)', async () => {
    setAuth({ user: { id: 'owner' } });
    prismaMock.checklist.findFirst.mockResolvedValue({
      id: 'cl1', userId: 'owner', shareLink: 'existing-token',
    });
    prismaMock.checklist.update.mockResolvedValue({});
    const res = await PATCH(makeRequest('/api/checklists', {
      method: 'PATCH', body: { id: 'cl1' },
    }));
    const { body } = await readJson<{ shareLink: string }>(res);
    expect(body.shareLink).toBe('existing-token');
  });

  it('generates a fresh token when none exists (matches generateShareToken shape)', async () => {
    setAuth({ user: { id: 'owner' } });
    prismaMock.checklist.findFirst.mockResolvedValue({
      id: 'cl1', userId: 'owner', shareLink: null,
    });
    prismaMock.checklist.update.mockResolvedValue({});
    const res = await PATCH(makeRequest('/api/checklists', {
      method: 'PATCH', body: { id: 'cl1' },
    }));
    const { body } = await readJson<{ shareLink: string }>(res);
    expect(body.shareLink).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });
});

// ─── GET single by id / shared list ───────────────────────────────────────

describe('GET /api/checklists', () => {
  beforeEach(() => { resetAuth(); resetPrisma(); });

  it('401 with empty list when unauthenticated', async () => {
    setAuth(null);
    const res = await GET(makeRequest('/api/checklists'));
    const { status, body } = await readJson<{ error: string; checklists: unknown[] }>(res);
    expect(status).toBe(401);
    expect(body.checklists).toEqual([]);
  });

  it('single-checklist lookup returns 404 when permission is null', async () => {
    setAuth({ user: { id: 'stranger' } });
    stubPermission({ checklistId: 'cl1', ownerUserId: 'owner' });
    const res = await GET(makeRequest('/api/checklists?id=cl1'));
    expect(res.status).toBe(404);
  });

  it("returns userPermission='owner' when caller owns the checklist", async () => {
    setAuth({ user: { id: 'owner' } });
    stubPermission({ checklistId: 'cl1', ownerUserId: 'owner' });
    prismaMock.checklist.findUnique.mockResolvedValueOnce({
      id: 'cl1', userId: 'owner', title: 't', description: '',
      dueDate: null, dueTime: null, planId: null,
      shareLink: null, isPublic: false,
      createdAt: new Date(), updatedAt: new Date(), items: [],
    });
    const res = await GET(makeRequest('/api/checklists?id=cl1'));
    const { status, body } = await readJson<{ userPermission: string }>(res);
    expect(status).toBe(200);
    expect(body.userPermission).toBe('owner');
  });

  it('shared-with-me tab filters by userId and either no link or active link', async () => {
    setAuth({ user: { id: 'u2' } });
    prismaMock.sharedChecklistAccess.findMany.mockResolvedValue([]);
    await GET(makeRequest('/api/checklists?tab=shared'));
    const args = prismaMock.sharedChecklistAccess.findMany.mock.calls[0][0];
    expect(args.where.userId).toBe('u2');
    // OR clause: linkId is null (direct share) OR the associated link is active.
    expect(args.where.OR).toEqual(expect.arrayContaining([
      { linkId: null },
      { shareLink: { isActive: true } },
    ]));
  });
});

// ─── GET ?share=<token> ────────────────────────────────────────────────────

describe('GET /api/checklists?share=<token>', () => {
  beforeEach(() => { resetAuth(); resetPrisma(); });

  it('anon caller gets checklist for an active share link', async () => {
    setAuth(null);
    prismaMock.checklistShareLink.findUnique.mockResolvedValue({
      id: 'sl1', token: 'tok', checklistId: 'cl1',
      permission: 'view', isActive: true,
      checklist: { id: 'cl1', userId: 'owner', title: 't', description: '',
        dueDate: null, dueTime: null, planId: null,
        shareLink: null, isPublic: false,
        createdAt: new Date(), updatedAt: new Date(), items: [] },
    });
    const res = await GET(makeRequest('/api/checklists?share=tok', {
      headers: { 'x-forwarded-for': '203.0.113.5' },
    }));
    expect(res.status).toBe(200);
    // Anon caller must NOT trigger a sharedChecklistAccess upsert.
    expect(prismaMock.sharedChecklistAccess.upsert).not.toHaveBeenCalled();
  });

  it('records SharedChecklistAccess for an authenticated non-owner', async () => {
    setAuth({ user: { id: 'u2', email: 'u2@x.com', name: 'U2' } });
    prismaMock.checklistShareLink.findUnique.mockResolvedValue({
      id: 'sl1', token: 'tok', checklistId: 'cl1',
      permission: 'edit', isActive: true,
      checklist: { id: 'cl1', userId: 'owner', title: 't', description: '',
        dueDate: null, dueTime: null, planId: null,
        shareLink: null, isPublic: false,
        createdAt: new Date(), updatedAt: new Date(), items: [] },
    });
    prismaMock.sharedChecklistAccess.upsert.mockResolvedValue({});
    const res = await GET(makeRequest('/api/checklists?share=tok'));
    expect(res.status).toBe(200);
    expect(prismaMock.sharedChecklistAccess.upsert).toHaveBeenCalledOnce();
    const call = prismaMock.sharedChecklistAccess.upsert.mock.calls[0][0];
    expect(call.where.userId_checklistId).toEqual({ userId: 'u2', checklistId: 'cl1' });
    expect(call.create.permission).toBe('edit');
  });

  it('429 when the same IP hammers the share endpoint (rate-limited)', async () => {
    setAuth(null);
    prismaMock.checklistShareLink.findUnique.mockResolvedValue(null);
    prismaMock.checklist.findUnique.mockResolvedValue(null);
    const ip = { 'x-forwarded-for': '198.51.100.42' };
    for (let i = 0; i < 60; i++) {
      await GET(makeRequest(`/api/checklists?share=x${i}`, { headers: ip }));
    }
    const res = await GET(makeRequest('/api/checklists?share=xfinal', { headers: ip }));
    expect(res.status).toBe(429);
  });
});
