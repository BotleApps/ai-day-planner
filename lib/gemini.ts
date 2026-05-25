// Google Gemini API client — server-side only

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export interface GeminiModel {
  name: string;        // e.g. "gemini-2.0-flash"
  displayName: string; // e.g. "Gemini 2.0 Flash"
  description?: string;
}

/** Fetch available Gemini models for a given API key. Returns latest 10 text-generation models. */
export async function listGeminiModels(apiKey: string): Promise<GeminiModel[]> {
  const resp = await fetch(`${GEMINI_BASE}/models?key=${apiKey}`, {
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Gemini model list failed (${resp.status}): ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  const models: GeminiModel[] = [];

  for (const m of data.models || []) {
    const id: string = (m.name as string || '').replace('models/', '');
    const displayName: string = m.displayName || id;

    // Skip embedding, AQA, and vision-only models
    if (!id.startsWith('gemini')) continue;
    if (id.includes('embedding') || id.includes('aqa')) continue;
    if (!(m.supportedGenerationMethods || []).includes('generateContent')) continue;

    models.push({ name: id, displayName, description: m.description });
  }

  // Sort: latest version numbers first, then alphabetically
  models.sort((a, b) => {
    // Extract version numbers for comparison (e.g., 2.5 > 2.0 > 1.5)
    const verA = parseFloat(a.name.replace('gemini-', '').match(/^[\d.]+/)?.[0] || '0');
    const verB = parseFloat(b.name.replace('gemini-', '').match(/^[\d.]+/)?.[0] || '0');
    if (verB !== verA) return verB - verA;
    return a.displayName.localeCompare(b.displayName);
  });

  return models.slice(0, 10);
}

/** Call Gemini generateContent endpoint. */
export async function geminiChat(
  apiKey: string,
  modelName: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens = 4000,
): Promise<string> {
  const url = `${GEMINI_BASE}/models/${modelName}:generateContent?key=${apiKey}`;

  const payload = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      { role: 'user', parts: [{ text: userMessage }] },
    ],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.7,
    },
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120000),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Gemini chat failed (${resp.status}): ${text.slice(0, 300)}`);
  }

  const data = await resp.json();
  return (data.candidates?.[0]?.content?.parts || [])
    .map((p: { text?: string }) => p.text || '')
    .join('');
}
