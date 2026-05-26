import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { auth } from '@/auth';
import { generateId } from '@/lib/utils';

// POST — create or return existing share link for a checklist
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await request.json();
    const { checklistId, permission } = body as { checklistId: string; permission: 'view' | 'edit' };

    if (!checklistId || !permission || !['view', 'edit'].includes(permission)) {
      return NextResponse.json({ error: 'checklistId and permission (view|edit) are required' }, { status: 400 });
    }

    // Verify ownership
    const checklist = await prisma.checklist.findUnique({ where: { id: checklistId } });
    if (!checklist || checklist.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Return existing active link if one exists for this permission
    const existing = await prisma.checklistShareLink.findFirst({
      where: { checklistId, permission, isActive: true },
    });
    if (existing) {
      const base = request.headers.get('origin') ?? '';
      return NextResponse.json({
        link: { ...existing, url: `${base}/?cshare=${existing.token}` },
      });
    }

    const token = generateId();
    const link = await prisma.checklistShareLink.create({
      data: { id: generateId(), checklistId, token, permission, isActive: true },
    });

    await prisma.checklist.update({ where: { id: checklistId }, data: { isPublic: true } });

    const base = request.headers.get('origin') ?? '';
    return NextResponse.json({ link: { ...link, url: `${base}/?cshare=${token}` } });
  } catch (error) {
    console.error('Error creating checklist share link:', error);
    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
  }
}

// DELETE — revoke a share link and remove all members who joined via it
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const linkId = searchParams.get('linkId');
    if (!linkId) {
      return NextResponse.json({ error: 'linkId is required' }, { status: 400 });
    }

    const link = await prisma.checklistShareLink.findUnique({
      where: { id: linkId },
      include: { checklist: true },
    });
    if (!link || link.checklist.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.sharedChecklistAccess.deleteMany({ where: { linkId } });
    await prisma.checklistShareLink.update({ where: { id: linkId }, data: { isActive: false } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error revoking checklist share link:', error);
    return NextResponse.json({ error: 'Failed to revoke share link' }, { status: 500 });
  }
}
