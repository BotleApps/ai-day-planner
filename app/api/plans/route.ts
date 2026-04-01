import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { DEFAULT_PREFERENCES } from '@/lib/types';
import { generateId, getDatesBetween } from '@/lib/utils';
import { auth } from '@/auth';

// Helper: shape a raw Prisma plan row back into the Plan shape the frontend expects
function shapePlan(plan: any) {
  return {
    _id: plan.id,
    id: plan.id,
    title: plan.title,
    description: plan.description,
    destination: plan.destination,
    coverImage: plan.coverImage,
    status: plan.status,
    startDate: plan.startDate,
    endDate: plan.endDate,
    createdBy: plan.createdBy,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    sharing: {
      isPublic: plan.isPublic,
      shareLink: plan.shareLink ?? undefined,
      sharedWith: [],
    },
    preferences: {
      wakeUpTime: plan.wakeUpTime,
      sleepTime: plan.sleepTime,
      pace: plan.pace,
      breakFrequency: plan.breakFrequency,
      breakDuration: plan.breakDuration,
      travelBuffer: plan.travelBuffer,
      mealTimes: {
        breakfast: plan.mealBreakfast ?? undefined,
        lunch: plan.mealLunch ?? undefined,
        dinner: plan.mealDinner ?? undefined,
      },
      activityTypes: plan.activityTypes,
      accessibility: plan.accessibility,
      dietaryRestrictions: plan.dietaryRestrictions,
      interests: plan.interests,
    },
    days: (plan.days ?? []).map((day: any) => ({
      _id: day.id,
      id: day.id,
      date: day.date,
      dayNumber: day.dayNumber,
      title: day.title ?? undefined,
      description: day.description ?? undefined,
      notes: day.notes ?? undefined,
      startTime: day.startTime ?? undefined,
      endTime: day.endTime ?? undefined,
      activities: (day.activities ?? [])
        .sort((a: any, b: any) => a.order - b.order)
        .map((act: any) => ({
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
        })),
    })),
  };
}

const DAY_INCLUDE = {
  activities: { orderBy: { order: 'asc' as const } },
};

// GET — all plans for user, or single plan by id/shareLink
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('id');
    const shareLink = searchParams.get('share');

    // Public share — no auth
    if (shareLink) {
      const plan = await prisma.plan.findUnique({
        where: { shareLink },
        include: { days: { include: DAY_INCLUDE } },
      });
      if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
      return NextResponse.json({ plan: shapePlan(plan) });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    if (planId) {
      const plan = await prisma.plan.findFirst({
        where: {
          id: planId,
          OR: [{ createdBy: userId }, { isPublic: true }],
        },
        include: { days: { include: DAY_INCLUDE } },
      });
      if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
      return NextResponse.json({ plan: shapePlan(plan) });
    }

    const plans = await prisma.plan.findMany({
      where: { createdBy: userId },
      include: { days: { include: DAY_INCLUDE } },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json({ plans: plans.map(shapePlan) });
  } catch (error) {
    console.error('Error fetching plans:', error);
    return NextResponse.json({ error: 'Failed to fetch plans', plans: [] }, { status: 500 });
  }
}

// POST — create plan
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, destination, startDate, endDate, preferences, coverImage, days: incomingDays } = body;

    if (!title || !startDate || !endDate) {
      return NextResponse.json({ error: 'Title, start date, and end date are required' }, { status: 400 });
    }

    const prefs = { ...DEFAULT_PREFERENCES, ...preferences };
    const dates = getDatesBetween(startDate, endDate);

    const daysData = incomingDays?.length
      ? incomingDays.map((d: any, i: number) => ({
          id: d.id || generateId(),
          date: d.date || dates[i] || startDate,
          dayNumber: d.dayNumber || i + 1,
          title: d.title,
          description: d.description,
          notes: d.notes,
          activities: {
            create: (d.activities || []).map((a: any, ai: number) => ({
              id: a.id || generateId(),
              title: a.title || 'Activity',
              description: a.description,
              type: a.type || 'activity',
              startTime: a.startTime || '09:00',
              duration: a.duration || 60,
              status: a.status || 'planned',
              order: a.order ?? ai,
              priority: a.priority || 'medium',
              location: a.location,
              notes: a.notes,
              cost: a.cost,
              isBreak: a.isBreak || false,
              aiSuggested: a.aiSuggested || false,
            })),
          },
        }))
      : dates.map((date, index) => ({
          id: generateId(),
          date,
          dayNumber: index + 1,
          activities: { create: [] },
        }));

    const plan = await prisma.plan.create({
      data: {
        id: generateId(),
        title,
        description: description || '',
        destination: destination || '',
        coverImage: coverImage || '',
        status: 'draft',
        startDate,
        endDate,
        createdBy: session.user.id,
        // Preferences
        wakeUpTime: prefs.wakeUpTime || '07:00',
        sleepTime: prefs.sleepTime || '22:00',
        pace: prefs.pace || 'moderate',
        breakFrequency: prefs.breakFrequency || 120,
        breakDuration: prefs.breakDuration || 15,
        travelBuffer: prefs.travelBuffer || 30,
        mealBreakfast: prefs.mealTimes?.breakfast,
        mealLunch: prefs.mealTimes?.lunch,
        mealDinner: prefs.mealTimes?.dinner,
        activityTypes: prefs.activityTypes || [],
        accessibility: prefs.accessibility || [],
        dietaryRestrictions: prefs.dietaryRestrictions || [],
        interests: prefs.interests || [],
        days: { create: daysData },
      },
      include: { days: { include: DAY_INCLUDE } },
    });

    return NextResponse.json({ plan: shapePlan(plan) });
  } catch (error) {
    console.error('Error creating plan:', error);
    return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 });
  }
}

// PUT — update plan metadata / dates
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });

    // Check ownership
    const existing = await prisma.plan.findFirst({
      where: { id, createdBy: session.user.id },
      include: { days: true },
    });
    if (!existing) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    const newStart = updates.startDate || existing.startDate;
    const newEnd = updates.endDate || existing.endDate;

    // Rebuild days if date range changed
    if (newStart !== existing.startDate || newEnd !== existing.endDate) {
      const dates = getDatesBetween(newStart, newEnd);
      const existingByDate = new Map(existing.days.map((d: any) => [d.date, d]));

      // Delete days that no longer fall in range
      await prisma.dayPlan.deleteMany({
        where: { planId: id, date: { notIn: dates } },
      });

      // Create any new dates
      const existingDates = new Set(existing.days.map((d: any) => d.date));
      for (let i = 0; i < dates.length; i++) {
        const date = dates[i];
        if (!existingDates.has(date)) {
          await prisma.dayPlan.create({
            data: { id: generateId(), planId: id, date, dayNumber: i + 1 },
          });
        } else {
          // Update dayNumber in case order shifted
          const day = existingByDate.get(date) as any;
          await prisma.dayPlan.update({
            where: { id: day.id },
            data: { dayNumber: i + 1 },
          });
        }
      }
      updates.startDate = newStart;
      updates.endDate = newEnd;
    }

    // Build flat update data (only allowed scalar fields)
    const data: Record<string, any> = {};
    if (updates.title !== undefined) data.title = updates.title;
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.destination !== undefined) data.destination = updates.destination;
    if (updates.coverImage !== undefined) data.coverImage = updates.coverImage;
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.startDate !== undefined) data.startDate = updates.startDate;
    if (updates.endDate !== undefined) data.endDate = updates.endDate;

    await prisma.plan.update({ where: { id }, data });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating plan:', error);
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 });
  }
}

// DELETE — remove plan
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });

    const plan = await prisma.plan.findFirst({ where: { id, createdBy: session.user.id } });
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    await prisma.plan.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting plan:', error);
    return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 });
  }
}
