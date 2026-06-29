import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { discoverModels } from '@/lib/sap-ai-core';
import { DEFAULT_AI_SETTINGS } from '@/lib/ai-settings';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = rateLimit(`ai-models:${session.user.id}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  // Ignore any credentials in the body — always load from DB
  try { await req.json(); } catch { /* ignore */ }

  const row = await prisma.userSettings.findUnique({ where: { userId: session.user.id } });
  if (!row?.clientId || !row?.authUrl || !row?.apiUrl) {
    return NextResponse.json({ error: 'SAP AI Core is not configured' }, { status: 400 });
  }

  const settings = {
    ...DEFAULT_AI_SETTINGS,
    provider: 'sap' as const,
    clientId: row.clientId,
    clientSecret: decrypt(row.clientSecretEnc),
    authUrl: row.authUrl,
    apiUrl: row.apiUrl,
    resourceGroup: row.resourceGroup,
    deploymentId: row.deploymentId,
    backend: row.backend as 'openai' | 'bedrock' | 'vertex',
    modelName: row.modelName,
  };

  try {
    const models = await discoverModels(settings);
    return NextResponse.json({ models });
  } catch (err) {
    console.error('AI model discovery error:', err);
    const isAuth = err instanceof Error && /401|403|auth/i.test(err.message);
    return NextResponse.json(
      { error: isAuth ? 'Authentication with SAP AI Core failed. Check your credentials.' : 'Failed to discover models.' },
      { status: 502 },
    );
  }
}
