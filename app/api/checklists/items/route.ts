import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { auth } from '@/auth';
import { resolveChecklistPermission } from '@/lib/checklist-access';

async function verifyWriteAccess(checklistId: string, userId: string) {
  const perm = await resolveChecklistPermission(checklistId, userId);
  return perm === 'owner' || perm === 'edit';
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

    if (!checklistId || !title || typeof title !== 'string') {
      return NextResponse.json({ error: 'checklistId and title are required' }, { status: 400 });
    }
    if (title.length > 500) {
      return NextResponse.json({ error: 'Title is too long (max 500 chars)' }, { status: 400 });
    }
    if (groupName && typeof groupName === 'string' && groupName.length > 100) {
      return NextResponse.json({ error: 'Group name is too long (max 100 chars)' }, { status: 400 });
    }
    if (notes && typeof notes === 'string' && notes.length > 5000) {
      return NextResponse.json({ error: 'Notes are too long (max 5000 chars)' }, { status: 400 });
    }

    if (!(await verifyWriteAccess(checklistId, session.user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

    if (!(await verifyWriteAccess(checklistId, session.user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

    if (!(await verifyWriteAccess(checklistId, session.user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.checklistItem.deleteMany({ where: { id, checklistId } });
    await prisma.checklist.update({ where: { id: checklistId }, data: { updatedAt: new Date() } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting checklist item:', error);
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}

// Bulk reorder OR bulk group rename/delete
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { checklistId, items, renameGroup, deleteGroup } = body;

    if (!checklistId) {
      return NextResponse.json({ error: 'checklistId is required' }, { status: 400 });
    }

    if (!(await verifyWriteAccess(checklistId, session.user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Rename a group (move all items from one groupName to another)
    if (renameGroup && typeof renameGroup.from === 'string' && typeof renameGroup.to === 'string') {
      await prisma.checklistItem.updateMany({
        where: { checklistId, groupName: renameGroup.from },
        data: { groupName: renameGroup.to },
      });
      await prisma.checklist.update({ where: { id: checklistId }, data: { updatedAt: new Date() } });
      return NextResponse.json({ success: true });
    }

    // Delete a group: either delete all items (deleteGroup.removeItems) or move them to ungrouped
    if (deleteGroup && typeof deleteGroup.name === 'string') {
      if (deleteGroup.removeItems) {
        await prisma.checklistItem.deleteMany({
          where: { checklistId, groupName: deleteGroup.name },
        });
      } else {
        await prisma.checklistItem.updateMany({
          where: { checklistId, groupName: deleteGroup.name },
          data: { groupName: '' },
        });
      }
      await prisma.checklist.update({ where: { id: checklistId }, data: { updatedAt: new Date() } });
      return NextResponse.json({ success: true });
    }

    // Reorder (and optionally group-reassign) items
    if (Array.isArray(items)) {
      await prisma.$transaction(
        items.map((item: { id: string; order: number; groupName?: string }) =>
          prisma.checklistItem.updateMany({
            where: { id: item.id, checklistId },
            data: item.groupName !== undefined
              ? { order: item.order, groupName: item.groupName }
              : { order: item.order },
          })
        )
      );
      await prisma.checklist.update({ where: { id: checklistId }, data: { updatedAt: new Date() } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'No operation specified' }, { status: 400 });
  } catch (error) {
    console.error('Error patching checklist items:', error);
    return NextResponse.json({ error: 'Failed to update items' }, { status: 500 });
  }
}
