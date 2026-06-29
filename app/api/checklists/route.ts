import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { auth } from '@/auth';
import { Checklist, ChecklistItem } from '@/lib/types';
import { resolveChecklistPermission } from '@/lib/checklist-access';
import { generateShareToken } from '@/lib/utils';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

function shapeItem(item: {
  id: string; checklistId: string; title: string; groupName: string;
  completed: boolean; order: number; dueDate: string | null; notes: string;
}): ChecklistItem {
  return { ...item, _id: item.id, dueDate: item.dueDate ?? null };
}

function shapeChecklist(row: {
  id: string; userId: string; title: string; description: string;
  dueDate: string | null; dueTime: string | null; planId: string | null;
  shareLink: string | null; isPublic: boolean; createdAt: Date; updatedAt: Date;
  items: Parameters<typeof shapeItem>[0][];
}, userPermission?: 'owner' | 'edit' | 'view'): Checklist {
  return {
    ...row,
    _id: row.id,
    items: row.items.map(shapeItem),
    ...(userPermission ? { userPermission } : {}),
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shareToken = searchParams.get('share');
    const id = searchParams.get('id');
    const tab = searchParams.get('tab');

    // ── Share link branch — no auth required for view ─────────────────────────
    if (shareToken) {
      // Rate-limit unauthenticated lookups by IP to prevent token brute-forcing
      const rl = rateLimit(`cshare:${getClientIp({ headers: request.headers })}`, 60, 60_000);
      if (!rl.ok) {
        return NextResponse.json(
          { error: 'Too many requests.' },
          { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
        );
      }
      // Try new ChecklistShareLink table first
      const shareLink = await prisma.checklistShareLink.findUnique({
        where: { token: shareToken },
        include: { checklist: { include: { items: { orderBy: { order: 'asc' } } } } },
      });

      if (shareLink && shareLink.isActive && shareLink.checklist) {
        const session = await auth();
        const isOwner = session?.user?.id === shareLink.checklist.userId;
        let userPermission: 'owner' | 'view' | 'edit' = 'view';
        if (session?.user?.id && !isOwner) {
          userPermission = shareLink.permission as 'view' | 'edit';
          await prisma.sharedChecklistAccess.upsert({
            where: { userId_checklistId: { userId: session.user.id, checklistId: shareLink.checklistId } },
            update: {
              accessedAt: new Date(),
              permission: userPermission,
              linkId: shareLink.id,
              userEmail: session.user.email ?? '',
              userName: session.user.name ?? '',
            },
            create: {
              userId: session.user.id,
              userEmail: session.user.email ?? '',
              userName: session.user.name ?? '',
              checklistId: shareLink.checklistId,
              permission: userPermission,
              linkId: shareLink.id,
            },
          });
        } else if (isOwner) {
          userPermission = 'owner';
        }
        return NextResponse.json({
          checklist: shapeChecklist(shareLink.checklist, userPermission),
          userPermission,
        });
      }

      // Backward compat: legacy Checklist.shareLink (always view-only)
      const checklist = await prisma.checklist.findUnique({
        where: { shareLink: shareToken },
        include: { items: { orderBy: { order: 'asc' } } },
      });
      if (!checklist) {
        return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
      }
      const session = await auth();
      const isOwner = session?.user?.id === checklist.userId;
      if (session?.user?.id && !isOwner) {
        await prisma.sharedChecklistAccess.upsert({
          where: { userId_checklistId: { userId: session.user.id, checklistId: checklist.id } },
          create: {
            userId: session.user.id,
            userEmail: session.user.email ?? '',
            userName: session.user.name ?? '',
            checklistId: checklist.id,
            permission: 'view',
          },
          update: { accessedAt: new Date() },
        });
      }
      const perm: 'owner' | 'view' = isOwner ? 'owner' : 'view';
      return NextResponse.json({ checklist: shapeChecklist(checklist, perm), userPermission: perm });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', checklists: [] }, { status: 401 });
    }
    const userId = session.user.id;

    // ── Single checklist by id (owner OR active shared access) ────────────────
    if (id) {
      const permission = await resolveChecklistPermission(id, userId);
      if (!permission) {
        return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
      }
      const checklist = await prisma.checklist.findUnique({
        where: { id },
        include: { items: { orderBy: { order: 'asc' } } },
      });
      if (!checklist) {
        return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
      }
      return NextResponse.json({
        checklist: shapeChecklist(checklist, permission),
        userPermission: permission,
      });
    }

    // ── Shared-with-me ────────────────────────────────────────────────────────
    if (tab === 'shared') {
      const accesses = await prisma.sharedChecklistAccess.findMany({
        where: {
          userId,
          OR: [
            { linkId: null },
            { shareLink: { isActive: true } },
          ],
        },
        include: {
          checklist: { include: { items: { orderBy: { order: 'asc' } } } },
        },
        orderBy: { accessedAt: 'desc' },
      });
      const checklists = accesses.map((a: { checklist: Parameters<typeof shapeChecklist>[0]; permission: string }) =>
        shapeChecklist(a.checklist, (a.permission as 'view' | 'edit') ?? 'view'),
      );
      return NextResponse.json({ checklists });
    }

    // ── All user's checklists ─────────────────────────────────────────────────
    const checklists = await prisma.checklist.findMany({
      where: { userId },
      include: { items: { orderBy: { order: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json({ checklists: checklists.map((c) => shapeChecklist(c, 'owner')) });

  } catch (error) {
    console.error('Error fetching checklists:', error);
    return NextResponse.json({ error: 'Failed to fetch checklists', checklists: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, dueDate, dueTime, planId, items } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (title.length > 200) {
      return NextResponse.json({ error: 'Title is too long (max 200 chars)' }, { status: 400 });
    }
    if (description && typeof description === 'string' && description.length > 5000) {
      return NextResponse.json({ error: 'Description is too long (max 5000 chars)' }, { status: 400 });
    }
    if (Array.isArray(items) && items.length > 500) {
      return NextResponse.json({ error: 'Too many items (max 500)' }, { status: 400 });
    }

    const checklist = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      const created = await tx.checklist.create({
        data: {
          userId: session.user.id,
          title,
          description: description || '',
          dueDate: dueDate || null,
          dueTime: dueTime || null,
          planId: planId || null,
        },
      });

      if (Array.isArray(items) && items.length > 0) {
        await tx.checklistItem.createMany({
          data: items.map((item: { title: string; groupName?: string; notes?: string }, idx: number) => ({
            checklistId: created.id,
            title: item.title,
            groupName: item.groupName || '',
            notes: item.notes || '',
            order: idx,
          })),
        });
      }

      return tx.checklist.findUnique({
        where: { id: created.id },
        include: { items: { orderBy: { order: 'asc' } } },
      });
    });

    return NextResponse.json({ checklist: shapeChecklist(checklist!, 'owner') });
  } catch (error) {
    console.error('Error creating checklist:', error);
    return NextResponse.json({ error: 'Failed to create checklist' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, title, description, dueDate, dueTime, planId } = body;

    if (!id) {
      return NextResponse.json({ error: 'Checklist ID is required' }, { status: 400 });
    }

    // Allow owners and editors to update metadata
    const permission = await resolveChecklistPermission(id, session.user.id);
    if (permission !== 'owner' && permission !== 'edit') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (dueDate !== undefined) data.dueDate = dueDate;
    if (dueTime !== undefined) data.dueTime = dueTime;
    if (planId !== undefined) data.planId = planId;
    data.updatedAt = new Date();

    await prisma.checklist.update({ where: { id }, data });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating checklist:', error);
    return NextResponse.json({ error: 'Failed to update checklist' }, { status: 500 });
  }
}

// Legacy: simple share link (kept for backward compatibility). New flow uses /api/checklists/share.
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Checklist ID is required' }, { status: 400 });
    }

    const checklist = await prisma.checklist.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!checklist) {
      return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
    }

    const shareLink = checklist.shareLink || generateShareToken();

    await prisma.checklist.update({
      where: { id },
      data: { shareLink, isPublic: true },
    });

    return NextResponse.json({ shareLink });
  } catch (error) {
    console.error('Error generating share link:', error);
    return NextResponse.json({ error: 'Failed to generate share link' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Checklist ID is required' }, { status: 400 });
    }

    const result = await prisma.checklist.deleteMany({
      where: { id, userId: session.user.id },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting checklist:', error);
    return NextResponse.json({ error: 'Failed to delete checklist' }, { status: 500 });
  }
}
