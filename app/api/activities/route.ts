import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { Activity } from '@/lib/types';
import { generateId, sortByTime } from '@/lib/utils';
import { auth } from '@/auth';

function shapeActivity(act: any) {
  return {
    _id: act.id,
    id: act.id,
    title: act.title,
    description: act.description ?? undefined,
    type: act.type,
    startTime: act.startTime,
    duration: act.duration,
    endTime: act.endTime ?? undefined,
    location: act.location ?? undefined,
    address: act.address ?? undefined,
    status: act.status,
    priority: act.priority,
    notes: act.notes ?? undefined,
    cost: act.cost ?? undefined,
    currency: act.currency ?? undefined,
    weatherDependent: act.weatherDependent,
    isBreak: act.isBreak,
    aiSuggested: act.aiSuggested,
    order: act.order,
    color: act.color ?? undefined,
    icon: act.icon ?? undefined,
    imageUrl: act.imageUrl ?? undefined,
    mapsUrl: act.mapsUrl ?? undefined,
  };
}

// Verify the requesting user can access this plan (owner or public)
async function getPlanAccess(planId: string, userId: string) {
  return prisma.plan.findFirst({
    where: {
      id: planId,
      OR: [{ createdBy: userId }, { isPublic: true }],
    },
  });
}

// GET activities for a day
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId');
    const dayId = searchParams.get('dayId');

    if (!planId || !dayId) {
      return NextResponse.json({ error: 'Plan ID and Day ID are required' }, { status: 400 });
    }

    const plan = await getPlanAccess(planId, session.user.id);
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    const day = await prisma.dayPlan.findFirst({
      where: { id: dayId, planId },
      include: { activities: { orderBy: { order: 'asc' } } },
    });
    if (!day) return NextResponse.json({ error: 'Day not found' }, { status: 404 });

    return NextResponse.json({ activities: sortByTime(day.activities.map(shapeActivity)) });
  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
  }
}

// POST — add activity to a day
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { planId, dayId, activity } = body;

    if (!planId || !dayId || !activity) {
      return NextResponse.json({ error: 'Plan ID, Day ID, and activity are required' }, { status: 400 });
    }

    // Verify ownership (only owner can add activities)
    const plan = await prisma.plan.findFirst({ where: { id: planId, createdBy: session.user.id } });
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    const day = await prisma.dayPlan.findFirst({ where: { id: dayId, planId } });
    if (!day) return NextResponse.json({ error: 'Day not found' }, { status: 404 });

    const newActivity = await prisma.activity.create({
      data: {
        id: activity.id || generateId(),
        dayPlanId: dayId,
        title: activity.title || 'Activity',
        description: activity.description,
        type: activity.type || 'activity',
        startTime: activity.startTime || '09:00',
        duration: activity.duration || 60,
        endTime: activity.endTime,
        location: activity.location,
        address: activity.address,
        status: activity.status || 'planned',
        priority: activity.priority || 'medium',
        notes: activity.notes,
        cost: activity.cost,
        currency: activity.currency,
        weatherDependent: activity.weatherDependent || false,
        isBreak: activity.isBreak || false,
        aiSuggested: activity.aiSuggested || false,
        order: activity.order ?? 0,
        color: activity.color,
        icon: activity.icon,
        imageUrl: activity.imageUrl,
        mapsUrl: activity.mapsUrl,
      },
    });

    // Touch plan updatedAt
    await prisma.plan.update({ where: { id: planId }, data: { updatedAt: new Date() } });

    return NextResponse.json({ activity: shapeActivity(newActivity) });
  } catch (error) {
    console.error('Error adding activity:', error);
    return NextResponse.json({ error: 'Failed to add activity' }, { status: 500 });
  }
}

// PUT — update a single activity
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { planId, dayId, activityId, updates } = body;

    if (!planId || !dayId || !activityId) {
      return NextResponse.json({ error: 'Plan ID, Day ID, and Activity ID are required' }, { status: 400 });
    }

    const plan = await prisma.plan.findFirst({ where: { id: planId, createdBy: session.user.id } });
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    // Build safe update object (only known scalar fields)
    const data: Record<string, any> = {};
    const allowed = [
      'title', 'description', 'type', 'startTime', 'duration', 'endTime',
      'location', 'address', 'status', 'priority', 'notes', 'cost',
      'currency', 'weatherDependent', 'isBreak', 'aiSuggested', 'order', 'color', 'icon',
      'imageUrl', 'mapsUrl',
    ];
    for (const key of allowed) {
      if (updates && key in updates) data[key] = updates[key];
    }
    // Allow full activity replacement (from onActivityUpdate which passes the whole object)
    if (!updates && body.activityId) {
      // updates might be the whole activity
    }

    await prisma.activity.updateMany({
      where: { id: activityId, dayPlanId: dayId },
      data,
    });

    await prisma.plan.update({ where: { id: planId }, data: { updatedAt: new Date() } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating activity:', error);
    return NextResponse.json({ error: 'Failed to update activity' }, { status: 500 });
  }
}

// DELETE — remove an activity
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId');
    const dayId = searchParams.get('dayId');
    const activityId = searchParams.get('activityId');

    if (!planId || !dayId || !activityId) {
      return NextResponse.json({ error: 'Plan ID, Day ID, and Activity ID are required' }, { status: 400 });
    }

    const plan = await prisma.plan.findFirst({ where: { id: planId, createdBy: session.user.id } });
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    await prisma.activity.deleteMany({ where: { id: activityId, dayPlanId: dayId } });

    await prisma.plan.update({ where: { id: planId }, data: { updatedAt: new Date() } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting activity:', error);
    return NextResponse.json({ error: 'Failed to delete activity' }, { status: 500 });
  }
}

// PATCH — bulk replace/reorder activities for a day (also handles notes save)
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { planId, dayId, activities, notes } = body;

    if (!planId || !dayId) {
      return NextResponse.json({ error: 'Plan ID and Day ID are required' }, { status: 400 });
    }

    const plan = await prisma.plan.findFirst({ where: { id: planId, createdBy: session.user.id } });
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    // Save day notes if provided
    if (notes !== undefined) {
      await prisma.dayPlan.updateMany({ where: { id: dayId, planId }, data: { notes } });
    }

    // Bulk replace activities if provided
    if (activities) {
      const ordered: Activity[] = sortByTime(activities).map((a: Activity, i: number) => ({ ...a, order: i }));

      // Delete all existing activities for this day and recreate
      await prisma.activity.deleteMany({ where: { dayPlanId: dayId } });

      if (ordered.length > 0) {
        await prisma.activity.createMany({
          data: ordered.map((a: any) => ({
            id: a.id || generateId(),
            dayPlanId: dayId,
            title: a.title || 'Activity',
            description: a.description,
            type: a.type || 'activity',
            startTime: a.startTime || '09:00',
            duration: a.duration || 60,
            endTime: a.endTime,
            location: a.location,
            address: a.address,
            status: a.status || 'planned',
            priority: a.priority || 'medium',
            notes: a.notes,
            cost: a.cost,
            currency: a.currency,
            weatherDependent: a.weatherDependent || false,
            isBreak: a.isBreak || false,
            aiSuggested: a.aiSuggested || false,
            order: a.order,
            color: a.color,
            icon: a.icon,
            imageUrl: a.imageUrl,
            mapsUrl: a.mapsUrl,
          })),
        });
      }
    }

    await prisma.plan.update({ where: { id: planId }, data: { updatedAt: new Date() } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating activities:', error);
    return NextResponse.json({ error: 'Failed to update activities' }, { status: 500 });
  }
}
