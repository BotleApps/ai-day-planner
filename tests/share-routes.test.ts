import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setAuth, resetAuth, prismaMock, resetPrisma,
  authMockFactory, prismaMockFactory, makeRequest, readJson,
} from './_harness/mocks';

vi.mock('@/auth', () => authMockFactory());
vi.mock('@/lib/db', () => prismaMockFactory());

import * as plansShare from '@/app/api/plans/share/route';
import * as checklistsShare from '@/app/api/checklists/share/route';

// ─── /api/plans/share ─────────────────────────────────────────────────────

describe('POST /api/plans/share', () => {
  beforeEach(() => { resetAuth(); resetPrisma(); });

  it('401 when unauthenticated', async () => {
    setAuth(null);
    const res = await plansShare.POST(makeRequest('/api/plans/share', {
      method: 'POST', body: { planId: 'p1', permission: 'view' },
    }));
    expect(res.status).toBe(401);
  });

  it.each([
    ['missing planId', { permission: 'view' }],
    ['missing permission', { planId: 'p1' }],
    ["permission not in ['view','edit']", { planId: 'p1', permission: 'admin' }],
    ["permission='suggest' rejected", { planId: 'p1', permission: 'suggest' }],
  ])('400 when %s', async (_case, body) => {
    setAuth({ user: { id: 'u1' } });
    const res = await plansShare.POST(makeRequest('/api/plans/share', {
      method: 'POST', body,
    }));
    expect(res.status).toBe(400);
    expect(prismaMock.shareLink.create).not.toHaveBeenCalled();
  });

  it('403 when caller does not own the plan', async () => {
    setAuth({ user: { id: 'u1' } });
    prismaMock.plan.findUnique.mockResolvedValue({ id: 'p1', createdBy: 'someone-else' });
    const res = await plansShare.POST(makeRequest('/api/plans/share', {
      method: 'POST', body: { planId: 'p1', permission: 'view' },
    }));
    expect(res.status).toBe(403);
    expect(prismaMock.shareLink.create).not.toHaveBeenCalled();
  });

  it('403 when plan does not exist', async () => {
    setAuth({ user: { id: 'u1' } });
    prismaMock.plan.findUnique.mockResolvedValue(null);
    const res = await plansShare.POST(makeRequest('/api/plans/share', {
      method: 'POST', body: { planId: 'ghost', permission: 'view' },
    }));
    expect(res.status).toBe(403);
  });

  it('returns EXISTING link for the same (plan, permission) — idempotent', async () => {
    setAuth({ user: { id: 'u1' } });
    prismaMock.plan.findUnique.mockResolvedValue({ id: 'p1', createdBy: 'u1' });
    prismaMock.shareLink.findFirst.mockResolvedValue({
      id: 'sl1', planId: 'p1', token: 'existing-token', permission: 'view', isActive: true,
    });

    const res = await plansShare.POST(makeRequest('/api/plans/share', {
      method: 'POST',
      body: { planId: 'p1', permission: 'view' },
      headers: { origin: 'https://sortedplan.app' },
    }));
    const { body } = await readJson<{ link: { token: string; url: string } }>(res);
    expect(body.link.token).toBe('existing-token');
    expect(body.link.url).toBe('https://sortedplan.app/?share=existing-token');
    expect(prismaMock.shareLink.create).not.toHaveBeenCalled();
  });

  it('creates a NEW link when the caller asks for a DIFFERENT permission (view + edit coexist)', async () => {
    setAuth({ user: { id: 'u1' } });
    prismaMock.plan.findUnique.mockResolvedValue({ id: 'p1', createdBy: 'u1' });
    // findFirst is scoped by permission — so asking for edit when only view exists yields null.
    prismaMock.shareLink.findFirst.mockResolvedValue(null);
    prismaMock.shareLink.create.mockResolvedValue({
      id: 'sl2', planId: 'p1', token: 'fresh-token', permission: 'edit', isActive: true,
    });
    prismaMock.plan.update.mockResolvedValue({});

    const res = await plansShare.POST(makeRequest('/api/plans/share', {
      method: 'POST', body: { planId: 'p1', permission: 'edit' },
    }));
    expect(res.status).toBe(200);
    // findFirst filter must include permission — else callers would be handed
    // a view-link when they asked for edit and vice versa.
    const findArgs = prismaMock.shareLink.findFirst.mock.calls[0][0];
    expect(findArgs.where.permission).toBe('edit');
    // Transaction creates the link AND marks the plan public together.
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    const createArgs = prismaMock.shareLink.create.mock.calls[0][0];
    // Token has 32-char base64url shape from generateShareToken.
    expect(createArgs.data.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(createArgs.data.permission).toBe('edit');
  });
});

describe('DELETE /api/plans/share', () => {
  beforeEach(() => { resetAuth(); resetPrisma(); });

  it('401 unauthenticated', async () => {
    setAuth(null);
    const res = await plansShare.DELETE(makeRequest('/api/plans/share?linkId=sl1', { method: 'DELETE' }));
    expect(res.status).toBe(401);
  });

  it('400 when linkId missing', async () => {
    setAuth({ user: { id: 'u1' } });
    const res = await plansShare.DELETE(makeRequest('/api/plans/share', { method: 'DELETE' }));
    expect(res.status).toBe(400);
  });

  it('403 when caller does not own the plan associated with the link', async () => {
    setAuth({ user: { id: 'u1' } });
    prismaMock.shareLink.findUnique.mockResolvedValue({
      id: 'sl1', planId: 'p1', plan: { id: 'p1', createdBy: 'someone-else' },
    });
    const res = await plansShare.DELETE(makeRequest('/api/plans/share?linkId=sl1', { method: 'DELETE' }));
    expect(res.status).toBe(403);
    expect(prismaMock.shareLink.update).not.toHaveBeenCalled();
    expect(prismaMock.sharedAccess.deleteMany).not.toHaveBeenCalled();
  });

  it('revoke: deactivates the link AND deletes ALL members who joined via it (single transaction)', async () => {
    setAuth({ user: { id: 'u1' } });
    prismaMock.shareLink.findUnique.mockResolvedValue({
      id: 'sl1', planId: 'p1', plan: { id: 'p1', createdBy: 'u1' },
    });
    prismaMock.sharedAccess.deleteMany.mockResolvedValue({ count: 3 });
    prismaMock.shareLink.update.mockResolvedValue({});

    const res = await plansShare.DELETE(makeRequest('/api/plans/share?linkId=sl1', { method: 'DELETE' }));
    expect(res.status).toBe(200);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    // deleteMany must be scoped by linkId — do NOT touch other links' members.
    expect(prismaMock.sharedAccess.deleteMany.mock.calls[0][0].where).toEqual({ linkId: 'sl1' });
  });
});

// ─── /api/checklists/share ─────────────────────────────────────────────────

describe('POST /api/checklists/share', () => {
  beforeEach(() => { resetAuth(); resetPrisma(); });

  it('403 when caller does not own the checklist', async () => {
    setAuth({ user: { id: 'u1' } });
    prismaMock.checklist.findUnique.mockResolvedValue({ id: 'cl1', userId: 'someone-else' });
    const res = await checklistsShare.POST(makeRequest('/api/checklists/share', {
      method: 'POST', body: { checklistId: 'cl1', permission: 'view' },
    }));
    expect(res.status).toBe(403);
    expect(prismaMock.checklistShareLink.create).not.toHaveBeenCalled();
  });

  it('400 for invalid permission value', async () => {
    setAuth({ user: { id: 'u1' } });
    const res = await checklistsShare.POST(makeRequest('/api/checklists/share', {
      method: 'POST', body: { checklistId: 'cl1', permission: 'admin' },
    }));
    expect(res.status).toBe(400);
  });

  it('reuses existing active link for same permission (idempotent)', async () => {
    setAuth({ user: { id: 'u1' } });
    prismaMock.checklist.findUnique.mockResolvedValue({ id: 'cl1', userId: 'u1' });
    prismaMock.checklistShareLink.findFirst.mockResolvedValue({
      id: 'csl1', checklistId: 'cl1', token: 'reused', permission: 'edit', isActive: true,
    });
    const res = await checklistsShare.POST(makeRequest('/api/checklists/share', {
      method: 'POST', body: { checklistId: 'cl1', permission: 'edit' },
      headers: { origin: 'https://x' },
    }));
    const { body } = await readJson<{ link: { url: string; token: string } }>(res);
    expect(body.link.token).toBe('reused');
    expect(body.link.url).toBe('https://x/?cshare=reused');
    expect(prismaMock.checklistShareLink.create).not.toHaveBeenCalled();
  });

  it('creates a new link when none exists for the requested permission', async () => {
    setAuth({ user: { id: 'u1' } });
    prismaMock.checklist.findUnique.mockResolvedValue({ id: 'cl1', userId: 'u1' });
    prismaMock.checklistShareLink.findFirst.mockResolvedValue(null);
    prismaMock.checklistShareLink.create.mockResolvedValue({
      id: 'csl2', checklistId: 'cl1', token: 'fresh', permission: 'view', isActive: true,
    });
    prismaMock.checklist.update.mockResolvedValue({});
    const res = await checklistsShare.POST(makeRequest('/api/checklists/share', {
      method: 'POST', body: { checklistId: 'cl1', permission: 'view' },
    }));
    expect(res.status).toBe(200);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    const createArgs = prismaMock.checklistShareLink.create.mock.calls[0][0];
    expect(createArgs.data.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(createArgs.data.permission).toBe('view');
  });
});

describe('DELETE /api/checklists/share', () => {
  beforeEach(() => { resetAuth(); resetPrisma(); });

  it('403 when caller does not own the checklist for the link', async () => {
    setAuth({ user: { id: 'u1' } });
    prismaMock.checklistShareLink.findUnique.mockResolvedValue({
      id: 'csl1', checklistId: 'cl1', checklist: { id: 'cl1', userId: 'someone-else' },
    });
    const res = await checklistsShare.DELETE(makeRequest(
      '/api/checklists/share?linkId=csl1', { method: 'DELETE' },
    ));
    expect(res.status).toBe(403);
    expect(prismaMock.checklistShareLink.update).not.toHaveBeenCalled();
  });

  it('revoke: deactivate link and delete members who joined via it (transaction)', async () => {
    setAuth({ user: { id: 'u1' } });
    prismaMock.checklistShareLink.findUnique.mockResolvedValue({
      id: 'csl1', checklistId: 'cl1', checklist: { id: 'cl1', userId: 'u1' },
    });
    prismaMock.sharedChecklistAccess.deleteMany.mockResolvedValue({ count: 4 });
    prismaMock.checklistShareLink.update.mockResolvedValue({});
    const res = await checklistsShare.DELETE(makeRequest(
      '/api/checklists/share?linkId=csl1', { method: 'DELETE' },
    ));
    expect(res.status).toBe(200);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(prismaMock.sharedChecklistAccess.deleteMany.mock.calls[0][0].where).toEqual({
      linkId: 'csl1',
    });
  });
});
