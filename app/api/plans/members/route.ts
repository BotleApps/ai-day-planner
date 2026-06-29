import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { auth } from '@/auth';

// GET — list share links and members for a plan (owner only)
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId');
    if (!planId) {
      return NextResponse.json({ error: 'planId is required' }, { status: 400 });
    }

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || plan.createdBy !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [shareLinks, members] = await Promise.all([
      prisma.shareLink.findMany({
        where: { planId },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.sharedAccess.findMany({
        where: { planId },
        include: { shareLink: { select: { permission: true, isActive: true } } },
        orderBy: { accessedAt: 'desc' },
      }),
    ]);

    return NextResponse.json({ shareLinks, members });
  } catch (error) {
    console.error('Error fetching members:', error);
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
    const planId = searchParams.get('planId');
    const memberId = searchParams.get('memberId');
    if (!planId || !memberId) {
      return NextResponse.json({ error: 'planId and memberId are required' }, { status: 400 });
    }

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || plan.createdBy !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.sharedAccess.deleteMany({ where: { id: memberId, planId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error removing member:', error);
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
}
