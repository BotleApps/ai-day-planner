import { NextRequest, NextResponse } from 'next/server';
import { listGeminiModels } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  let body: { apiKey: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { apiKey } = body;
  if (!apiKey?.trim()) {
    return NextResponse.json({ error: 'apiKey is required' }, { status: 400 });
  }

  try {
    const models = await listGeminiModels(apiKey);
    return NextResponse.json({ models });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Gemini model list error:', message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
