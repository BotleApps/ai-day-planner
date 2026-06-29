import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { auth } from '@/auth';
import { encrypt, decrypt } from '@/lib/crypto';
import { DEFAULT_AI_SETTINGS } from '@/lib/ai-settings';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const row = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
    });

    if (!row) {
      return NextResponse.json({ settings: DEFAULT_AI_SETTINGS });
    }

    const settings = {
      enabled: row.aiEnabled,
      provider: row.provider || 'sap',
      clientId: row.clientId,
      // Never return plaintext secrets — return configured flags and a display hint only
      clientSecretConfigured: !!row.clientSecretEnc,
      clientSecretHint: row.clientSecretEnc
        ? '••••' + decrypt(row.clientSecretEnc).slice(-4)
        : null,
      authUrl: row.authUrl,
      apiUrl: row.apiUrl,
      resourceGroup: row.resourceGroup,
      deploymentId: row.deploymentId,
      backend: row.backend,
      modelName: row.modelName,
      geminiApiKeyConfigured: !!row.geminiApiKeyEnc,
      geminiApiKeyHint: row.geminiApiKeyEnc
        ? '••••' + decrypt(row.geminiApiKeyEnc).slice(-4)
        : null,
      geminiModel: row.geminiModel,
    };

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error fetching user settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      enabled, provider,
      clientId, clientSecret, authUrl, apiUrl,
      resourceGroup, deploymentId, backend, modelName,
      geminiApiKey, geminiModel,
    } = body;

    // Look up existing row first so we can preserve encrypted secrets when the
    // client doesn't send a fresh value (the GET response masks them).
    const existing = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
    });

    // Only overwrite secrets when the client explicitly sent a non-empty value.
    // The client sends `undefined` (omitted) when the user hasn't typed a new secret.
    const clientSecretEnc =
      typeof clientSecret === 'string' && clientSecret.length > 0
        ? encrypt(clientSecret)
        : existing?.clientSecretEnc ?? '';
    const geminiApiKeyEnc =
      typeof geminiApiKey === 'string' && geminiApiKey.length > 0
        ? encrypt(geminiApiKey)
        : existing?.geminiApiKeyEnc ?? '';

    const data = {
      aiEnabled: !!enabled,
      provider: provider || 'sap',
      clientId: clientId ?? existing?.clientId ?? '',
      clientSecretEnc,
      authUrl: authUrl ?? existing?.authUrl ?? '',
      apiUrl: apiUrl ?? existing?.apiUrl ?? '',
      resourceGroup: resourceGroup || 'default',
      deploymentId: deploymentId ?? existing?.deploymentId ?? '',
      backend: backend || 'openai',
      modelName: modelName ?? existing?.modelName ?? '',
      geminiApiKeyEnc,
      geminiModel: geminiModel ?? existing?.geminiModel ?? '',
    };

    await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, ...data },
      update: data,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving user settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
