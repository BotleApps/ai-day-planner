import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isAIConfigured,
  DEFAULT_AI_SETTINGS,
  loadAISettings,
  saveAISettings,
  loadAISettingsFromServer,
  saveAISettingsToServer,
  type AISettings,
} from '../lib/ai-settings';

describe('lib/ai-settings isAIConfigured', () => {
  it('returns false when AI is disabled', () => {
    const s: AISettings = { ...DEFAULT_AI_SETTINGS, enabled: false };
    expect(isAIConfigured(s)).toBe(false);
  });

  it('SAP: returns false without a clientId', () => {
    const s: AISettings = {
      ...DEFAULT_AI_SETTINGS,
      enabled: true,
      provider: 'sap',
      clientSecret: 'fresh-secret',
      authUrl: 'https://auth',
      apiUrl: 'https://api',
      deploymentId: 'dep',
    };
    expect(isAIConfigured(s)).toBe(false);
  });

  it('SAP: returns true with fresh clientSecret', () => {
    const s: AISettings = {
      ...DEFAULT_AI_SETTINGS,
      enabled: true,
      provider: 'sap',
      clientId: 'cid',
      clientSecret: 'fresh',
      authUrl: 'https://auth',
      apiUrl: 'https://api',
      deploymentId: 'dep',
    };
    expect(isAIConfigured(s)).toBe(true);
  });

  it('SAP: returns true with server-side clientSecretConfigured flag (after reload)', () => {
    const s: AISettings = {
      ...DEFAULT_AI_SETTINGS,
      enabled: true,
      provider: 'sap',
      clientId: 'cid',
      clientSecret: '',                  // not in client (server masked it)
      clientSecretConfigured: true,      // but server has it stored
      authUrl: 'https://auth',
      apiUrl: 'https://api',
      deploymentId: 'dep',
    };
    expect(isAIConfigured(s)).toBe(true);
  });

  it('SAP: returns false when neither secret nor configured flag is present', () => {
    const s: AISettings = {
      ...DEFAULT_AI_SETTINGS,
      enabled: true,
      provider: 'sap',
      clientId: 'cid',
      authUrl: 'https://auth',
      apiUrl: 'https://api',
      deploymentId: 'dep',
    };
    expect(isAIConfigured(s)).toBe(false);
  });

  it('Gemini: returns false without an API key', () => {
    const s: AISettings = {
      ...DEFAULT_AI_SETTINGS,
      enabled: true,
      provider: 'gemini',
      geminiModel: 'gemini-2.0-flash',
    };
    expect(isAIConfigured(s)).toBe(false);
  });

  it('Gemini: returns true with fresh API key', () => {
    const s: AISettings = {
      ...DEFAULT_AI_SETTINGS,
      enabled: true,
      provider: 'gemini',
      geminiApiKey: 'AIza...',
      geminiModel: 'gemini-2.0-flash',
    };
    expect(isAIConfigured(s)).toBe(true);
  });

  it('Gemini: returns true with server-side geminiApiKeyConfigured flag', () => {
    const s: AISettings = {
      ...DEFAULT_AI_SETTINGS,
      enabled: true,
      provider: 'gemini',
      geminiApiKey: '',
      geminiApiKeyConfigured: true,
      geminiModel: 'gemini-2.0-flash',
    };
    expect(isAIConfigured(s)).toBe(true);
  });

  it('Gemini: returns false when model is missing even if key configured', () => {
    const s: AISettings = {
      ...DEFAULT_AI_SETTINGS,
      enabled: true,
      provider: 'gemini',
      geminiApiKeyConfigured: true,
      geminiModel: '',
    };
    expect(isAIConfigured(s)).toBe(false);
  });
});

// ─── localStorage round-trip ───────────────────────────────────────────────

/**
 * Minimal in-memory localStorage stub. Node has no `window` so these tests
 * install one for the duration of each case, then tear it down.
 */
function stubBrowser(): void {
  const store = new Map<string, string>();
  (globalThis as unknown as { window: unknown }).window = { localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
  } };
  (globalThis as unknown as { localStorage: unknown }).localStorage =
    (globalThis as unknown as { window: { localStorage: unknown } }).window.localStorage;
}

function unstubBrowser(): void {
  delete (globalThis as unknown as { window?: unknown }).window;
  delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
}

describe('lib/ai-settings loadAISettings / saveAISettings (localStorage)', () => {
  afterEach(() => {
    unstubBrowser();
  });

  it('returns DEFAULT_AI_SETTINGS when window is undefined (SSR)', () => {
    // No window installed — this simulates the Next.js server render path.
    expect(loadAISettings()).toEqual(DEFAULT_AI_SETTINGS);
  });

  it('returns DEFAULT_AI_SETTINGS when localStorage is empty', () => {
    stubBrowser();
    expect(loadAISettings()).toEqual(DEFAULT_AI_SETTINGS);
  });

  it('round-trips saved settings via localStorage', () => {
    stubBrowser();
    const s: AISettings = {
      ...DEFAULT_AI_SETTINGS,
      enabled: true,
      provider: 'gemini',
      geminiApiKey: 'AIza-key',
      geminiModel: 'gemini-2.0-flash',
    };
    saveAISettings(s);
    expect(loadAISettings()).toEqual(s);
  });

  it('merges partial storage over DEFAULT_AI_SETTINGS (missing fields filled)', () => {
    stubBrowser();
    (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(
      'ai-day-planner:ai-settings',
      JSON.stringify({ enabled: true, provider: 'gemini' }),
    );
    const loaded = loadAISettings();
    expect(loaded.enabled).toBe(true);
    expect(loaded.provider).toBe('gemini');
    // Fields absent from storage fall back to defaults.
    expect(loaded.geminiApiKey).toBe(DEFAULT_AI_SETTINGS.geminiApiKey);
    expect(loaded.resourceGroup).toBe(DEFAULT_AI_SETTINGS.resourceGroup);
  });

  it('returns DEFAULT_AI_SETTINGS when stored JSON is corrupt (catches SyntaxError)', () => {
    stubBrowser();
    (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(
      'ai-day-planner:ai-settings',
      '{ not valid json',
    );
    expect(loadAISettings()).toEqual(DEFAULT_AI_SETTINGS);
  });
});

// ─── server round-trip (fetch mocking) ─────────────────────────────────────

describe('lib/ai-settings loadAISettingsFromServer', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('merges the server response with DEFAULT_AI_SETTINGS (defaults filled)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        settings: {
          enabled: true,
          provider: 'gemini',
          geminiApiKeyConfigured: true,
          geminiModel: 'gemini-2.0-flash',
        },
      }),
    } as unknown as Response) as typeof fetch;

    const loaded = await loadAISettingsFromServer();
    expect(loaded.enabled).toBe(true);
    expect(loaded.provider).toBe('gemini');
    expect(loaded.geminiApiKeyConfigured).toBe(true);
    // Fields not returned by the server default to DEFAULT_AI_SETTINGS.
    expect(loaded.clientSecret).toBe('');
    expect(loaded.resourceGroup).toBe('default');
  });

  it('returns DEFAULT_AI_SETTINGS on 401 without throwing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    } as unknown as Response) as typeof fetch;

    const loaded = await loadAISettingsFromServer();
    expect(loaded).toEqual(DEFAULT_AI_SETTINGS);
  });

  it('returns DEFAULT_AI_SETTINGS on network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down')) as typeof fetch;
    const loaded = await loadAISettingsFromServer();
    expect(loaded).toEqual(DEFAULT_AI_SETTINGS);
  });
});

describe('lib/ai-settings saveAISettingsToServer', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    stubBrowser();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    unstubBrowser();
  });

  it('strips empty clientSecret so the server preserves its stored value', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({}),
    } as unknown as Response);
    globalThis.fetch = fetchMock as typeof fetch;

    const settings: AISettings = {
      ...DEFAULT_AI_SETTINGS,
      enabled: true,
      provider: 'sap',
      clientId: 'cid',
      clientSecret: '',                  // empty — must not be sent
      clientSecretConfigured: true,
      authUrl: 'https://auth',
      apiUrl: 'https://api',
      deploymentId: 'dep',
    };
    await saveAISettingsToServer(settings);

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).not.toHaveProperty('clientSecret');
    // Server-only flags must NEVER be posted back — they aren't fields.
    expect(body).not.toHaveProperty('clientSecretConfigured');
    expect(body).not.toHaveProperty('clientSecretHint');
    expect(body).not.toHaveProperty('geminiApiKeyConfigured');
    expect(body).not.toHaveProperty('geminiApiKeyHint');
  });

  it('sends clientSecret when the user typed a fresh value', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({}),
    } as unknown as Response);
    globalThis.fetch = fetchMock as typeof fetch;

    const settings: AISettings = {
      ...DEFAULT_AI_SETTINGS,
      enabled: true,
      provider: 'sap',
      clientId: 'cid',
      clientSecret: 'brand-new-secret',
      authUrl: 'https://auth',
      apiUrl: 'https://api',
      deploymentId: 'dep',
    };
    await saveAISettingsToServer(settings);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.clientSecret).toBe('brand-new-secret');
  });

  it('strips empty geminiApiKey but sends a fresh one', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({}),
    } as unknown as Response);
    globalThis.fetch = fetchMock as typeof fetch;

    // Empty geminiApiKey → not sent.
    await saveAISettingsToServer({
      ...DEFAULT_AI_SETTINGS,
      provider: 'gemini',
      geminiApiKey: '',
      geminiApiKeyConfigured: true,
    });
    let body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).not.toHaveProperty('geminiApiKey');

    fetchMock.mockClear();

    // Fresh geminiApiKey → sent as-is.
    await saveAISettingsToServer({
      ...DEFAULT_AI_SETTINGS,
      provider: 'gemini',
      geminiApiKey: 'AIza-fresh',
    });
    body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.geminiApiKey).toBe('AIza-fresh');
  });

  it('throws with the server error message when the response is not ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'DB write failed' }),
    } as unknown as Response) as typeof fetch;

    await expect(saveAISettingsToServer(DEFAULT_AI_SETTINGS)).rejects.toThrow('DB write failed');
  });

  it('throws with a generic message when the error body is missing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => { throw new Error('no body'); },
    } as unknown as Response) as typeof fetch;

    await expect(saveAISettingsToServer(DEFAULT_AI_SETTINGS)).rejects.toThrow('502');
  });

  it('updates the localStorage cache only when the server call succeeds', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({}),
    } as unknown as Response);
    globalThis.fetch = fetchMock as typeof fetch;

    const settings: AISettings = {
      ...DEFAULT_AI_SETTINGS,
      enabled: true,
      provider: 'gemini',
      geminiApiKey: 'AIza-cache-test',
      geminiModel: 'gemini-2.0-flash',
    };
    await saveAISettingsToServer(settings);

    // localStorage should now hold the full settings object (including
    // the fresh secret — server has it, but the client's optimistic cache
    // mirrors what it just sent).
    const cached = loadAISettings();
    expect(cached.geminiApiKey).toBe('AIza-cache-test');
  });
});
