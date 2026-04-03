import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { auth } from '@/auth';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { templateId, title, planId } = body;

    if (!templateId) {
      return NextResponse.json({ error: 'templateId is required' }, { status: 400 });
    }

    const template = await prisma.checklistTemplate.findUnique({
      where: { id: templateId },
      include: { items: { orderBy: { order: 'asc' } } },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const checklist = await prisma.$transaction(async (tx) => {
      const created = await tx.checklist.create({
        data: {
          userId: session.user.id,
          title: title || template.title,
          description: template.description,
          planId: planId || null,
        },
      });

      if (template.items.length > 0) {
        await tx.checklistItem.createMany({
          data: template.items.map(item => ({
            checklistId: created.id,
            title: item.title,
            groupName: item.groupName,
            notes: item.notes,
            order: item.order,
          })),
        });
      }

      return tx.checklist.findUnique({
        where: { id: created.id },
        include: { items: { orderBy: { order: 'asc' } } },
      });
    });

    return NextResponse.json({
      checklist: { ...checklist, _id: checklist!.id, items: checklist!.items.map(i => ({ ...i, _id: i.id })) },
    });
  } catch (error) {
    console.error('Error creating from template:', error);
    return NextResponse.json({ error: 'Failed to create checklist from template' }, { status: 500 });
  }
}
