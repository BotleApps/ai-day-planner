import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { DEFAULT_PREFERENCES } from '@/lib/types';
import { generateId, generateShareToken, getDatesBetween } from '@/lib/utils';
import { auth } from '@/auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

// Helper: shape a raw Prisma plan row back into the Plan shape the frontend
// expects. Every field is optional in the input types because the same shaper
// runs against both the detail `include`-all query and the list-view `select`
// (which returns only `activities: { id, status }`). The shaper defensively
// falls back to `undefined` for anything not selected.
type ActivityRow = {
  id: string;
  title?: string;
  description?: string | null;
  type?: string;
  startTime?: string;
  duration?: number;
  endTime?: string | null;
  location?: string | null;
  address?: string | null;
  status?: string;
  priority?: string;
  notes?: string | null;
  cost?: number | null;
  currency?: string | null;
  weatherDependent?: boolean;
  isBreak?: boolean;
  aiSuggested?: boolean;
  order?: number;
  color?: string | null;
  icon?: string | null;
};

type DayRow = {
  id: string;
  date?: string;
  dayNumber?: number;
  title?: string | null;
  description?: string | null;
  notes?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  activities?: ActivityRow[];
};

type PlanRow = {
  id: string;
  title?: string;
  description?: string;
  destination?: string;
  coverImage?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  isPublic?: boolean;
  shareLink?: string | null;
  wakeUpTime?: string;
  sleepTime?: string;
  pace?: string;
  breakFrequency?: number;
  breakDuration?: number;
  travelBuffer?: number;
  mealBreakfast?: string | null;
  mealLunch?: string | null;
  mealDinner?: string | null;
  activityTypes?: string[];
  accessibility?: string[];
  dietaryRestrictions?: string[];
  interests?: string[];
  days?: DayRow[];
};

function shapePlan(plan: PlanRow) {
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
    days: (plan.days ?? []).map((day: DayRow) => ({
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
        .sort((a: ActivityRow, b: ActivityRow) => (a.order ?? 0) - (b.order ?? 0))
        .map((act: ActivityRow) => ({
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

// GET — all plans for user, or single plan by id/shareLink, or shared-with-me
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('id');
    const shareToken = searchParams.get('share');
    const tab = searchParams.get('tab');

    // Share link branch — no auth required for view
    if (shareToken) {
      // Rate-limit unauthenticated lookups by IP to prevent token brute-forcing
      const rl = rateLimit(`share:${getClientIp({ headers: request.headers })}`, 60, 60_000);
      if (!rl.ok) {
        return NextResponse.json(
          { error: 'Too many requests.' },
          { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
        );
      }
      // Try new ShareLink table first
      const shareLink = await prisma.shareLink.findUnique({
        where: { token: shareToken },
        include: { plan: { include: { days: { include: DAY_INCLUDE } } } },
      });

      if (shareLink && shareLink.isActive && shareLink.plan) {
        const session = await auth();
        const isOwner = session?.user?.id === shareLink.plan.createdBy;
        // Unauthenticated or owner → view only via link; authenticated non-owner → record access
        let userPermission: 'view' | 'edit' = 'view';
        if (session?.user?.id && !isOwner) {
          userPermission = shareLink.permission as 'view' | 'edit';
          await prisma.sharedAccess.upsert({
            where: { userId_planId: { userId: session.user.id, planId: shareLink.planId } },
            update: { accessedAt: new Date(), permission: userPermission, linkId: shareLink.id,
              userEmail: session.user.email ?? '', userName: session.user.name ?? '' },
            create: {
              id: generateId(),
              userId: session.user.id,
              userEmail: session.user.email ?? '',
              userName: session.user.name ?? '',
              planId: shareLink.planId,
              permission: userPermission,
              linkId: shareLink.id,
            },
          });
        }
        return NextResponse.json({
          plan: shapePlan(shareLink.plan),
          userPermission: session?.user?.id ? (isOwner ? 'owner' : userPermission) : 'view',
        });
      }

      // Backward compat: fall back to Plan.shareLink
      const plan = await prisma.plan.findUnique({
        where: { shareLink: shareToken },
        include: { days: { include: DAY_INCLUDE } },
      });
      if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

      const session = await auth();
      if (session?.user?.id && session.user.id !== plan.createdBy) {
        await prisma.sharedAccess.upsert({
          where: { userId_planId: { userId: session.user.id, planId: plan.id } },
          update: { accessedAt: new Date() },
          create: {
            id: generateId(),
            userId: session.user.id,
            userEmail: session.user.email ?? '',
            userName: session.user.name ?? '',
            planId: plan.id,
            permission: 'view',
          },
        });
      }
      return NextResponse.json({ plan: shapePlan(plan), userPermission: 'view' });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    if (planId) {
      // Check ownership first
      let plan = await prisma.plan.findFirst({
        where: { id: planId, createdBy: userId },
        include: { days: { include: DAY_INCLUDE } },
      });
      if (plan) {
        return NextResponse.json({ plan: shapePlan(plan), userPermission: 'owner' });
      }

      // Check shared access with active link
      const access = await prisma.sharedAccess.findUnique({
        where: { userId_planId: { userId, planId } },
        include: { shareLink: true },
      });
      if (access && access.shareLink?.isActive) {
        plan = await prisma.plan.findFirst({
          where: { id: planId },
          include: { days: { include: DAY_INCLUDE } },
        });
        if (plan) {
          return NextResponse.json({ plan: shapePlan(plan), userPermission: access.permission });
        }
      }

      // Fallback: public plan (backward compat)
      plan = await prisma.plan.findFirst({
        where: { id: planId, isPublic: true },
        include: { days: { include: DAY_INCLUDE } },
      });
      if (plan) {
        return NextResponse.json({ plan: shapePlan(plan), userPermission: 'view' });
      }

      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Shared-with-me tab
    if (tab === 'shared') {
      const accesses = await prisma.sharedAccess.findMany({
        where: { userId, shareLink: { isActive: true } },
        include: { plan: { include: { days: { include: DAY_INCLUDE } } } },
        orderBy: { accessedAt: 'desc' },
      });
      const plans = accesses.map((a: (typeof accesses)[number]) => ({
        ...shapePlan(a.plan),
        userPermission: a.permission,
      }));
      return NextResponse.json({ plans });
    }

    const plans = await prisma.plan.findMany({
      where: { createdBy: userId },
      select: {
        id: true, title: true, description: true, destination: true, coverImage: true,
        status: true, startDate: true, endDate: true, createdBy: true, createdAt: true,
        updatedAt: true, isPublic: true, shareLink: true,
        wakeUpTime: true, sleepTime: true, pace: true, breakFrequency: true,
        breakDuration: true, travelBuffer: true, mealBreakfast: true, mealLunch: true,
        mealDinner: true, activityTypes: true, accessibility: true,
        dietaryRestrictions: true, interests: true,
        days: {
          select: {
            id: true, date: true, dayNumber: true, title: true, notes: true,
            // For list/card view: only the fields home-page renders (count + completion %).
            activities: {
              select: { id: true, status: true },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { dayNumber: 'asc' },
        },
      },
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
    if (typeof title !== 'string' || title.length > 200) {
      return NextResponse.json({ error: 'Title is invalid (max 200 chars)' }, { status: 400 });
    }
    if (typeof startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return NextResponse.json({ error: 'startDate must be in YYYY-MM-DD format' }, { status: 400 });
    }
    if (typeof endDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return NextResponse.json({ error: 'endDate must be in YYYY-MM-DD format' }, { status: 400 });
    }
    if (new Date(endDate) < new Date(startDate)) {
      return NextResponse.json({ error: 'endDate must be on or after startDate' }, { status: 400 });
    }
    if (description && typeof description === 'string' && description.length > 10000) {
      return NextResponse.json({ error: 'Description is too long (max 10000 chars)' }, { status: 400 });
    }

    const prefs = { ...DEFAULT_PREFERENCES, ...preferences };
    const dates = getDatesBetween(startDate, endDate);

    type IncomingActivity = {
      id?: string;
      title?: string;
      description?: string;
      type?: string;
      startTime?: string;
      duration?: number;
      status?: string;
      order?: number;
      priority?: string;
      location?: string;
      notes?: string;
      cost?: number;
      isBreak?: boolean;
      aiSuggested?: boolean;
    };
    type IncomingDay = {
      id?: string;
      date?: string;
      dayNumber?: number;
      title?: string;
      description?: string;
      notes?: string;
      activities?: IncomingActivity[];
    };

    const daysData = incomingDays?.length
      ? (incomingDays as IncomingDay[]).map((d: IncomingDay, i: number) => ({
          id: d.id || generateId(),
          date: d.date || dates[i] || startDate,
          dayNumber: d.dayNumber || i + 1,
          title: d.title,
          description: d.description,
          notes: d.notes,
          activities: {
            create: (d.activities || []).map((a: IncomingActivity, ai: number) => ({
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
      type ExistingDay = (typeof existing.days)[number];
      const existingByDate = new Map<string, ExistingDay>(
        existing.days.map((d: ExistingDay) => [d.date, d] as [string, ExistingDay]),
      );

      await prisma.$transaction(async (tx) => {
        // Delete days that no longer fall in range
        await tx.dayPlan.deleteMany({
          where: { planId: id, date: { notIn: dates } },
        });

        // Create or update day numbers for each date in range
        const existingDates = new Set(existing.days.map((d: ExistingDay) => d.date));
        for (let i = 0; i < dates.length; i++) {
          const date = dates[i];
          if (!existingDates.has(date)) {
            await tx.dayPlan.create({
              data: { id: generateId(), planId: id, date, dayNumber: i + 1 },
            });
          } else {
            const day = existingByDate.get(date)!;
            await tx.dayPlan.update({
              where: { id: day.id },
              data: { dayNumber: i + 1 },
            });
          }
        }
      });
      updates.startDate = newStart;
      updates.endDate = newEnd;
    }

    // Build flat update data (only allowed scalar fields)
    const data: Record<string, unknown> = {};
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

// PATCH — generate (or return existing) share link for a plan (backward compat)
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });

    const plan = await prisma.plan.findFirst({
      where: { id, createdBy: session.user.id },
    });
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    // Ensure a view ShareLink exists — use a consistent token
    const existingLink = await prisma.shareLink.findFirst({
      where: { planId: id, permission: 'view', isActive: true },
    });

    let token: string;
    if (existingLink) {
      token = existingLink.token;
    } else {
      token = generateShareToken();
      await prisma.$transaction([
        prisma.shareLink.create({
          data: { id: generateId(), planId: id, token, permission: 'view', isActive: true },
        }),
        prisma.plan.update({ where: { id }, data: { shareLink: token, isPublic: true } }),
      ]);
    }

    return NextResponse.json({ shareLink: token });
  } catch (error) {
    console.error('Error generating share link:', error);
    return NextResponse.json({ error: 'Failed to generate share link' }, { status: 500 });
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
