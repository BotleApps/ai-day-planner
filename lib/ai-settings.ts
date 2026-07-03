// AI Provider Settings — stored in localStorage (client-side only)

export type AIProvider = 'sap' | 'gemini';
export type AIBackend = 'openai' | 'bedrock' | 'vertex';

export interface AIModelOption {
  name: string;
  deploymentId: string;
  backend: AIBackend;
  scenario: string;
}

export interface AISettings {
  enabled: boolean;
  provider: AIProvider;
  // SAP AI Core OAuth credentials
  clientId: string;
  clientSecret: string;
  authUrl: string;       // UAA auth server URL
  apiUrl: string;        // AI_API_URL from service key
  resourceGroup: string; // usually 'default'
  // SAP selected model/deployment
  deploymentId: string;
  backend: AIBackend;
  modelName: string;
  // Google Gemini
  geminiApiKey: string;
  geminiModel: string;
  // Server-only flags (set from GET response — never sent to server)
  clientSecretConfigured?: boolean;
  clientSecretHint?: string | null;
  geminiApiKeyConfigured?: boolean;
  geminiApiKeyHint?: string | null;
}

const STORAGE_KEY = 'ai-day-planner:ai-settings';

export const DEFAULT_AI_SETTINGS: AISettings = {
  enabled: false,
  provider: 'sap',
  clientId: '',
  clientSecret: '',
  authUrl: '',
  apiUrl: '',
  resourceGroup: 'default',
  deploymentId: '',
  backend: 'openai',
  modelName: '',
  geminiApiKey: '',
  geminiModel: '',
};

export function loadAISettings(): AISettings {
  if (typeof window === 'undefined') return DEFAULT_AI_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AI_SETTINGS;
    return { ...DEFAULT_AI_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function saveAISettings(settings: AISettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function isAIConfigured(settings: AISettings): boolean {
  if (!settings.enabled) return false;
  if (settings.provider === 'gemini') {
    // Either a fresh key in clientSecret/geminiApiKey field, or a stored configured flag from the server
    const hasKey = !!settings.geminiApiKey || !!settings.geminiApiKeyConfigured;
    return hasKey && !!settings.geminiModel;
  }
  const hasSecret = !!settings.clientSecret || !!settings.clientSecretConfigured;
  return (
    !!settings.clientId &&
    hasSecret &&
    !!settings.authUrl &&
    !!settings.apiUrl &&
    !!settings.deploymentId
  );
}

/** Load AI settings from the server (synced across devices). Falls back to defaults on error. */
export async function loadAISettingsFromServer(): Promise<AISettings> {
  try {
    const res = await fetch('/api/user-settings');
    if (!res.ok) return DEFAULT_AI_SETTINGS;
    const data = await res.json();
    return { ...DEFAULT_AI_SETTINGS, ...data.settings };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

/** Persist AI settings to the server and update the localStorage cache.
 *  Empty clientSecret/geminiApiKey strings are NOT sent — they would erase
 *  server-stored secrets. Send only when the user types a fresh value.
 */
export async function saveAISettingsToServer(settings: AISettings): Promise<void> {
  // Strip empty secrets so the server keeps the existing encrypted value.
  // Strip server-only flags so they aren't accidentally interpreted as fields.
  const rest: Partial<AISettings> = { ...settings };
  delete rest.clientSecretConfigured;
  delete rest.clientSecretHint;
  delete rest.geminiApiKeyConfigured;
  delete rest.geminiApiKeyHint;
  const payload: Partial<AISettings> = rest;
  if (!payload.clientSecret) delete payload.clientSecret;
  if (!payload.geminiApiKey) delete payload.geminiApiKey;

  const res = await fetch('/api/user-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Settings save failed: ${res.status}`);
  }
  saveAISettings(settings); // update local cache only on success
}
