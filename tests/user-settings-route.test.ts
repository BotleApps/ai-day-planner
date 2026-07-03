import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setAuth, resetAuth, prismaMock, resetPrisma,
  authMockFactory, prismaMockFactory, makeRequest, readJson,
} from './_harness/mocks';

vi.mock('@/auth', () => authMockFactory());
vi.mock('@/lib/db', () => prismaMockFactory());

// crypto is a real, in-process, side-effect-free lib — we could use the real
// one, but we mock so tests don't require ENCRYPTION_KEY to be set in the
// environment and so we can assert the encryption boundary directly.
vi.mock('@/lib/crypto', () => ({
  encrypt: (plain: string) => `enc(${plain})`,
  decrypt: (enc: string) => enc.replace(/^enc\(/, '').replace(/\)$/, ''),
}));

import { GET, PUT } from '@/app/api/user-settings/route';

describe('GET /api/user-settings', () => {
  beforeEach(() => { resetAuth(); resetPrisma(); });

  it('401 when unauthenticated', async () => {
    setAuth(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(prismaMock.userSettings.findUnique).not.toHaveBeenCalled();
  });

  it('returns DEFAULT_AI_SETTINGS when no row exists yet', async () => {
    setAuth({ user: { id: 'u1' } });
    prismaMock.userSettings.findUnique.mockResolvedValue(null);
    const res = await GET();
    const { status, body } = await readJson<{ settings: { enabled: boolean } }>(res);
    expect(status).toBe(200);
    expect(body.settings.enabled).toBe(false);
  });

  it("NEVER returns plaintext secrets — only configured flags + hint", async () => {
    setAuth({ user: { id: 'u1' } });
    prismaMock.userSettings.findUnique.mockResolvedValue({
      userId: 'u1',
      aiEnabled: true,
      provider: 'sap',
      clientId: 'cid',
      clientSecretEnc: 'enc(supersecret-abc12345)',
      authUrl: 'https://auth',
      apiUrl: 'https://api',
      resourceGroup: 'default',
      deploymentId: 'dep',
      backend: 'openai',
      modelName: 'gpt-4',
      geminiApiKeyEnc: 'enc(AIzaSecretXYZ0)',
      geminiModel: 'gemini-2.0-flash',
    });

    const res = await GET();
    const { body } = await readJson<{ settings: Record<string, unknown> }>(res);
    // The GET response must not carry raw secrets under ANY field name.
    const serialized = JSON.stringify(body.settings);
    expect(serialized).not.toContain('supersecret-abc12345');
    expect(serialized).not.toContain('AIzaSecretXYZ0');
    // But it must indicate that secrets ARE configured, with a hint.
    expect(body.settings.clientSecretConfigured).toBe(true);
    expect(body.settings.geminiApiKeyConfigured).toBe(true);
    // Hint shows the last 4 chars only (masked prefix).
    expect(body.settings.clientSecretHint).toBe('••••2345');
    expect(body.settings.geminiApiKeyHint).toBe('••••tXYZ0'.slice(0, 4) + 'tXYZ0'.slice(-4));
  });

  it('reports configured=false when no secret is stored', async () => {
    setAuth({ user: { id: 'u1' } });
    prismaMock.userSettings.findUnique.mockResolvedValue({
      userId: 'u1',
      aiEnabled: false,
      provider: 'sap',
      clientId: '', clientSecretEnc: '',
      authUrl: '', apiUrl: '', resourceGroup: 'default',
      deploymentId: '', backend: 'openai', modelName: '',
      geminiApiKeyEnc: '', geminiModel: '',
    });
    const res = await GET();
    const { body } = await readJson<{ settings: Record<string, unknown> }>(res);
    expect(body.settings.clientSecretConfigured).toBe(false);
    expect(body.settings.clientSecretHint).toBeNull();
    expect(body.settings.geminiApiKeyConfigured).toBe(false);
    expect(body.settings.geminiApiKeyHint).toBeNull();
  });
});

// ─── PUT — the highest-risk path ──────────────────────────────────────────

describe('PUT /api/user-settings', () => {
  beforeEach(() => { resetAuth(); resetPrisma(); });

  it('401 when unauthenticated', async () => {
    setAuth(null);
    const res = await PUT(makeRequest('/api/user-settings', {
      method: 'PUT', body: {},
    }));
    expect(res.status).toBe(401);
    expect(prismaMock.userSettings.upsert).not.toHaveBeenCalled();
  });

  it('encrypts a fresh clientSecret before writing to DB (no plaintext leak)', async () => {
    setAuth({ user: { id: 'u1' } });
    prismaMock.userSettings.findUnique.mockResolvedValue(null);
    prismaMock.userSettings.upsert.mockResolvedValue({});

    await PUT(makeRequest('/api/user-settings', {
      method: 'PUT',
      body: {
        enabled: true,
        provider: 'sap',
        clientId: 'cid',
        clientSecret: 'fresh-secret-xxxx',
        authUrl: 'https://auth', apiUrl: 'https://api',
        deploymentId: 'dep', modelName: 'gpt-4', backend: 'openai',
      },
    }));

    const upsertArgs = prismaMock.userSettings.upsert.mock.calls[0][0];
    // The value that lands in DB must be the ENCRYPTED form — i.e. the
    // return of encrypt(), which our stub prefixes with 'enc('.
    expect(upsertArgs.create.clientSecretEnc).toBe('enc(fresh-secret-xxxx)');
    expect(upsertArgs.update.clientSecretEnc).toBe('enc(fresh-secret-xxxx)');
    // Sanity: the DB value is not the raw plaintext — the route MUST
    // have called encrypt() rather than passing through the string.
    expect(upsertArgs.create.clientSecretEnc).not.toBe('fresh-secret-xxxx');
    // upsert must be scoped to session userId.
    expect(upsertArgs.where).toEqual({ userId: 'u1' });
    expect(upsertArgs.create.userId).toBe('u1');
  });

  it('PRESERVES existing encrypted secret when the client omits clientSecret', async () => {
    // This is the core UX guarantee: users typically GET (masked) then PUT
    // back with unchanged fields; if the payload omits clientSecret, we
    // MUST NOT wipe the stored value.
    setAuth({ user: { id: 'u1' } });
    prismaMock.userSettings.findUnique.mockResolvedValue({
      userId: 'u1',
      clientId: 'cid',
      clientSecretEnc: 'enc(existing-secret)',
      authUrl: 'https://auth', apiUrl: 'https://api',
      deploymentId: 'dep', modelName: 'gpt-4', backend: 'openai',
      resourceGroup: 'default',
      geminiApiKeyEnc: '',
      geminiModel: '',
      aiEnabled: true, provider: 'sap',
    });
    prismaMock.userSettings.upsert.mockResolvedValue({});

    await PUT(makeRequest('/api/user-settings', {
      method: 'PUT',
      body: { enabled: true, provider: 'sap', clientId: 'cid' }, // no clientSecret
    }));
    const args = prismaMock.userSettings.upsert.mock.calls[0][0];
    expect(args.update.clientSecretEnc).toBe('enc(existing-secret)');
    expect(args.create.clientSecretEnc).toBe('enc(existing-secret)');
  });

  it('empty-string clientSecret is treated as "omit" (preserves existing secret)', async () => {
    // Match documented behavior: only NON-EMPTY new values overwrite.
    setAuth({ user: { id: 'u1' } });
    prismaMock.userSettings.findUnique.mockResolvedValue({
      userId: 'u1',
      clientSecretEnc: 'enc(existing-secret)',
      geminiApiKeyEnc: '',
      // other required fields
      clientId: 'cid', authUrl: '', apiUrl: '', deploymentId: '',
      modelName: '', backend: 'openai', resourceGroup: 'default',
      geminiModel: '', aiEnabled: true, provider: 'sap',
    });
    prismaMock.userSettings.upsert.mockResolvedValue({});

    await PUT(makeRequest('/api/user-settings', {
      method: 'PUT',
      body: { clientSecret: '' }, // explicit empty
    }));
    const args = prismaMock.userSettings.upsert.mock.calls[0][0];
    expect(args.update.clientSecretEnc).toBe('enc(existing-secret)');
  });

  it('geminiApiKey follows the same round-trip / preservation semantics', async () => {
    setAuth({ user: { id: 'u1' } });
    prismaMock.userSettings.findUnique.mockResolvedValue({
      userId: 'u1',
      clientSecretEnc: '',
      geminiApiKeyEnc: 'enc(existing-gemini-key)',
      clientId: '', authUrl: '', apiUrl: '',
      deploymentId: '', modelName: '', backend: 'openai',
      resourceGroup: 'default', geminiModel: 'gemini-2.0-flash',
      aiEnabled: true, provider: 'gemini',
    });
    prismaMock.userSettings.upsert.mockResolvedValue({});

    // 1. Omitting the field → preserved.
    await PUT(makeRequest('/api/user-settings', {
      method: 'PUT',
      body: { provider: 'gemini', geminiModel: 'gemini-2.0-flash' },
    }));
    let args = prismaMock.userSettings.upsert.mock.calls[0][0];
    expect(args.update.geminiApiKeyEnc).toBe('enc(existing-gemini-key)');

    prismaMock.userSettings.upsert.mockClear();

    // 2. Passing a fresh non-empty value → overwritten (encrypted).
    await PUT(makeRequest('/api/user-settings', {
      method: 'PUT',
      body: { provider: 'gemini', geminiApiKey: 'brand-new', geminiModel: 'gemini-2.0-flash' },
    }));
    args = prismaMock.userSettings.upsert.mock.calls[0][0];
    expect(args.update.geminiApiKeyEnc).toBe('enc(brand-new)');
  });

  it('scopes writes to the session userId (upsert.where + create.userId)', async () => {
    setAuth({ user: { id: 'u1' } });
    prismaMock.userSettings.findUnique.mockResolvedValue(null);
    prismaMock.userSettings.upsert.mockResolvedValue({});

    // Attacker attempts to inject userId in the body.
    await PUT(makeRequest('/api/user-settings', {
      method: 'PUT',
      body: { userId: 'attacker', enabled: true, provider: 'sap' },
    }));
    const args = prismaMock.userSettings.upsert.mock.calls[0][0];
    expect(args.where).toEqual({ userId: 'u1' });
    expect(args.create.userId).toBe('u1');
  });
});
