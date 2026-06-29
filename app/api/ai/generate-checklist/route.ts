import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { callAI } from '@/lib/ai-dispatch';
import { DEFAULT_AI_SETTINGS } from '@/lib/ai-settings';
import { rateLimit } from '@/lib/rate-limit';
import { AIChecklistGenerationResult } from '@/lib/types';

interface GenerateChecklistRequest {
  description: string;
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
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = rateLimit(`ai-gen-checklist:${session.user.id}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  let body: GenerateChecklistRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { description, planContext } = body;
  if (!description?.trim()) {
    return NextResponse.json({ error: 'description is required' }, { status: 400 });
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

  const contextNote = planContext?.title
    ? `\n\nContext: This checklist is for the plan "${planContext.title}"${planContext.destination ? ` in ${planContext.destination}` : ''}.`
    : '';

  try {
    const raw = await callAI(settings, SYSTEM_PROMPT + contextNote, description);
    const result = parseAIChecklistResponse(raw);
    if (!result) {
      return NextResponse.json({ error: 'Could not parse AI response. Please try again.' }, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error('AI checklist generation error:', err);
    return NextResponse.json({ error: 'AI generation failed. Please try again.' }, { status: 502 });
  }
}
