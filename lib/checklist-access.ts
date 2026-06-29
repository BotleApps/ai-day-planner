import prisma from '@/lib/db';

export type ChecklistPermission = 'owner' | 'edit' | 'view' | null;

/**
 * Resolve the current user's permission on a checklist in a single DB query.
 * Returns 'owner' if user owns it, 'edit' or 'view' if active SharedChecklistAccess exists
 * (and, when the access came from a link, that link is still active), otherwise null.
 */
export async function resolveChecklistPermission(
  checklistId: string,
  userId: string | undefined,
): Promise<ChecklistPermission> {
  if (!userId) return null;

  const checklist = await prisma.checklist.findUnique({
    where: { id: checklistId },
    include: {
      sharedAccess: {
        where: { userId },
        include: { shareLink: { select: { isActive: true } } },
      },
    },
  });

  if (!checklist) return null;
  if (checklist.userId === userId) return 'owner';

  const access = checklist.sharedAccess[0];
  if (!access) return null;
  // If tied to a link, that link must still be active
  if (access.linkId && access.shareLink && !access.shareLink.isActive) return null;
  return (access.permission as 'view' | 'edit') ?? 'view';
}

