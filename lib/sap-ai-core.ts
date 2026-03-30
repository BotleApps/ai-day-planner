// SAP AI Core client — server-side only (never import in client components)
// Handles OAuth token caching + all three backends: OpenAI, Bedrock, Vertex

import { AISettings, AIBackend } from './ai-settings';

// Per-request token cache (process-level, reused across serverless warm instances)
const tokenCache = new Map<string, { token: string; expiry: number }>();

function cacheKey(settings: AISettings): string {
  return `${settings.authUrl}::${settings.clientId}`;
}

async function getToken(settings: AISettings): Promise<string> {
  const key = cacheKey(settings);
  const cached = tokenCache.get(key);
  if (cached && Date.now() / 1000 < cached.expiry - 60) {
    return cached.token;
  }

  const basic = Buffer.from(`${settings.clientId}:${settings.clientSecret}`).toString('base64');
  const authUrl = settings.authUrl.replace(/\/$/, '');

  const resp = await fetch(`${authUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`SAP AI Core auth failed (${resp.status}): ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  const token: string = data.access_token;
  const expiry = Date.now() / 1000 + (data.expires_in || 3600);
  tokenCache.set(key, { token, expiry });
  return token;
}

function aiHeaders(token: string, resourceGroup: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'AI-Resource-Group': resourceGroup || 'default',
    'Content-Type': 'application/json',
  };
}

export interface DiscoveredModel {
  name: string;
  deploymentId: string;
  backend: AIBackend;
  scenario: string;
}

export async function discoverModels(settings: AISettings): Promise<DiscoveredModel[]> {
  const token = await getToken(settings);
  const apiUrl = settings.apiUrl.replace(/\/$/, '');

  const resp = await fetch(`${apiUrl}/v2/lm/deployments?status=RUNNING`, {
    headers: aiHeaders(token, settings.resourceGroup),
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Failed to list deployments (${resp.status}): ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  const models: DiscoveredModel[] = [];

  for (const d of data.resources || []) {
    const deploymentId: string = d.id || '';
    const scenario: string = (d.scenarioId || '').toLowerCase();
    const details = d.details || {};

    const name: string =
      details.resources?.backend_details?.model?.name ||
      details.scaling?.backend_details?.model?.name ||
      '';

    if (!name || name.includes('embed') || name.includes('rerank')) continue;

    let backend: AIBackend;
    if (scenario.includes('azure') || scenario.includes('openai')) {
      backend = 'openai';
    } else if (scenario.includes('aws') || scenario.includes('bedrock')) {
      backend = 'bedrock';
    } else if (scenario.includes('gcp') || scenario.includes('vertex')) {
      backend = 'vertex';
    } else {
      const lower = name.toLowerCase();
      if (/claude|anthropic|titan|llama|mistral/.test(lower)) backend = 'bedrock';
      else if (/gemini/.test(lower)) backend = 'vertex';
      else backend = 'openai';
    }

    models.push({ name, deploymentId, backend, scenario });
  }

  return models;
}

export async function chat(
  settings: AISettings,
  systemPrompt: string,
  userMessage: string,
  maxTokens = 4000,
): Promise<string> {
  const token = await getToken(settings);
  const apiUrl = settings.apiUrl.replace(/\/$/, '');
  const base = `${apiUrl}/v2/inference/deployments/${settings.deploymentId}`;
  const headers = aiHeaders(token, settings.resourceGroup);

  let url: string;
  let payload: unknown;

  switch (settings.backend) {
    case 'openai':
      url = `${base}/chat/completions`;
      payload = {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
      };
      break;

    case 'bedrock':
      url = `${base}/converse`;
      payload = {
        messages: [{ role: 'user', content: [{ text: userMessage }] }],
        system: [{ text: systemPrompt }],
        inferenceConfig: { maxTokens, temperature: 0.7 },
      };
      break;

    case 'vertex':
      url = `${base}/models/${settings.modelName}:generateContent`;
      payload = {
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userMessage}` }] },
        ],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
      };
      break;

    default:
      throw new Error(`Unknown backend: ${settings.backend}`);
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120000),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`SAP AI Core chat failed (${resp.status}): ${text.slice(0, 300)}`);
  }

  const data = await resp.json();

  switch (settings.backend) {
    case 'openai':
      return data.choices?.[0]?.message?.content || '';

    case 'bedrock':
      return (data.output?.message?.content || [])
        .map((b: { text?: string }) => b.text || '')
        .join('');

    case 'vertex':
      return (data.candidates?.[0]?.content?.parts || [])
        .map((p: { text?: string }) => p.text || '')
        .join('');

    default:
      return '';
  }
}
