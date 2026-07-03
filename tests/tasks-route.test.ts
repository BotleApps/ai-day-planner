import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setAuth,
  resetAuth,
  prismaMock,
  resetPrisma,
  authMockFactory,
  prismaMockFactory,
  makeRequest,
  readJson,
} from './_harness/mocks';

// vi.mock() must be hoisted; delegate to the harness factories.
vi.mock('@/auth', () => authMockFactory());
vi.mock('@/lib/db', () => prismaMockFactory());

import { GET, POST, PUT, DELETE } from '@/app/api/tasks/route';

describe('POST /api/tasks', () => {
  beforeEach(() => {
    resetAuth();
    resetPrisma();
  });

  it('401 when unauthenticated (does not touch DB)', async () => {
    setAuth(null);
    const res = await POST(makeRequest('/api/tasks', {
      method: 'POST',
      body: { title: 'x' },
    }));
    const { status, body } = await readJson<{ error: string }>(res);
    expect(status).toBe(401);
    expect(body.error).toMatch(/Unauthorized/i);
    expect(prismaMock.task.create).not.toHaveBeenCalled();
  });

  it('400 when title is missing', async () => {
    setAuth({ user: { id: 'user-1' } });
    const res = await POST(makeRequest('/api/tasks', {
      method: 'POST',
      body: { description: 'no title' },
    }));
    expect(res.status).toBe(400);
    expect(prismaMock.task.create).not.toHaveBeenCalled();
  });

  it('400 when title is longer than 200 chars', async () => {
    setAuth({ user: { id: 'user-1' } });
    const res = await POST(makeRequest('/api/tasks', {
      method: 'POST',
      body: { title: 'a'.repeat(201) },
    }));
    expect(res.status).toBe(400);
  });

  it('persists userId from the session, IGNORING any client-supplied userId', async () => {
    setAuth({ user: { id: 'user-1' } });
    prismaMock.task.create.mockResolvedValue({
      id: 't1', userId: 'user-1', title: 'Buy milk', description: '',
      time: null, completed: false,
    });

    const res = await POST(makeRequest('/api/tasks', {
      method: 'POST',
      // Attacker supplies a foreign userId — the handler must ignore it.
      body: { title: 'Buy milk', userId: 'other-user' },
    }));

    expect(res.status).toBe(200);
    const args = prismaMock.task.create.mock.calls[0][0];
    expect(args.data.userId).toBe('user-1');
  });
});

describe('PUT /api/tasks', () => {
  beforeEach(() => {
    resetAuth();
    resetPrisma();
  });

  it('404 when updating a task belonging to another user (result.count=0)', async () => {
    setAuth({ user: { id: 'user-1' } });
    prismaMock.task.updateMany.mockResolvedValue({ count: 0 });

    const res = await PUT(makeRequest('/api/tasks', {
      method: 'PUT',
      body: { id: 'not-mine', title: 'hijack' },
    }));

    expect(res.status).toBe(404);
    // Critical: the where clause MUST filter by userId, not just id.
    const args = prismaMock.task.updateMany.mock.calls[0][0];
    expect(args.where.userId).toBe('user-1');
    expect(args.where.id).toBe('not-mine');
  });

  it('400 when id is missing', async () => {
    setAuth({ user: { id: 'user-1' } });
    const res = await PUT(makeRequest('/api/tasks', {
      method: 'PUT',
      body: { title: 'x' },
    }));
    expect(res.status).toBe(400);
  });

  it('200 when the caller owns the task', async () => {
    setAuth({ user: { id: 'user-1' } });
    prismaMock.task.updateMany.mockResolvedValue({ count: 1 });

    const res = await PUT(makeRequest('/api/tasks', {
      method: 'PUT',
      body: { id: 't1', title: 'renamed', completed: true },
    }));
    expect(res.status).toBe(200);
    const args = prismaMock.task.updateMany.mock.calls[0][0];
    expect(args.data).toEqual({ title: 'renamed', completed: true });
  });
});

describe('DELETE /api/tasks', () => {
  beforeEach(() => {
    resetAuth();
    resetPrisma();
  });

  it('401 when unauthenticated', async () => {
    setAuth(null);
    const res = await DELETE(makeRequest('/api/tasks?id=t1', { method: 'DELETE' }));
    expect(res.status).toBe(401);
    expect(prismaMock.task.deleteMany).not.toHaveBeenCalled();
  });

  it('400 when id query param is missing', async () => {
    setAuth({ user: { id: 'user-1' } });
    const res = await DELETE(makeRequest('/api/tasks', { method: 'DELETE' }));
    expect(res.status).toBe(400);
  });

  it('404 when deleting another user\'s task (deleteMany count=0)', async () => {
    setAuth({ user: { id: 'user-1' } });
    prismaMock.task.deleteMany.mockResolvedValue({ count: 0 });

    const res = await DELETE(makeRequest('/api/tasks?id=someone-elses', { method: 'DELETE' }));
    expect(res.status).toBe(404);
    // Where clause must scope to the session user, not just the id.
    const args = prismaMock.task.deleteMany.mock.calls[0][0];
    expect(args.where.userId).toBe('user-1');
  });

  it('200 on successful delete', async () => {
    setAuth({ user: { id: 'user-1' } });
    prismaMock.task.deleteMany.mockResolvedValue({ count: 1 });
    const res = await DELETE(makeRequest('/api/tasks?id=t1', { method: 'DELETE' }));
    expect(res.status).toBe(200);
  });
});

describe('GET /api/tasks', () => {
  beforeEach(() => {
    resetAuth();
    resetPrisma();
  });

  it('401 with empty tasks array when unauthenticated', async () => {
    setAuth(null);
    const res = await GET();
    const { status, body } = await readJson<{ error: string; tasks: unknown[] }>(res);
    expect(status).toBe(401);
    expect(body.tasks).toEqual([]);
  });

  it('scopes findMany to the session userId and orders by createdAt desc', async () => {
    setAuth({ user: { id: 'user-1' } });
    prismaMock.task.findMany.mockResolvedValue([
      { id: 't2', userId: 'user-1', title: 'newer', createdAt: new Date('2026-07-02') },
      { id: 't1', userId: 'user-1', title: 'older', createdAt: new Date('2026-07-01') },
    ]);

    const res = await GET();
    const { status, body } = await readJson<{ tasks: Array<{ id: string; _id: string }> }>(res);
    expect(status).toBe(200);
    expect(body.tasks).toHaveLength(2);
    // Every task should have _id mirrored from id (legacy client compat).
    expect(body.tasks[0]._id).toBe('t2');

    const args = prismaMock.task.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ userId: 'user-1' });
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
  });
});
