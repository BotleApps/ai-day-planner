import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setAuth, resetAuth, prismaMock, resetPrisma,
  authMockFactory, prismaMockFactory, makeRequest, readJson,
} from './_harness/mocks';

vi.mock('@/auth', () => authMockFactory());
vi.mock('@/lib/db', () => prismaMockFactory());

import { GET, POST, PUT, PATCH, DELETE } from '@/app/api/plans/route';

// ─── auth gates & ownership ────────────────────────────────────────────────

describe('GET /api/plans', () => {
  beforeEach(() => { resetAuth(); resetPrisma(); });

  it('401 when no session and no share token', async () => {
    setAuth(null);
    const res = await GET(makeRequest('/api/plans'));
    expect(res.status).toBe(401);
    expect(prismaMock.plan.findMany).not.toHaveBeenCalled();
  });

  it('scopes plans findMany to createdBy = session userId', async () => {
    setAuth({ user: { id: 'user-1' } });
    prismaMock.plan.findMany.mockResolvedValue([]);
    await GET(makeRequest('/api/plans'));
    const args = prismaMock.plan.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ createdBy: 'user-1' });
    expect(args.orderBy).toEqual({ updatedAt: 'desc' });
  });

  it('single-plan lookup returns 404 when caller does not own it AND no share access exists', async () => {
    setAuth({ user: { id: 'user-1' } });
    prismaMock.plan.findFirst.mockResolvedValue(null);
    prismaMock.sharedAccess.findUnique.mockResolvedValue(null);
    const res = await GET(makeRequest('/api/plans?id=someone-elses'));
    expect(res.status).toBe(404);
  });

  it("returns userPermission='owner' when caller owns the plan", async () => {
    setAuth({ user: { id: 'user-1' } });
    prismaMock.plan.findFirst.mockResolvedValueOnce({
      id: 'p1', createdBy: 'user-1', title: 't', days: [],
    });
    const res = await GET(makeRequest('/api/plans?id=p1'));
    const { status, body } = await readJson<{ userPermission: string; plan: { id: string } }>(res);
    expect(status).toBe(200);
    expect(body.userPermission).toBe('owner');
    // Ownership check MUST include createdBy filter, not just id.
    expect(prismaMock.plan.findFirst.mock.calls[0][0].where).toEqual({
      id: 'p1', createdBy: 'user-1',
    });
  });

  it("returns userPermission from SharedAccess when link is active", async () => {
    setAuth({ user: { id: 'user-2' } });
    prismaMock.plan.findFirst
      .mockResolvedValueOnce(null)           // not owner
      .mockResolvedValueOnce({ id: 'p1', createdBy: 'user-1', title: 't', days: [] });
    prismaMock.sharedAccess.findUnique.mockResolvedValue({
      userId: 'user-2', planId: 'p1', permission: 'edit',
      shareLink: { isActive: true },
    });

    const res = await GET(makeRequest('/api/plans?id=p1'));
    const { status, body } = await readJson<{ userPermission: string }>(res);
    expect(status).toBe(200);
    expect(body.userPermission).toBe('edit');
  });

  it('ignores SharedAccess when its link is inactive', async () => {
    setAuth({ user: { id: 'user-2' } });
    prismaMock.plan.findFirst
      .mockResolvedValueOnce(null) // not owner
      .mockResolvedValueOnce(null) // no public fallback
      ;
    prismaMock.sharedAccess.findUnique.mockResolvedValue({
      userId: 'user-2', planId: 'p1', permission: 'edit',
      shareLink: { isActive: false }, // revoked
    });
    const res = await GET(makeRequest('/api/plans?id=p1'));
    expect(res.status).toBe(404);
  });
});

describe('GET /api/plans?share=<token>', () => {
  beforeEach(() => { resetAuth(); resetPrisma(); });

  it('anon caller gets the plan when ShareLink is active', async () => {
    setAuth(null);
    prismaMock.shareLink.findUnique.mockResolvedValue({
      id: 'sl1', token: 'tok', planId: 'p1', permission: 'view', isActive: true,
      plan: { id: 'p1', createdBy: 'owner', title: 't', days: [] },
    });
    const res = await GET(makeRequest('/api/plans?share=tok', {
      headers: { 'x-forwarded-for': '203.0.113.5' },
    }));
    const { status, body } = await readJson<{ userPermission: string; plan: unknown }>(res);
    expect(status).toBe(200);
    expect(body.userPermission).toBe('view');
    // Anonymous caller must NOT trigger a sharedAccess upsert.
    expect(prismaMock.sharedAccess.upsert).not.toHaveBeenCalled();
  });

  it('records SharedAccess for an authenticated non-owner viewing via link', async () => {
    setAuth({ user: { id: 'user-2', email: 'u2@x.com', name: 'U2' } });
    prismaMock.shareLink.findUnique.mockResolvedValue({
      id: 'sl1', token: 'tok', planId: 'p1', permission: 'edit', isActive: true,
      plan: { id: 'p1', createdBy: 'owner', title: 't', days: [] },
    });
    prismaMock.sharedAccess.upsert.mockResolvedValue({});
    const res = await GET(makeRequest('/api/plans?share=tok'));
    expect(res.status).toBe(200);
    expect(prismaMock.sharedAccess.upsert).toHaveBeenCalledOnce();
    const upsertArgs = prismaMock.sharedAccess.upsert.mock.calls[0][0];
    expect(upsertArgs.where.userId_planId).toEqual({ userId: 'user-2', planId: 'p1' });
    expect(upsertArgs.create.permission).toBe('edit');
  });

  it('404 when the share token is unknown and no plan.shareLink fallback matches', async () => {
    setAuth(null);
    prismaMock.shareLink.findUnique.mockResolvedValue(null);
    prismaMock.plan.findUnique.mockResolvedValue(null);
    const res = await GET(makeRequest('/api/plans?share=bad'));
    expect(res.status).toBe(404);
  });

  it('429 when the same IP hammers the share endpoint', async () => {
    setAuth(null);
    prismaMock.shareLink.findUnique.mockResolvedValue(null);
    prismaMock.plan.findUnique.mockResolvedValue(null);
    // Fire 61 requests from the same IP — limit is 60/minute.
    const ip = { 'x-forwarded-for': '198.51.100.99' };
    for (let i = 0; i < 60; i++) {
      await GET(makeRequest(`/api/plans?share=x${i}`, { headers: ip }));
    }
    const res = await GET(makeRequest('/api/plans?share=xfinal', { headers: ip }));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });
});

// ─── POST — validation & userId enforcement ────────────────────────────────

describe('POST /api/plans', () => {
  beforeEach(() => { resetAuth(); resetPrisma(); });

  it('401 when unauthenticated', async () => {
    setAuth(null);
    const res = await POST(makeRequest('/api/plans', {
      method: 'POST',
      body: { title: 'x', startDate: '2026-07-01', endDate: '2026-07-03' },
    }));
    expect(res.status).toBe(401);
  });

  it.each([
    { case: 'missing title', body: { startDate: '2026-07-01', endDate: '2026-07-03' } },
    { case: 'missing startDate', body: { title: 't', endDate: '2026-07-03' } },
    { case: 'missing endDate', body: { title: 't', startDate: '2026-07-01' } },
    { case: 'title too long', body: { title: 'x'.repeat(201), startDate: '2026-07-01', endDate: '2026-07-03' } },
    { case: 'bad startDate format', body: { title: 't', startDate: 'yesterday', endDate: '2026-07-03' } },
    { case: 'bad endDate format', body: { title: 't', startDate: '2026-07-01', endDate: '07/03' } },
    { case: 'endDate before startDate', body: { title: 't', startDate: '2026-07-10', endDate: '2026-07-05' } },
  ])('400 when $case', async ({ body }) => {
    setAuth({ user: { id: 'user-1' } });
    const res = await POST(makeRequest('/api/plans', { method: 'POST', body }));
    expect(res.status).toBe(400);
    expect(prismaMock.plan.create).not.toHaveBeenCalled();
  });

  it('persists createdBy from session, IGNORING client-supplied createdBy', async () => {
    setAuth({ user: { id: 'user-1' } });
    prismaMock.plan.create.mockResolvedValue({ id: 'p1', createdBy: 'user-1', title: 't', days: [] });
    await POST(makeRequest('/api/plans', {
      method: 'POST',
      body: {
        title: 't', startDate: '2026-07-01', endDate: '2026-07-02',
        // Attacker attempts to write the plan under another user.
        createdBy: 'attacker',
      },
    }));
    const args = prismaMock.plan.create.mock.calls[0][0];
    expect(args.data.createdBy).toBe('user-1');
  });
});

// ─── PUT — ownership + date rebuild ───────────────────────────────────────

describe('PUT /api/plans', () => {
  beforeEach(() => { resetAuth(); resetPrisma(); });

  it('404 when the plan does not belong to the caller', async () => {
    setAuth({ user: { id: 'user-1' } });
    prismaMock.plan.findFirst.mockResolvedValue(null);
    const res = await PUT(makeRequest('/api/plans', {
      method: 'PUT',
      body: { id: 'not-mine', title: 'hijacked' },
    }));
    expect(res.status).toBe(404);
    expect(prismaMock.plan.update).not.toHaveBeenCalled();
    // Ownership filter must be in the where clause.
    expect(prismaMock.plan.findFirst.mock.calls[0][0].where).toEqual({
      id: 'not-mine', createdBy: 'user-1',
    });
  });

  it('400 when id is missing', async () => {
    setAuth({ user: { id: 'user-1' } });
    const res = await PUT(makeRequest('/api/plans', { method: 'PUT', body: { title: 'x' } }));
    expect(res.status).toBe(400);
  });

  it('updates scalar fields without rebuilding days when dates are unchanged', async () => {
    setAuth({ user: { id: 'user-1' } });
    prismaMock.plan.findFirst.mockResolvedValue({
      id: 'p1', createdBy: 'user-1', startDate: '2026-07-01', endDate: '2026-07-03', days: [],
    });
    prismaMock.plan.update.mockResolvedValue({});
    await PUT(makeRequest('/api/plans', {
      method: 'PUT',
      body: { id: 'p1', title: 'new title' },
    }));
    expect(prismaMock.plan.update).toHaveBeenCalledOnce();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rebuilds day rows in a transaction when the date range changes', async () => {
    setAuth({ user: { id: 'user-1' } });
    prismaMock.plan.findFirst.mockResolvedValue({
      id: 'p1', createdBy: 'user-1',
      startDate: '2026-07-01', endDate: '2026-07-02',
      days: [
        { id: 'd1', date: '2026-07-01', dayNumber: 1 },
        { id: 'd2', date: '2026-07-02', dayNumber: 2 },
      ],
    });
    prismaMock.dayPlan.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.dayPlan.update.mockResolvedValue({});
    prismaMock.dayPlan.create.mockResolvedValue({});
    prismaMock.plan.update.mockResolvedValue({});

    // Extend range to 2026-07-01..03 — need to add one new day.
    await PUT(makeRequest('/api/plans', {
      method: 'PUT',
      body: { id: 'p1', endDate: '2026-07-03' },
    }));

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    // 2026-07-01 and 2026-07-02 already exist → update dayNumber only.
    // 2026-07-03 is new → create.
    const created = prismaMock.dayPlan.create.mock.calls.map(c => c[0].data.date);
    expect(created).toEqual(['2026-07-03']);
  });
});

// ─── PATCH — share link idempotency ────────────────────────────────────────

describe('PATCH /api/plans (share link generation)', () => {
  beforeEach(() => { resetAuth(); resetPrisma(); });

  it('returns the EXISTING view token when one is already active (idempotent)', async () => {
    setAuth({ user: { id: 'user-1' } });
    prismaMock.plan.findFirst.mockResolvedValue({ id: 'p1', createdBy: 'user-1' });
    prismaMock.shareLink.findFirst.mockResolvedValue({
      id: 'sl1', planId: 'p1', permission: 'view', isActive: true, token: 'existing-token',
    });

    const res = await PATCH(makeRequest('/api/plans', {
      method: 'PATCH', body: { id: 'p1' },
    }));
    const { status, body } = await readJson<{ shareLink: string }>(res);
    expect(status).toBe(200);
    expect(body.shareLink).toBe('existing-token');
    // Must NOT create a duplicate link.
    expect(prismaMock.shareLink.create).not.toHaveBeenCalled();
  });

  it('generates a fresh token when none exists', async () => {
    setAuth({ user: { id: 'user-1' } });
    prismaMock.plan.findFirst.mockResolvedValue({ id: 'p1', createdBy: 'user-1' });
    prismaMock.shareLink.findFirst.mockResolvedValue(null);
    prismaMock.shareLink.create.mockResolvedValue({});
    prismaMock.plan.update.mockResolvedValue({});

    const res = await PATCH(makeRequest('/api/plans', {
      method: 'PATCH', body: { id: 'p1' },
    }));
    const { status, body } = await readJson<{ shareLink: string }>(res);
    expect(status).toBe(200);
    // Token should be a 32-char base64url (matches generateShareToken shape).
    expect(body.shareLink).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });

  it('404 when the caller does not own the plan', async () => {
    setAuth({ user: { id: 'user-1' } });
    prismaMock.plan.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeRequest('/api/plans', {
      method: 'PATCH', body: { id: 'someone-elses' },
    }));
    expect(res.status).toBe(404);
    expect(prismaMock.shareLink.create).not.toHaveBeenCalled();
  });
});

// ─── DELETE — ownership + cascade ──────────────────────────────────────────

describe('DELETE /api/plans', () => {
  beforeEach(() => { resetAuth(); resetPrisma(); });

  it('401 when unauthenticated', async () => {
    setAuth(null);
    const res = await DELETE(makeRequest('/api/plans?id=p1', { method: 'DELETE' }));
    expect(res.status).toBe(401);
    expect(prismaMock.plan.delete).not.toHaveBeenCalled();
  });

  it('404 when the plan belongs to another user (findFirst returns null)', async () => {
    setAuth({ user: { id: 'user-1' } });
    prismaMock.plan.findFirst.mockResolvedValue(null);
    const res = await DELETE(makeRequest('/api/plans?id=other', { method: 'DELETE' }));
    expect(res.status).toBe(404);
    expect(prismaMock.plan.delete).not.toHaveBeenCalled();
  });

  it('400 when id query param missing', async () => {
    setAuth({ user: { id: 'user-1' } });
    const res = await DELETE(makeRequest('/api/plans', { method: 'DELETE' }));
    expect(res.status).toBe(400);
  });

  it('200 on successful delete; where filter scoped by createdBy', async () => {
    setAuth({ user: { id: 'user-1' } });
    prismaMock.plan.findFirst.mockResolvedValue({ id: 'p1', createdBy: 'user-1' });
    prismaMock.plan.delete.mockResolvedValue({});
    const res = await DELETE(makeRequest('/api/plans?id=p1', { method: 'DELETE' }));
    expect(res.status).toBe(200);
    expect(prismaMock.plan.findFirst.mock.calls[0][0].where).toEqual({
      id: 'p1', createdBy: 'user-1',
    });
  });
});
