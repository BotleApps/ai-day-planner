import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { auth } from '@/auth';

function shapeTemplate(row: {
  id: string; authorId: string; authorName: string; title: string;
  description: string; category: string; isPublished: boolean;
  createdAt: Date; updatedAt: Date;
  _count?: { items: number };
  items?: { id: string; templateId: string; title: string; groupName: string; order: number; notes: string }[];
}) {
  return {
    ...row,
    itemCount: row._count?.items ?? row.items?.length ?? 0,
    _count: undefined,
  };
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const mine = searchParams.get('mine');
    const category = searchParams.get('category');
    const q = searchParams.get('q');

    if (id) {
      const template = await prisma.checklistTemplate.findUnique({
        where: { id },
        include: { items: { orderBy: { order: 'asc' } } },
      });
      if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ template: shapeTemplate({ ...template, items: template.items }) });
    }

    if (mine) {
      const templates = await prisma.checklistTemplate.findMany({
        where: { authorId: session.user.id },
        include: { _count: { select: { items: true } } },
        orderBy: { updatedAt: 'desc' },
      });
      return NextResponse.json({ templates: templates.map(shapeTemplate) });
    }

    // Browse published
    const where: Record<string, unknown> = { isPublished: true };
    if (category && category !== 'all') where.category = category;
    if (q) where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ];

    const templates = await prisma.checklistTemplate.findMany({
      where,
      include: { _count: { select: { items: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ templates: templates.map(shapeTemplate) });

  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, category, items } = body;

    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    const template = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      const created = await tx.checklistTemplate.create({
        data: {
          authorId: session.user.id,
          authorName: session.user.name || '',
          title,
          description: description || '',
          category: category || 'general',
          isPublished: false,
        },
      });

      if (Array.isArray(items) && items.length > 0) {
        await tx.checklistTemplateItem.createMany({
          data: items.map((item: { title: string; groupName?: string; notes?: string }, idx: number) => ({
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

    return NextResponse.json({ template: shapeTemplate({ ...template!, items: template!.items }) });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, title, description, category } = body;
    if (!id) return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });

    const data: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (category !== undefined) data.category = category;

    const result = await prisma.checklistTemplate.updateMany({
      where: { id, authorId: session.user.id },
      data,
    });

    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating template:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
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
    if (!id) return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });

    const result = await prisma.checklistTemplate.updateMany({
      where: { id, authorId: session.user.id },
      data: { isPublished: true, updatedAt: new Date() },
    });

    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error publishing template:', error);
    return NextResponse.json({ error: 'Failed to publish template' }, { status: 500 });
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
    if (!id) return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });

    const result = await prisma.checklistTemplate.deleteMany({
      where: { id, authorId: session.user.id },
    });

    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
