import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/lib/sap-ai-core';
import { geminiChat } from '@/lib/gemini';
import { AISettings } from '@/lib/ai-settings';
import { Activity, PlanPreferences } from '@/lib/types';

interface ChatRequest {
  message: string;
  settings: AISettings;
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

async function runChat(settings: AISettings, systemPrompt: string, userMessage: string): Promise<string> {
  if (settings.provider === 'gemini') {
    if (!settings.geminiApiKey || !settings.geminiModel) {
      throw new Error('Gemini API key and model are required');
    }
    return geminiChat(settings.geminiApiKey, settings.geminiModel, systemPrompt, userMessage);
  }
  return chat(settings, systemPrompt, userMessage);
}

export async function POST(req: NextRequest) {
  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { message, settings, context } = body;

  if (!message || !settings) {
    return NextResponse.json({ error: 'message and settings are required' }, { status: 400 });
  }

  if (settings.provider === 'gemini') {
    if (!settings.geminiApiKey || !settings.geminiModel) {
      return NextResponse.json({ error: 'Gemini API key and model are required' }, { status: 400 });
    }
  } else {
    if (!settings.clientId || !settings.clientSecret || !settings.authUrl || !settings.apiUrl || !settings.deploymentId) {
      return NextResponse.json({ error: 'SAP AI Core is not fully configured' }, { status: 400 });
    }
  }

  try {
    const systemPrompt = buildSystemPrompt(context || {});
    const raw = await runChat(settings, systemPrompt, message);
    const result = parseAIResponse(raw);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('AI chat error:', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
