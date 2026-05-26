import prisma from '@/lib/db';

export type ChecklistPermission = 'owner' | 'edit' | 'view' | null;

/**
 * Resolve the current user's permission on a checklist.
 * Returns 'owner' if user owns it, 'edit' or 'view' if active SharedChecklistAccess exists
 * (and, when the access came from a link, that link is still active), otherwise null.
 */
export async function resolveChecklistPermission(
  checklistId: string,
  userId: string | undefined,
): Promise<ChecklistPermission> {
  if (!userId) return null;
  const owned = await prisma.checklist.findFirst({
    where: { id: checklistId, userId },
    select: { id: true },
  });
  if (owned) return 'owner';

  const access = await prisma.sharedChecklistAccess.findUnique({
    where: { userId_checklistId: { userId, checklistId } },
    include: { shareLink: { select: { isActive: true } } },
  });
  if (!access) return null;
  // If the access is tied to a link, that link must still be active.
  if (access.linkId && access.shareLink && !access.shareLink.isActive) return null;
  return (access.permission as 'view' | 'edit') ?? 'view';
}
