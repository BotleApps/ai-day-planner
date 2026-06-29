import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { auth } from '@/auth';
import { generateId, generateShareToken } from '@/lib/utils';

// POST — create or return existing share link for a plan
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await request.json();
    const { planId, permission } = body as { planId: string; permission: 'view' | 'edit' };

    if (!planId || !permission || !['view', 'edit'].includes(permission)) {
      return NextResponse.json({ error: 'planId and permission (view|edit) are required' }, { status: 400 });
    }

    // Verify ownership
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || plan.createdBy !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Return existing active link if one exists
    const existing = await prisma.shareLink.findFirst({
      where: { planId, permission, isActive: true },
    });
    if (existing) {
      const base = request.headers.get('origin') ?? '';
      return NextResponse.json({
        link: { ...existing, url: `${base}/?share=${existing.token}` },
      });
    }

    // Create new link — atomically create link and mark plan public
    const token = generateShareToken();
    const [link] = await prisma.$transaction([
      prisma.shareLink.create({
        data: { id: generateId(), planId, token, permission, isActive: true },
      }),
      prisma.plan.update({ where: { id: planId }, data: { isPublic: true } }),
    ]);

    const base = request.headers.get('origin') ?? '';
    return NextResponse.json({ link: { ...link, url: `${base}/?share=${token}` } });
  } catch (error) {
    console.error('Error creating share link:', error);
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

    const link = await prisma.shareLink.findUnique({
      where: { id: linkId },
      include: { plan: true },
    });
    if (!link || link.plan.createdBy !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Atomically delete members and deactivate the link
    await prisma.$transaction([
      prisma.sharedAccess.deleteMany({ where: { linkId } }),
      prisma.shareLink.update({ where: { id: linkId }, data: { isActive: false } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error revoking share link:', error);
    return NextResponse.json({ error: 'Failed to revoke share link' }, { status: 500 });
  }
}
