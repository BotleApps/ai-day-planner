import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { callAI } from '@/lib/ai-dispatch';
import { DEFAULT_AI_SETTINGS } from '@/lib/ai-settings';
import { rateLimit } from '@/lib/rate-limit';
import { Activity, PlanPreferences } from '@/lib/types';

interface ChatRequest {
  message: string;
  context: {
    destination?: string;
    date?: string;
    preferences?: PlanPreferences;
    activities?: Activity[];
  };
}

function buildSystemPrompt(context: ChatRequest['context']): string {
  const { destination, date, preferences, activities = [] } = context;

  const activitySummary = activities.length > 0
    ? activities
        .map(a => `  - ${a.startTime} ${a.title} (${a.duration}min, ${a.type})`)
        .join('\n')
    : '  (none yet)';

  return `You are an AI day planner assistant helping the user plan activities for a day trip.

Context:
- Destination: ${destination || 'not specified'}
- Date: ${date || 'today'}
- Wake up: ${preferences?.wakeUpTime || '08:00'}, Sleep by: ${preferences?.sleepTime || '22:00'}
- Pace: ${preferences?.pace || 'moderate'}
- Meal times: breakfast ${preferences?.mealTimes?.breakfast || '08:30'}, lunch ${preferences?.mealTimes?.lunch || '13:00'}, dinner ${preferences?.mealTimes?.dinner || '19:30'}
- Current activities:
${activitySummary}

Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{
  "message": "A friendly, helpful explanation of your suggestions (1-2 sentences)",
  "suggestions": [
    {
      "title": "Activity name",
      "type": "activity|meal|travel|rest|entertainment|sightseeing|shopping|sports|wellness|social|work",
      "startTime": "HH:mm",
      "duration": 60,
      "description": "Brief description",
      "location": "Optional location name"
    }
  ]
}

Only include "startTime" when it makes sense contextually. Duration is in minutes. Keep suggestions realistic and context-aware.`;
}

function parseAIResponse(raw: string): { message: string; suggestions: Partial<Activity>[] } {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      message: parsed.message || 'Here are some suggestions for your day:',
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    };
  } catch {
    return { message: raw.slice(0, 500), suggestions: [] };
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = rateLimit(`ai-chat:${session.user.id}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { message, context } = body;
  if (!message) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  const row = await prisma.userSettings.findUnique({ where: { userId: session.user.id } });
  if (!row?.aiEnabled) {
    return NextResponse.json({ error: 'AI is not configured. Go to Settings → Intelligence to set up your AI provider.' }, { status: 400 });
  }

  const settings = {
    ...DEFAULT_AI_SETTINGS,
    enabled: row.aiEnabled,
    provider: row.provider as 'sap' | 'gemini',
    clientId: row.clientId,
    clientSecret: decrypt(row.clientSecretEnc),
    authUrl: row.authUrl,
    apiUrl: row.apiUrl,
    resourceGroup: row.resourceGroup,
    deploymentId: row.deploymentId,
    backend: row.backend as 'openai' | 'bedrock' | 'vertex',
    modelName: row.modelName,
    geminiApiKey: decrypt(row.geminiApiKeyEnc),
    geminiModel: row.geminiModel,
  };

  try {
    const systemPrompt = buildSystemPrompt(context || {});
    const raw = await callAI(settings, systemPrompt, message);
    const result = parseAIResponse(raw);
    return NextResponse.json(result);
  } catch (err) {
    console.error('AI chat error:', err);
    return NextResponse.json({ error: 'AI provider request failed' }, { status: 502 });
  }
}
