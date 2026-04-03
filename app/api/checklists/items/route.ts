import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { auth } from '@/auth';

async function verifyOwnership(checklistId: string, userId: string) {
  return prisma.checklist.findFirst({ where: { id: checklistId, userId } });
}

function shapeItem(item: {
  id: string; checklistId: string; title: string; groupName: string;
  completed: boolean; order: number; dueDate: string | null; notes: string;
}) {
  return { ...item, _id: item.id };
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { checklistId, title, groupName, dueDate, notes } = body;

    if (!checklistId || !title) {
      return NextResponse.json({ error: 'checklistId and title are required' }, { status: 400 });
    }

    const checklist = await verifyOwnership(checklistId, session.user.id);
    if (!checklist) {
      return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
    }

    const count = await prisma.checklistItem.count({ where: { checklistId } });

    const item = await prisma.checklistItem.create({
      data: {
        checklistId,
        title,
        groupName: groupName || '',
        dueDate: dueDate || null,
        notes: notes || '',
        order: count,
      },
    });

    await prisma.checklist.update({ where: { id: checklistId }, data: { updatedAt: new Date() } });

    return NextResponse.json({ item: shapeItem(item) });
  } catch (error) {
    console.error('Error creating checklist item:', error);
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, checklistId, title, completed, groupName, dueDate, notes, order } = body;

    if (!id || !checklistId) {
      return NextResponse.json({ error: 'id and checklistId are required' }, { status: 400 });
    }

    const checklist = await verifyOwnership(checklistId, session.user.id);
    if (!checklist) {
      return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (completed !== undefined) data.completed = completed;
    if (groupName !== undefined) data.groupName = groupName;
    if (dueDate !== undefined) data.dueDate = dueDate;
    if (notes !== undefined) data.notes = notes;
    if (order !== undefined) data.order = order;

    await prisma.checklistItem.updateMany({ where: { id, checklistId }, data });
    await prisma.checklist.update({ where: { id: checklistId }, data: { updatedAt: new Date() } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating checklist item:', error);
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
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
    const checklistId = searchParams.get('checklistId');

    if (!id || !checklistId) {
      return NextResponse.json({ error: 'id and checklistId are required' }, { status: 400 });
    }

    const checklist = await verifyOwnership(checklistId, session.user.id);
    if (!checklist) {
      return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
    }

    await prisma.checklistItem.deleteMany({ where: { id, checklistId } });
    await prisma.checklist.update({ where: { id: checklistId }, data: { updatedAt: new Date() } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting checklist item:', error);
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}

// Bulk reorder
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { checklistId, items } = body;

    if (!checklistId || !Array.isArray(items)) {
      return NextResponse.json({ error: 'checklistId and items are required' }, { status: 400 });
    }

    const checklist = await verifyOwnership(checklistId, session.user.id);
    if (!checklist) {
      return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
    }

    await prisma.$transaction(
      items.map((item: { id: string; order: number }) =>
        prisma.checklistItem.updateMany({
          where: { id: item.id, checklistId },
          data: { order: item.order },
        })
      )
    );

    await prisma.checklist.update({ where: { id: checklistId }, data: { updatedAt: new Date() } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reordering checklist items:', error);
    return NextResponse.json({ error: 'Failed to reorder items' }, { status: 500 });
  }
}
