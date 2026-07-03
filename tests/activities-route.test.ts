import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setAuth, resetAuth, prismaMock, resetPrisma,
  authMockFactory, prismaMockFactory, makeRequest,
} from './_harness/mocks';

vi.mock('@/auth', () => authMockFactory());
vi.mock('@/lib/db', () => prismaMockFactory());

import { POST, PUT, PATCH, DELETE } from '@/app/api/activities/route';

// Helper: bootstrap the ownership+access mocks for a plan the caller owns.
function stubOwnedPlan(planId: string, userId: string) {
  prismaMock.plan.findFirst.mockResolvedValue({ id: planId, createdBy: userId });
}

// Helper: caller has active 'edit' share access.
function stubEditShared(planId: string, userId: string) {
  // canWritePlan first checks findFirst by createdBy — return null so it
  // falls through to sharedAccess.
  prismaMock.plan.findFirst.mockImplementation(async (args: { where?: { createdBy?: string } }) => {
    if (args.where?.createdBy) return null;
    return { id: planId };
  });
  prismaMock.sharedAccess.findUnique.mockResolvedValue({
    userId, planId, permission: 'edit',
    shareLink: { isActive: true },
  });
}

// Helper: caller has active 'view' share access (no write).
function stubViewShared(planId: string, userId: string) {
  prismaMock.plan.findFirst.mockImplementation(async (args: { where?: { createdBy?: string } }) => {
    if (args.where?.createdBy) return null;
    return { id: planId };
  });
  prismaMock.sharedAccess.findUnique.mockResolvedValue({
    userId, planId, permission: 'view',
    shareLink: { isActive: true },
  });
}

describe('POST /api/activities', () => {
  beforeEach(() => { resetAuth(); resetPrisma(); });

  it('401 when unauthenticated', async () => {
    setAuth(null);
    const res = await POST(makeRequest('/api/activities', {
      method: 'POST', body: { planId: 'p1', dayId: 'd1', activity: {} },
    }));
    expect(res.status).toBe(401);
  });

  it('400 when planId / dayId / activity is missing', async () => {
    setAuth({ user: { id: 'u1' } });
    const res = await POST(makeRequest('/api/activities', {
      method: 'POST', body: { planId: 'p1', dayId: 'd1' },
    }));
    expect(res.status).toBe(400);
  });

  it('403 when caller has view-only share permission (must not write)', async () => {
    setAuth({ user: { id: 'u2' } });
    stubViewShared('p1', 'u2');
    prismaMock.dayPlan.findFirst.mockResolvedValue({ id: 'd1', planId: 'p1' });
    const res = await POST(makeRequest('/api/activities', {
      method: 'POST', body: { planId: 'p1', dayId: 'd1', activity: { title: 'x' } },
    }));
    expect(res.status).toBe(403);
    expect(prismaMock.activity.create).not.toHaveBeenCalled();
  });

  it('owner: creates activity and bumps plan.updatedAt', async () => {
    setAuth({ user: { id: 'u1' } });
    stubOwnedPlan('p1', 'u1');
    prismaMock.dayPlan.findFirst.mockResolvedValue({ id: 'd1', planId: 'p1' });
    prismaMock.activity.create.mockResolvedValue({
      id: 'a1', title: 'x', type: 'activity', startTime: '09:00', duration: 60, status: 'planned', order: 0,
    });
    prismaMock.plan.update.mockResolvedValue({});

    const res = await POST(makeRequest('/api/activities', {
      method: 'POST',
      body: { planId: 'p1', dayId: 'd1', activity: { title: 'x', startTime: '09:00' } },
    }));
    expect(res.status).toBe(200);
    expect(prismaMock.activity.create).toHaveBeenCalledOnce();
    expect(prismaMock.plan.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p1' } }),
    );
  });

  it("shared 'edit' user CAN add activities", async () => {
    setAuth({ user: { id: 'u2' } });
    stubEditShared('p1', 'u2');
    prismaMock.dayPlan.findFirst.mockResolvedValue({ id: 'd1', planId: 'p1' });
    prismaMock.activity.create.mockResolvedValue({
      id: 'a1', title: 'x', type: 'activity', startTime: '09:00', duration: 60, status: 'planned', order: 0,
    });
    const res = await POST(makeRequest('/api/activities', {
      method: 'POST',
      body: { planId: 'p1', dayId: 'd1', activity: { title: 'x' } },
    }));
    expect(res.status).toBe(200);
  });
});

describe('PUT /api/activities (single update)', () => {
  beforeEach(() => { resetAuth(); resetPrisma(); });

  it('403 for view-only shared user', async () => {
    setAuth({ user: { id: 'u2' } });
    stubViewShared('p1', 'u2');
    const res = await PUT(makeRequest('/api/activities', {
      method: 'PUT',
      body: { planId: 'p1', dayId: 'd1', activityId: 'a1', updates: { title: 'no' } },
    }));
    expect(res.status).toBe(403);
    expect(prismaMock.activity.updateMany).not.toHaveBeenCalled();
  });

  it('only whitelisted fields are copied into the update payload', async () => {
    setAuth({ user: { id: 'u1' } });
    stubOwnedPlan('p1', 'u1');
    prismaMock.activity.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.plan.update.mockResolvedValue({});

    await PUT(makeRequest('/api/activities', {
      method: 'PUT',
      body: {
        planId: 'p1', dayId: 'd1', activityId: 'a1',
        updates: {
          title: 'new', startTime: '10:00',
          // Attacker tries to write foreign keys / immutable fields.
          dayPlanId: 'hijack', id: 'hijack-id', userId: 'foreign',
        },
      },
    }));
    const args = prismaMock.activity.updateMany.mock.calls[0][0];
    expect(args.data.title).toBe('new');
    expect(args.data.startTime).toBe('10:00');
    expect(args.data.dayPlanId).toBeUndefined();
    expect(args.data.id).toBeUndefined();
    // Where clause locks by both activity id AND day id — no cross-day writes.
    expect(args.where).toEqual({ id: 'a1', dayPlanId: 'd1' });
  });
});

describe('DELETE /api/activities', () => {
  beforeEach(() => { resetAuth(); resetPrisma(); });

  it('403 for view-only shared user', async () => {
    setAuth({ user: { id: 'u2' } });
    stubViewShared('p1', 'u2');
    const res = await DELETE(makeRequest(
      '/api/activities?planId=p1&dayId=d1&activityId=a1',
      { method: 'DELETE' },
    ));
    expect(res.status).toBe(403);
    expect(prismaMock.activity.deleteMany).not.toHaveBeenCalled();
  });

  it('owner delete is scoped to activity id + dayPlanId', async () => {
    setAuth({ user: { id: 'u1' } });
    stubOwnedPlan('p1', 'u1');
    prismaMock.activity.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.plan.update.mockResolvedValue({});

    const res = await DELETE(makeRequest(
      '/api/activities?planId=p1&dayId=d1&activityId=a1',
      { method: 'DELETE' },
    ));
    expect(res.status).toBe(200);
    expect(prismaMock.activity.deleteMany.mock.calls[0][0].where).toEqual({
      id: 'a1', dayPlanId: 'd1',
    });
  });
});

// ─── PATCH bulk replace: the highest-risk endpoint ─────────────────────────

describe('PATCH /api/activities (bulk replace)', () => {
  beforeEach(() => { resetAuth(); resetPrisma(); });

  it('403 for view-only shared user (no mutation possible)', async () => {
    setAuth({ user: { id: 'u2' } });
    stubViewShared('p1', 'u2');
    const res = await PATCH(makeRequest('/api/activities', {
      method: 'PATCH',
      body: { planId: 'p1', dayId: 'd1', activities: [{ title: 'x' }] },
    }));
    expect(res.status).toBe(403);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.activity.deleteMany).not.toHaveBeenCalled();
  });

  it("shared 'edit' user CAN bulk-replace", async () => {
    setAuth({ user: { id: 'u2' } });
    stubEditShared('p1', 'u2');
    prismaMock.activity.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.activity.upsert.mockResolvedValue({});
    prismaMock.plan.update.mockResolvedValue({});

    const res = await PATCH(makeRequest('/api/activities', {
      method: 'PATCH',
      body: {
        planId: 'p1', dayId: 'd1',
        activities: [{ id: 'a1', title: 'A', startTime: '10:00', duration: 60, order: 0 }],
      },
    }));
    expect(res.status).toBe(200);
    // Bulk replace uses a transaction, not raw sequential writes.
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });

  it('bulk replace deletes activities NOT in the incoming set (atomic replace)', async () => {
    setAuth({ user: { id: 'u1' } });
    stubOwnedPlan('p1', 'u1');
    prismaMock.activity.deleteMany.mockResolvedValue({ count: 2 });
    prismaMock.activity.upsert.mockResolvedValue({});
    prismaMock.plan.update.mockResolvedValue({});

    await PATCH(makeRequest('/api/activities', {
      method: 'PATCH',
      body: {
        planId: 'p1', dayId: 'd1',
        activities: [
          { id: 'a1', title: 'A', startTime: '10:00', duration: 60 },
          { id: 'a2', title: 'B', startTime: '11:00', duration: 60 },
        ],
      },
    }));

    // The transaction MUST call deleteMany with a `notIn` for the incoming IDs.
    const delArgs = prismaMock.activity.deleteMany.mock.calls[0][0];
    expect(delArgs.where.dayPlanId).toBe('d1');
    expect(delArgs.where.id.notIn).toEqual(expect.arrayContaining(['a1', 'a2']));
  });

  it('re-numbers order sequentially by start time (client cannot inject arbitrary ordering)', async () => {
    setAuth({ user: { id: 'u1' } });
    stubOwnedPlan('p1', 'u1');
    prismaMock.activity.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.activity.upsert.mockResolvedValue({});
    prismaMock.plan.update.mockResolvedValue({});

    // Client posts activities out of order; server must sort by time and
    // re-index order to 0..n-1.
    await PATCH(makeRequest('/api/activities', {
      method: 'PATCH',
      body: {
        planId: 'p1', dayId: 'd1',
        activities: [
          { id: 'a2', title: 'later', startTime: '15:00', duration: 30, order: 99 },
          { id: 'a1', title: 'earlier', startTime: '09:00', duration: 30, order: 42 },
        ],
      },
    }));
    // Two upserts — the earlier one must be order=0, the later order=1.
    const upsertCalls = prismaMock.activity.upsert.mock.calls;
    expect(upsertCalls).toHaveLength(2);
    const byId = new Map(upsertCalls.map(c => [c[0].where.id, c[0]]));
    expect(byId.get('a1')?.create.order).toBe(0);
    expect(byId.get('a2')?.create.order).toBe(1);
  });

  it('assigns a fresh id when the client did not provide one', async () => {
    setAuth({ user: { id: 'u1' } });
    stubOwnedPlan('p1', 'u1');
    prismaMock.activity.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.activity.upsert.mockResolvedValue({});
    prismaMock.plan.update.mockResolvedValue({});

    await PATCH(makeRequest('/api/activities', {
      method: 'PATCH',
      body: {
        planId: 'p1', dayId: 'd1',
        activities: [{ title: 'new', startTime: '09:00', duration: 30 }],
      },
    }));
    const call = prismaMock.activity.upsert.mock.calls[0][0];
    // Fresh id must be non-empty (UUID) so upsert has a real key.
    expect(call.where.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('notes update ONLY (no activities array) still respects write permission', async () => {
    setAuth({ user: { id: 'u2' } });
    stubViewShared('p1', 'u2');
    const res = await PATCH(makeRequest('/api/activities', {
      method: 'PATCH',
      body: { planId: 'p1', dayId: 'd1', notes: 'attempt' },
    }));
    expect(res.status).toBe(403);
    expect(prismaMock.dayPlan.updateMany).not.toHaveBeenCalled();
  });

  it('saves notes when caller can write and no activities array is provided', async () => {
    setAuth({ user: { id: 'u1' } });
    stubOwnedPlan('p1', 'u1');
    prismaMock.dayPlan.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.plan.update.mockResolvedValue({});

    const res = await PATCH(makeRequest('/api/activities', {
      method: 'PATCH',
      body: { planId: 'p1', dayId: 'd1', notes: 'day notes' },
    }));
    expect(res.status).toBe(200);
    // No activities array → no transaction / no delete / no upsert.
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    // Note write is scoped by both dayId AND planId (defence-in-depth vs cross-plan writes).
    const args = prismaMock.dayPlan.updateMany.mock.calls[0][0];
    expect(args.where).toEqual({ id: 'd1', planId: 'p1' });
    expect(args.data.notes).toBe('day notes');
  });
});
