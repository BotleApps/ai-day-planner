import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { auth } from '@/auth';
import { Checklist, ChecklistItem } from '@/lib/types';

function generateShareLink() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

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
}): Checklist {
  return {
    ...row,
    _id: row.id,
    items: row.items.map(shapeItem),
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shareToken = searchParams.get('share');
    const id = searchParams.get('id');
    const tab = searchParams.get('tab');

    // Public share link — no auth required
    if (shareToken) {
      const checklist = await prisma.checklist.findUnique({
        where: { shareLink: shareToken },
        include: { items: { orderBy: { order: 'asc' } } },
      });
      if (!checklist) {
        return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
      }
      // Record access if logged in
      const session = await auth();
      if (session?.user?.id) {
        await prisma.sharedChecklistAccess.upsert({
          where: { userId_checklistId: { userId: session.user.id, checklistId: checklist.id } },
          create: { userId: session.user.id, checklistId: checklist.id },
          update: { accessedAt: new Date() },
        });
      }
      return NextResponse.json({ checklist: shapeChecklist(checklist) });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', checklists: [] }, { status: 401 });
    }
    const userId = session.user.id;

    // Single checklist by id
    if (id) {
      const checklist = await prisma.checklist.findFirst({
        where: { id, userId },
        include: { items: { orderBy: { order: 'asc' } } },
      });
      if (!checklist) {
        return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
      }
      return NextResponse.json({ checklist: shapeChecklist(checklist) });
    }

    // Shared-with-me
    if (tab === 'shared') {
      const accesses = await prisma.sharedChecklistAccess.findMany({
        where: { userId },
        include: {
          checklist: { include: { items: { orderBy: { order: 'asc' } } } },
        },
        orderBy: { accessedAt: 'desc' },
      });
      const checklists = accesses.map((a: { checklist: Parameters<typeof shapeChecklist>[0] }) => shapeChecklist(a.checklist));
      return NextResponse.json({ checklists });
    }

    // All user's checklists
    const checklists = await prisma.checklist.findMany({
      where: { userId },
      include: { items: { orderBy: { order: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json({ checklists: checklists.map(shapeChecklist) });

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

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
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

    return NextResponse.json({ checklist: shapeChecklist(checklist!) });
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

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (dueDate !== undefined) data.dueDate = dueDate;
    if (dueTime !== undefined) data.dueTime = dueTime;
    if (planId !== undefined) data.planId = planId;
    data.updatedAt = new Date();

    const result = await prisma.checklist.updateMany({
      where: { id, userId: session.user.id },
      data,
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating checklist:', error);
    return NextResponse.json({ error: 'Failed to update checklist' }, { status: 500 });
  }
}

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

    const shareLink = checklist.shareLink || generateShareLink();

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
