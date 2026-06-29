import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { auth } from '@/auth';

// GET — list share links and members for a checklist (owner only)
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const checklistId = searchParams.get('checklistId');
    if (!checklistId) {
      return NextResponse.json({ error: 'checklistId is required' }, { status: 400 });
    }

    const checklist = await prisma.checklist.findUnique({ where: { id: checklistId } });
    if (!checklist || checklist.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [shareLinks, members] = await Promise.all([
      prisma.checklistShareLink.findMany({
        where: { checklistId },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.sharedChecklistAccess.findMany({
        where: { checklistId },
        include: { shareLink: { select: { permission: true, isActive: true } } },
        orderBy: { accessedAt: 'desc' },
      }),
    ]);

    return NextResponse.json({ shareLinks, members });
  } catch (error) {
    console.error('Error fetching checklist members:', error);
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
}

// DELETE — remove a specific member's access
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const checklistId = searchParams.get('checklistId');
    const memberId = searchParams.get('memberId');
    if (!checklistId || !memberId) {
      return NextResponse.json({ error: 'checklistId and memberId are required' }, { status: 400 });
    }

    const checklist = await prisma.checklist.findUnique({ where: { id: checklistId } });
    if (!checklist || checklist.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.sharedChecklistAccess.deleteMany({ where: { id: memberId, checklistId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error removing checklist member:', error);
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
}
