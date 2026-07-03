import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Prisma singleton before importing the module under test.
// We hoist the mock so `resolveChecklistPermission` sees our stub when it
// captures the `prisma` reference at module init.
const findUniqueMock = vi.fn();
vi.mock('@/lib/db', () => ({
  default: {
    checklist: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
    },
  },
}));

import { resolveChecklistPermission } from '../lib/checklist-access';

describe('lib/checklist-access resolveChecklistPermission', () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
  });

  it('returns null when userId is undefined (no DB hit)', async () => {
    const result = await resolveChecklistPermission('cl-1', undefined);
    expect(result).toBeNull();
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it('returns null when the checklist does not exist', async () => {
    findUniqueMock.mockResolvedValue(null);
    const result = await resolveChecklistPermission('cl-missing', 'user-1');
    expect(result).toBeNull();
  });

  it("returns 'owner' when the session user owns the checklist (no share record needed)", async () => {
    findUniqueMock.mockResolvedValue({
      id: 'cl-1',
      userId: 'user-1',
      sharedAccess: [],
    });
    const result = await resolveChecklistPermission('cl-1', 'user-1');
    expect(result).toBe('owner');
  });

  it("returns 'edit' when a SharedChecklistAccess row grants edit", async () => {
    findUniqueMock.mockResolvedValue({
      id: 'cl-1',
      userId: 'owner-1',
      sharedAccess: [{ permission: 'edit', linkId: null, shareLink: null }],
    });
    const result = await resolveChecklistPermission('cl-1', 'user-2');
    expect(result).toBe('edit');
  });

  it("returns 'view' when a SharedChecklistAccess row grants view", async () => {
    findUniqueMock.mockResolvedValue({
      id: 'cl-1',
      userId: 'owner-1',
      sharedAccess: [{ permission: 'view', linkId: null, shareLink: null }],
    });
    const result = await resolveChecklistPermission('cl-1', 'user-2');
    expect(result).toBe('view');
  });

  it("returns 'edit' when access was granted through an ACTIVE share link", async () => {
    findUniqueMock.mockResolvedValue({
      id: 'cl-1',
      userId: 'owner-1',
      sharedAccess: [
        { permission: 'edit', linkId: 'link-1', shareLink: { isActive: true } },
      ],
    });
    const result = await resolveChecklistPermission('cl-1', 'user-2');
    expect(result).toBe('edit');
  });

  it('returns null when access was granted through a REVOKED share link', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'cl-1',
      userId: 'owner-1',
      sharedAccess: [
        { permission: 'edit', linkId: 'link-1', shareLink: { isActive: false } },
      ],
    });
    const result = await resolveChecklistPermission('cl-1', 'user-2');
    // Revoked link must NOT grant access — otherwise a share link can't be
    // rescinded once distributed.
    expect(result).toBeNull();
  });

  it('returns null when non-owner has no SharedAccess row', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'cl-1',
      userId: 'owner-1',
      sharedAccess: [],
    });
    const result = await resolveChecklistPermission('cl-1', 'stranger');
    expect(result).toBeNull();
  });

  it("falls back to 'view' when access.permission is undefined/malformed", async () => {
    findUniqueMock.mockResolvedValue({
      id: 'cl-1',
      userId: 'owner-1',
      // Simulate a legacy row without a permission field
      sharedAccess: [{ permission: undefined, linkId: null, shareLink: null }],
    });
    const result = await resolveChecklistPermission('cl-1', 'user-2');
    expect(result).toBe('view');
  });

  it('scopes the sharedAccess query by userId (defence-in-depth on the Prisma call)', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'cl-1',
      userId: 'owner-1',
      sharedAccess: [{ permission: 'edit', linkId: null, shareLink: null }],
    });
    await resolveChecklistPermission('cl-1', 'user-2');

    const call = findUniqueMock.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'cl-1' });
    // The include filter must limit sharedAccess rows to the requesting user
    // so a shared row belonging to someone else doesn't accidentally match.
    expect(call.include.sharedAccess.where).toEqual({ userId: 'user-2' });
  });
});
