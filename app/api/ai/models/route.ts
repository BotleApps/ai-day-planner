import { NextRequest, NextResponse } from 'next/server';
import { discoverModels } from '@/lib/sap-ai-core';
import { AISettings } from '@/lib/ai-settings';

export async function POST(req: NextRequest) {
  let settings: Partial<AISettings>;
  try {
    settings = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!settings.clientId || !settings.clientSecret || !settings.authUrl || !settings.apiUrl) {
    return NextResponse.json(
      { error: 'clientId, clientSecret, authUrl, and apiUrl are required' },
      { status: 400 },
    );
  }

  try {
    const models = await discoverModels(settings as AISettings);
    return NextResponse.json({ models });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('SAP AI Core model discovery error:', message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
