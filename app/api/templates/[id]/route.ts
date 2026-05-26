import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const template = await prisma.checklistTemplate.findUnique({
      where: { id },
      include: { items: { orderBy: { order: 'asc' } } },
    });

    if (!template || !template.isPublished) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
  }
}
