import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { auth } from '@/auth';

// POST — clone a checklist (must be owned by user) into a new template, optionally publish
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { checklistId, title, description, category, publish } = body as {
      checklistId: string; title?: string; description?: string;
      category?: string; publish?: boolean;
    };

    if (!checklistId) {
      return NextResponse.json({ error: 'checklistId is required' }, { status: 400 });
    }

    const checklist = await prisma.checklist.findFirst({
      where: { id: checklistId, userId: session.user.id },
      include: { items: { orderBy: { order: 'asc' } } },
    });
    if (!checklist) {
      return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
    }

    const template = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      const created = await tx.checklistTemplate.create({
        data: {
          authorId: session.user.id,
          authorName: session.user.name || '',
          title: title || checklist.title,
          description: description ?? checklist.description ?? '',
          category: category || 'general',
          isPublished: !!publish,
        },
      });

      if (checklist.items.length > 0) {
        await tx.checklistTemplateItem.createMany({
          data: checklist.items.map((item, idx) => ({
            templateId: created.id,
            title: item.title,
            groupName: item.groupName || '',
            notes: item.notes || '',
            order: idx,
          })),
        });
      }

      return tx.checklistTemplate.findUnique({
        where: { id: created.id },
        include: { items: { orderBy: { order: 'asc' } } },
      });
    });

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error creating template from checklist:', error);
    return NextResponse.json({ error: 'Failed to save as template' }, { status: 500 });
  }
}
