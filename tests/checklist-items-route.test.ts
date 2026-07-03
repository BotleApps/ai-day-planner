import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setAuth, resetAuth, prismaMock, resetPrisma,
  authMockFactory, prismaMockFactory, makeRequest,
} from './_harness/mocks';

vi.mock('@/auth', () => authMockFactory());
vi.mock('@/lib/db', () => prismaMockFactory());

import { POST, PUT, PATCH, DELETE } from '@/app/api/checklists/items/route';

// Bootstrap the checklist.findUnique that resolveChecklistPermission calls.
function stubPermission(args: {
  checklistId: string;
  ownerUserId: string;
  caller?: { userId: string; permission: 'view' | 'edit'; linkActive?: boolean; linkId?: string };
}) {
  const shared = args.caller ? [{
    permission: args.caller.permission,
    linkId: args.caller.linkId ?? null,
    shareLink: args.caller.linkId ? { isActive: args.caller.linkActive ?? true } : null,
  }] : [];
  prismaMock.checklist.findUnique.mockResolvedValueOnce({
    id: args.checklistId, userId: args.ownerUserId, sharedAccess: shared,
  });
}

describe('POST /api/checklists/items', () => {
  beforeEach(() => { resetAuth(); resetPrisma(); });

  it('401 when unauthenticated', async () => {
    setAuth(null);
    const res = await POST(makeRequest('/api/checklists/items', {
      method: 'POST', body: { checklistId: 'cl1', title: 'x' },
    }));
    expect(res.status).toBe(401);
  });

  it('400 when title missing', async () => {
    setAuth({ user: { id: 'u1' } });
    const res = await POST(makeRequest('/api/checklists/items', {
      method: 'POST', body: { checklistId: 'cl1' },
    }));
    expect(res.status).toBe(400);
  });

  it('403 for view-only shared user', async () => {
    setAuth({ user: { id: 'u2' } });
    stubPermission({ checklistId: 'cl1', ownerUserId: 'owner',
      caller: { userId: 'u2', permission: 'view' } });
    const res = await POST(makeRequest('/api/checklists/items', {
      method: 'POST', body: { checklistId: 'cl1', title: 'x' },
    }));
    expect(res.status).toBe(403);
    expect(prismaMock.checklistItem.create).not.toHaveBeenCalled();
  });

  it('appends new item with order = current count', async () => {
    setAuth({ user: { id: 'owner' } });
    stubPermission({ checklistId: 'cl1', ownerUserId: 'owner' });
    prismaMock.checklistItem.count.mockResolvedValue(7);
    prismaMock.checklistItem.create.mockResolvedValue({
      id: 'it8', checklistId: 'cl1', title: 'x', groupName: '',
      completed: false, order: 7, dueDate: null, notes: '',
    });
    prismaMock.checklist.update.mockResolvedValue({});

    await POST(makeRequest('/api/checklists/items', {
      method: 'POST', body: { checklistId: 'cl1', title: 'x' },
    }));
    const args = prismaMock.checklistItem.create.mock.calls[0][0];
    expect(args.data.order).toBe(7);
  });
});

describe('PUT /api/checklists/items', () => {
  beforeEach(() => { resetAuth(); resetPrisma(); });

  it('403 for view-only shared user', async () => {
    setAuth({ user: { id: 'u2' } });
    stubPermission({ checklistId: 'cl1', ownerUserId: 'owner',
      caller: { userId: 'u2', permission: 'view' } });
    const res = await PUT(makeRequest('/api/checklists/items', {
      method: 'PUT', body: { id: 'it1', checklistId: 'cl1', completed: true },
    }));
    expect(res.status).toBe(403);
    expect(prismaMock.checklistItem.updateMany).not.toHaveBeenCalled();
  });

  it('scopes updateMany by BOTH id and checklistId (defence-in-depth)', async () => {
    setAuth({ user: { id: 'owner' } });
    stubPermission({ checklistId: 'cl1', ownerUserId: 'owner' });
    prismaMock.checklistItem.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.checklist.update.mockResolvedValue({});

    await PUT(makeRequest('/api/checklists/items', {
      method: 'PUT', body: { id: 'it1', checklistId: 'cl1', completed: true },
    }));
    const args = prismaMock.checklistItem.updateMany.mock.calls[0][0];
    // The where clause MUST scope by BOTH id and checklistId so an item id
    // that happens to exist in a different checklist cannot be updated.
    expect(args.where).toEqual({ id: 'it1', checklistId: 'cl1' });
  });
});

describe('DELETE /api/checklists/items', () => {
  beforeEach(() => { resetAuth(); resetPrisma(); });

  it('403 for view-only shared user', async () => {
    setAuth({ user: { id: 'u2' } });
    stubPermission({ checklistId: 'cl1', ownerUserId: 'owner',
      caller: { userId: 'u2', permission: 'view' } });
    const res = await DELETE(makeRequest(
      '/api/checklists/items?id=it1&checklistId=cl1', { method: 'DELETE' },
    ));
    expect(res.status).toBe(403);
    expect(prismaMock.checklistItem.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes with where scoped by id AND checklistId', async () => {
    setAuth({ user: { id: 'owner' } });
    stubPermission({ checklistId: 'cl1', ownerUserId: 'owner' });
    prismaMock.checklistItem.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.checklist.update.mockResolvedValue({});

    const res = await DELETE(makeRequest(
      '/api/checklists/items?id=it1&checklistId=cl1', { method: 'DELETE' },
    ));
    expect(res.status).toBe(200);
    expect(prismaMock.checklistItem.deleteMany.mock.calls[0][0].where).toEqual({
      id: 'it1', checklistId: 'cl1',
    });
  });
});

// ─── PATCH: reorder / group rename / group delete ──────────────────────────

describe('PATCH /api/checklists/items', () => {
  beforeEach(() => { resetAuth(); resetPrisma(); });

  it('403 for view-only shared user (all PATCH sub-operations blocked)', async () => {
    setAuth({ user: { id: 'u2' } });
    stubPermission({ checklistId: 'cl1', ownerUserId: 'owner',
      caller: { userId: 'u2', permission: 'view' } });
    const res = await PATCH(makeRequest('/api/checklists/items', {
      method: 'PATCH', body: { checklistId: 'cl1', items: [{ id: 'it1', order: 0 }] },
    }));
    expect(res.status).toBe(403);
    expect(prismaMock.checklistItem.updateMany).not.toHaveBeenCalled();
  });

  it('rename group updates ALL items in the group atomically, scoped by checklistId', async () => {
    setAuth({ user: { id: 'owner' } });
    stubPermission({ checklistId: 'cl1', ownerUserId: 'owner' });
    prismaMock.checklistItem.updateMany.mockResolvedValue({ count: 3 });
    prismaMock.checklist.update.mockResolvedValue({});

    await PATCH(makeRequest('/api/checklists/items', {
      method: 'PATCH',
      body: { checklistId: 'cl1', renameGroup: { from: 'Old', to: 'New' } },
    }));
    const args = prismaMock.checklistItem.updateMany.mock.calls[0][0];
    // Must scope by checklistId AND the OLD groupName so a rename can't
    // clobber the same-named group in another checklist.
    expect(args.where).toEqual({ checklistId: 'cl1', groupName: 'Old' });
    expect(args.data).toEqual({ groupName: 'New' });
  });

  it('delete group with removeItems=false MOVES items to ungrouped (empty string)', async () => {
    setAuth({ user: { id: 'owner' } });
    stubPermission({ checklistId: 'cl1', ownerUserId: 'owner' });
    prismaMock.checklistItem.updateMany.mockResolvedValue({ count: 3 });
    prismaMock.checklist.update.mockResolvedValue({});

    await PATCH(makeRequest('/api/checklists/items', {
      method: 'PATCH',
      body: { checklistId: 'cl1', deleteGroup: { name: 'Groceries', removeItems: false } },
    }));
    expect(prismaMock.checklistItem.deleteMany).not.toHaveBeenCalled();
    const args = prismaMock.checklistItem.updateMany.mock.calls[0][0];
    expect(args.where).toEqual({ checklistId: 'cl1', groupName: 'Groceries' });
    expect(args.data).toEqual({ groupName: '' });
  });

  it('delete group with removeItems=true DELETES all items in that group', async () => {
    setAuth({ user: { id: 'owner' } });
    stubPermission({ checklistId: 'cl1', ownerUserId: 'owner' });
    prismaMock.checklistItem.deleteMany.mockResolvedValue({ count: 3 });
    prismaMock.checklist.update.mockResolvedValue({});

    await PATCH(makeRequest('/api/checklists/items', {
      method: 'PATCH',
      body: { checklistId: 'cl1', deleteGroup: { name: 'Groceries', removeItems: true } },
    }));
    // Must NOT delete items in other checklists that happen to share a group name.
    expect(prismaMock.checklistItem.deleteMany.mock.calls[0][0].where).toEqual({
      checklistId: 'cl1', groupName: 'Groceries',
    });
  });

  it('reorder runs one updateMany per item within a transaction', async () => {
    setAuth({ user: { id: 'owner' } });
    stubPermission({ checklistId: 'cl1', ownerUserId: 'owner' });
    prismaMock.checklistItem.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.checklist.update.mockResolvedValue({});

    await PATCH(makeRequest('/api/checklists/items', {
      method: 'PATCH',
      body: { checklistId: 'cl1', items: [
        { id: 'it1', order: 0 },
        { id: 'it2', order: 1, groupName: 'newGroup' },
      ] },
    }));
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    // Every updateMany where must include checklistId — cross-checklist writes blocked.
    for (const call of prismaMock.checklistItem.updateMany.mock.calls) {
      expect(call[0].where.checklistId).toBe('cl1');
    }
  });

  it('400 when no operation is specified', async () => {
    setAuth({ user: { id: 'owner' } });
    stubPermission({ checklistId: 'cl1', ownerUserId: 'owner' });
    const res = await PATCH(makeRequest('/api/checklists/items', {
      method: 'PATCH', body: { checklistId: 'cl1' },
    }));
    expect(res.status).toBe(400);
  });
});
