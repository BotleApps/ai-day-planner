import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { listGeminiModels } from '@/lib/gemini';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = rateLimit(`gemini-models:${session.user.id}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  // Ignore any credentials in the body — always load from DB
  try { await req.json(); } catch { /* ignore */ }

  const row = await prisma.userSettings.findUnique({ where: { userId: session.user.id } });
  if (!row?.geminiApiKeyEnc) {
    return NextResponse.json({ error: 'Gemini API key is not configured' }, { status: 400 });
  }

  const apiKey = decrypt(row.geminiApiKeyEnc);
  if (!apiKey) {
    return NextResponse.json({ error: 'Gemini API key is not configured' }, { status: 400 });
  }

  try {
    const models = await listGeminiModels(apiKey);
    return NextResponse.json({ models });
  } catch (err) {
    console.error('Gemini model list error:', err);
    const isAuth = err instanceof Error && /401|403|API key/i.test(err.message);
    return NextResponse.json(
      { error: isAuth ? 'Authentication with Gemini failed. Check your API key.' : 'Failed to fetch Gemini models.' },
      { status: 502 },
    );
  }
}
