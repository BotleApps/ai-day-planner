import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/lib/sap-ai-core';
import { AISettings } from '@/lib/ai-settings';
import { Activity, DayPlan } from '@/lib/types';

interface ParseRequest {
  text: string;
  settings: AISettings;
}

interface ParsedPlan {
  title: string;
  destination: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  description?: string;
  days: Array<{
    dayNumber: number;
    date: string;
    title?: string;
    activities: Array<Partial<Activity>>;
  }>;
}

const SYSTEM_PROMPT = `You are a travel itinerary parser. Extract structured plan data from raw itinerary text.

Return ONLY valid JSON with NO markdown, NO code fences, NO extra text.

Output format:
{
  "title": "Trip title",
  "destination": "Main destination country/city",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "description": "One sentence summary",
  "days": [
    {
      "dayNumber": 1,
      "date": "YYYY-MM-DD",
      "title": "Short day title",
      "activities": [
        {
          "title": "Activity name",
          "type": "activity|meal|travel|rest|entertainment|sightseeing|shopping|sports|wellness|social|work",
          "startTime": "HH:mm",
          "duration": 60,
          "description": "Brief description",
          "location": "Location name"
        }
      ]
    }
  ]
}

Rules:
- If no year is mentioned, use the current year (2026).
- Infer reasonable startTimes from context (morning activities ~09:00, lunch ~13:00, dinner ~19:00, travel ~07:00 etc).
- Duration in minutes. Typical: meal=60, sightseeing=90-120, travel=60-180, rest=30-60.
- Only include activities explicitly mentioned or clearly implied. Do not invent activities.
- Map activity types: airport/flight/bus/transfer → "travel", restaurant/lunch/dinner/breakfast → "meal", museum/temple/landmark → "sightseeing", hotel/check-in/rest → "rest", market/shopping → "shopping", show/concert → "entertainment".
- Preserve the original day structure from the itinerary.`;

function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function normaliseDays(rawDays: ParsedPlan['days']): DayPlan[] {
  return rawDays.map(d => {
    let cursor = '09:00';
    const activities: Activity[] = d.activities.map((a, i) => {
      const startTime = a.startTime || cursor;
      const duration = a.duration || 60;
      cursor = addMinutes(startTime, duration);
      return {
        id: generateId(),
        title: a.title || 'Activity',
        type: a.type || 'activity',
        startTime,
        duration,
        description: a.description,
        location: a.location,
        status: 'planned',
        order: i,
        aiSuggested: true,
      };
    });
    return {
      id: generateId(),
      date: d.date,
      dayNumber: d.dayNumber,
      title: d.title,
      activities,
    };
  });
}

function parseAIJson(raw: string): ParsedPlan {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

export async function POST(req: NextRequest) {
  let body: ParseRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { text, settings } = body;

  if (!text?.trim()) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }
  if (!settings?.clientId || !settings?.deploymentId) {
    return NextResponse.json({ error: 'SAP AI Core is not configured' }, { status: 400 });
  }

  try {
    const raw = await chat(settings, SYSTEM_PROMPT, text.slice(0, 12000), 8000); // cap input at 12k chars, allow 8k output tokens
    const parsed = parseAIJson(raw);

    // Normalise days into full Activity objects
    const days = normaliseDays(parsed.days || []);

    return NextResponse.json({
      title: parsed.title || 'Imported Plan',
      destination: parsed.destination || '',
      startDate: parsed.startDate || days[0]?.date || new Date().toISOString().slice(0, 10),
      endDate: parsed.endDate || days[days.length - 1]?.date || new Date().toISOString().slice(0, 10),
      description: parsed.description || '',
      days,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('parse-itinerary error:', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
