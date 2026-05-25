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
      clientSecret: decrypt(row.clientSecretEnc),
      authUrl: row.authUrl,
      apiUrl: row.apiUrl,
      resourceGroup: row.resourceGroup,
      deploymentId: row.deploymentId,
      backend: row.backend,
      modelName: row.modelName,
      geminiApiKey: decrypt(row.geminiApiKeyEnc),
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

    const data = {
      aiEnabled: !!enabled,
      provider: provider || 'sap',
      clientId: clientId || '',
      clientSecretEnc: clientSecret ? encrypt(clientSecret) : '',
      authUrl: authUrl || '',
      apiUrl: apiUrl || '',
      resourceGroup: resourceGroup || 'default',
      deploymentId: deploymentId || '',
      backend: backend || 'openai',
      modelName: modelName || '',
      geminiApiKeyEnc: geminiApiKey ? encrypt(geminiApiKey) : '',
      geminiModel: geminiModel || '',
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
