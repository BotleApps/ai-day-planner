import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { Plan, DayPlan, DEFAULT_PREFERENCES } from '@/lib/types';
import { generateId, getDatesBetween } from '@/lib/utils';
import { auth } from '@/auth';

// GET all plans or single plan by ID
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('id');
    const shareLink = searchParams.get('share');

    const db = await getDatabase();

    // Public share link — no auth required
    if (shareLink) {
      const plan = await db.collection('plans').findOne({ 'sharing.shareLink': shareLink });
      if (!plan) {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
      }
      return NextResponse.json({ plan });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    if (planId) {
      const plan = await db.collection('plans').findOne({
        _id: new ObjectId(planId),
        createdBy: userId,
      });
      if (!plan) {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
      }
      return NextResponse.json({ plan });
    }

    const plans = await db.collection('plans')
      .find({ createdBy: userId })
      .sort({ updatedAt: -1 })
      .toArray();

    return NextResponse.json({ plans });
  } catch (error) {
    console.error('Error fetching plans:', error);
    return NextResponse.json({ error: 'Failed to fetch plans', plans: [] }, { status: 500 });
  }
}

// POST create new plan
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      description,
      destination,
      startDate,
      endDate,
      preferences,
      coverImage,
      days: incomingDays,
    } = body;

    if (!title || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Title, start date, and end date are required' },
        { status: 400 }
      );
    }

    const db = await getDatabase();

    const dates = getDatesBetween(startDate, endDate);
    const days: DayPlan[] = incomingDays?.length
      ? incomingDays.map((d: DayPlan, i: number) => ({
          ...d,
          id: d.id || generateId(),
          date: d.date || dates[i] || startDate,
          dayNumber: d.dayNumber || i + 1,
          activities: (d.activities || []).map((a, ai) => ({
            ...a,
            id: a.id || generateId(),
            order: a.order ?? ai,
            status: a.status || 'planned',
          })),
        }))
      : dates.map((date, index) => ({
          id: generateId(),
          date,
          dayNumber: index + 1,
          activities: [],
        }));

    const plan: Omit<Plan, '_id'> = {
      id: generateId(),
      title,
      description: description || '',
      destination: destination || '',
      coverImage: coverImage || '',
      status: 'draft',
      startDate,
      endDate,
      days,
      preferences: preferences || DEFAULT_PREFERENCES,
      sharing: {
        isPublic: false,
        sharedWith: [],
      },
      createdBy: session.user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('plans').insertOne(plan);

    return NextResponse.json({
      plan: { ...plan, _id: result.insertedId },
    });
  } catch (error) {
    console.error('Error creating plan:', error);
    return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 });
  }
}

// PUT update plan
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    const db = await getDatabase();

    if (updates.startDate || updates.endDate) {
      const existingPlan = await db.collection('plans').findOne({
        _id: new ObjectId(id),
        createdBy: session.user.id,
      });
      if (!existingPlan) {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
      }

      const newStartDate = updates.startDate || existingPlan.startDate;
      const newEndDate = updates.endDate || existingPlan.endDate;

      if (newStartDate !== existingPlan.startDate || newEndDate !== existingPlan.endDate) {
        const dates = getDatesBetween(newStartDate, newEndDate);
        const newDays: DayPlan[] = dates.map((date, index) => {
          const existingDay = existingPlan.days?.find((d: DayPlan) => d.date === date);
          return existingDay || {
            id: generateId(),
            date,
            dayNumber: index + 1,
            activities: [],
          };
        });
        updates.days = newDays;
      }
    }

    updates.updatedAt = new Date();

    const result = await db.collection('plans').updateOne(
      { _id: new ObjectId(id), createdBy: session.user.id },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating plan:', error);
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 });
  }
}

// DELETE plan
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    const db = await getDatabase();

    const result = await db.collection('plans').deleteOne({
      _id: new ObjectId(id),
      createdBy: session.user.id,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting plan:', error);
    return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 });
  }
}
