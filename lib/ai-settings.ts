// AI Provider Settings — stored in localStorage (client-side only)

export type AIBackend = 'openai' | 'bedrock' | 'vertex';

export interface AIModelOption {
  name: string;
  deploymentId: string;
  backend: AIBackend;
  scenario: string;
}

export interface AISettings {
  enabled: boolean;
  // SAP AI Core OAuth credentials
  clientId: string;
  clientSecret: string;
  authUrl: string;       // UAA auth server URL
  apiUrl: string;        // AI_API_URL from service key
  resourceGroup: string; // usually 'default'
  // Selected model/deployment
  deploymentId: string;
  backend: AIBackend;
  modelName: string;
}

const STORAGE_KEY = 'ai-day-planner:ai-settings';

export const DEFAULT_AI_SETTINGS: AISettings = {
  enabled: false,
  clientId: '',
  clientSecret: '',
  authUrl: '',
  apiUrl: '',
  resourceGroup: 'default',
  deploymentId: '',
  backend: 'openai',
  modelName: '',
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
  return (
    settings.enabled &&
    !!settings.clientId &&
    !!settings.clientSecret &&
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

/** Persist AI settings to the server and update the localStorage cache. */
export async function saveAISettingsToServer(settings: AISettings): Promise<void> {
  saveAISettings(settings); // update local cache immediately
  await fetch('/api/user-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
}
