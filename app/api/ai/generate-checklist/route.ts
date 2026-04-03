import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/lib/sap-ai-core';
import { AISettings } from '@/lib/ai-settings';
import { AIChecklistGenerationResult } from '@/lib/types';

interface GenerateChecklistRequest {
  description: string;
  settings: AISettings;
  planContext?: { title?: string; destination?: string };
}

const SYSTEM_PROMPT = `You are a helpful planning assistant. The user will describe an occasion, event, or task, and you will generate a comprehensive, organized checklist.

Respond ONLY with valid JSON in exactly this format (no markdown, no extra text):
{
  "title": "A concise checklist title based on the description (3-7 words)",
  "groups": [
    {
      "groupName": "Category name (1-3 words)",
      "items": ["Specific item 1", "Specific item 2", "Specific item 3"]
    }
  ]
}

Rules:
- Generate 3–6 groups with 3–8 items each
- Items must be specific and actionable (not vague like "prepare things")
- Group names should be short (1–3 words)
- Title should be concise (3–7 words)
- Tailor items to the specific occasion described
- Do not add items that are obviously irrelevant`;

function parseAIChecklistResponse(raw: string): AIChecklistGenerationResult | null {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.title && Array.isArray(parsed.groups)) {
      return parsed as AIChecklistGenerationResult;
    }
    // Fallback: flat items array
    if (Array.isArray(parsed.items)) {
      return {
        title: parsed.title || 'Checklist',
        groups: [{ groupName: 'Tasks', items: parsed.items }],
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: GenerateChecklistRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { description, settings, planContext } = body;

  if (!description || !settings) {
    return NextResponse.json({ error: 'description and settings are required' }, { status: 400 });
  }

  if (!settings.clientId || !settings.clientSecret || !settings.authUrl || !settings.apiUrl || !settings.deploymentId) {
    return NextResponse.json({ error: 'SAP AI Core is not fully configured' }, { status: 400 });
  }

  const contextNote = planContext?.title
    ? `\n\nContext: This checklist is for the plan "${planContext.title}"${planContext.destination ? ` in ${planContext.destination}` : ''}.`
    : '';

  try {
    const raw = await chat(settings, SYSTEM_PROMPT + contextNote, description);
    const result = parseAIChecklistResponse(raw);
    if (!result) {
      return NextResponse.json({ error: 'Could not parse AI response. Please try again.' }, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('AI checklist generation error:', message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
