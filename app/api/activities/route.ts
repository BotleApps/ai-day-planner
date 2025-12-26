import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { Activity, DayPlan } from '@/lib/types';
import { generateId, sortByTime } from '@/lib/utils';

// GET activities for a day
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId');
    const dayId = searchParams.get('dayId');

    if (!planId || !dayId) {
      return NextResponse.json(
        { error: 'Plan ID and Day ID are required' }, 
        { status: 400 }
      );
    }

    const db = await getDatabase();
    const plan = await db.collection('plans').findOne({ _id: new ObjectId(planId) });

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const day = plan.days?.find((d: DayPlan) => d.id === dayId);
    if (!day) {
      return NextResponse.json({ error: 'Day not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      activities: sortByTime(day.activities || []) 
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
  }
}

// POST add activity to a day
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { planId, dayId, activity } = body;

    if (!planId || !dayId || !activity) {
      return NextResponse.json(
        { error: 'Plan ID, Day ID, and activity are required' }, 
        { status: 400 }
      );
    }

    const db = await getDatabase();

    // Add ID if not present
    const newActivity: Activity = {
      ...activity,
      id: activity.id || generateId(),
      status: activity.status || 'planned',
      order: activity.order ?? 0,
    };

    const result = await db.collection('plans').updateOne(
      { 
        _id: new ObjectId(planId),
        'days.id': dayId,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { 
        $push: { 'days.$.activities': newActivity },
        $set: { updatedAt: new Date() },
      } as any
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Plan or day not found' }, { status: 404 });
    }

    return NextResponse.json({ activity: newActivity });
  } catch (error) {
    console.error('Error adding activity:', error);
    return NextResponse.json({ error: 'Failed to add activity' }, { status: 500 });
  }
}

// PUT update activity
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { planId, dayId, activityId, updates } = body;

    if (!planId || !dayId || !activityId) {
      return NextResponse.json(
        { error: 'Plan ID, Day ID, and Activity ID are required' }, 
        { status: 400 }
      );
    }

    const db = await getDatabase();

    // Build update object for nested array
    const updateFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      updateFields[`days.$[day].activities.$[activity].${key}`] = value;
    }
    updateFields['updatedAt'] = new Date();

    const result = await db.collection('plans').updateOne(
      { _id: new ObjectId(planId) },
      { $set: updateFields },
      {
        arrayFilters: [
          { 'day.id': dayId },
          { 'activity.id': activityId },
        ],
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating activity:', error);
    return NextResponse.json({ error: 'Failed to update activity' }, { status: 500 });
  }
}

// DELETE activity
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId');
    const dayId = searchParams.get('dayId');
    const activityId = searchParams.get('activityId');

    if (!planId || !dayId || !activityId) {
      return NextResponse.json(
        { error: 'Plan ID, Day ID, and Activity ID are required' }, 
        { status: 400 }
      );
    }

    const db = await getDatabase();

    const result = await db.collection('plans').updateOne(
      { 
        _id: new ObjectId(planId),
        'days.id': dayId,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { 
        $pull: { 'days.$.activities': { id: activityId } },
        $set: { updatedAt: new Date() },
      } as any
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Plan or day not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting activity:', error);
    return NextResponse.json({ error: 'Failed to delete activity' }, { status: 500 });
  }
}

// PATCH - Bulk update activities (for reordering, replacing all)
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { planId, dayId, activities } = body;

    if (!planId || !dayId || !activities) {
      return NextResponse.json(
        { error: 'Plan ID, Day ID, and activities are required' }, 
        { status: 400 }
      );
    }

    const db = await getDatabase();

    // Update activities with proper order
    const orderedActivities = activities.map((a: Activity, index: number) => ({
      ...a,
      order: index,
    }));

    const result = await db.collection('plans').updateOne(
      { 
        _id: new ObjectId(planId),
        'days.id': dayId,
      },
      { 
        $set: { 
          'days.$.activities': sortByTime(orderedActivities),
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Plan or day not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating activities:', error);
    return NextResponse.json({ error: 'Failed to update activities' }, { status: 500 });
  }
}
