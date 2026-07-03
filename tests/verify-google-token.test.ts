import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// google-auth-library's OAuth2Client is instantiated at module load, so we
// mock it once here and reconfigure verifyIdToken's behavior per test.
const verifyIdTokenMock = vi.fn();

vi.mock('google-auth-library', () => {
  class MockOAuth2Client {
    async verifyIdToken(args: { idToken: string; audience?: string | string[] | undefined }) {
      return verifyIdTokenMock(args);
    }
  }
  return { OAuth2Client: MockOAuth2Client };
});

describe('lib/verify-google-token', () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = {
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_IOS_CLIENT_ID: process.env.GOOGLE_IOS_CLIENT_ID,
      GOOGLE_ANDROID_CLIENT_ID: process.env.GOOGLE_ANDROID_CLIENT_ID,
    };
    vi.resetModules();
    verifyIdTokenMock.mockReset();
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(originalEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    vi.resetModules();
  });

  it('returns null and logs FATAL when no client IDs are configured', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_IOS_CLIENT_ID;
    delete process.env.GOOGLE_ANDROID_CLIENT_ID;

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { verifyGoogleIdToken } = await import('../lib/verify-google-token');
    const result = await verifyGoogleIdToken('any-token');

    expect(result).toBeNull();
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('FATAL'));
    expect(verifyIdTokenMock).not.toHaveBeenCalled();

    errSpy.mockRestore();
  });

  it('returns null on an invalid token when client IDs ARE configured', async () => {
    process.env.GOOGLE_CLIENT_ID = 'web.client.id';
    verifyIdTokenMock.mockRejectedValue(new Error('bad token'));

    const { verifyGoogleIdToken } = await import('../lib/verify-google-token');
    const result = await verifyGoogleIdToken('not.a.real.token');

    expect(result).toBeNull();
  });

  it('accepts a payload whose aud matches GOOGLE_CLIENT_ID (web)', async () => {
    process.env.GOOGLE_CLIENT_ID = 'web.client.id';
    process.env.GOOGLE_IOS_CLIENT_ID = 'ios.client.id';
    process.env.GOOGLE_ANDROID_CLIENT_ID = 'android.client.id';

    const payload = { sub: 'user-1', email: 'u@x.com', email_verified: true };
    verifyIdTokenMock.mockResolvedValue({ getPayload: () => payload });

    const { verifyGoogleIdToken } = await import('../lib/verify-google-token');
    const result = await verifyGoogleIdToken('web-token');
    expect(result).toEqual(payload);

    // The library MUST receive all configured audiences so it can accept
    // tokens from any of our OAuth clients.
    const call = verifyIdTokenMock.mock.calls[0][0];
    expect(call.audience).toEqual(['web.client.id', 'ios.client.id', 'android.client.id']);
  });

  it('accepts a payload whose aud matches GOOGLE_IOS_CLIENT_ID', async () => {
    process.env.GOOGLE_CLIENT_ID = 'web.client.id';
    process.env.GOOGLE_IOS_CLIENT_ID = 'ios.client.id';

    verifyIdTokenMock.mockResolvedValue({
      getPayload: () => ({ sub: 'user-ios', email: 'ios@x.com', email_verified: true }),
    });

    const { verifyGoogleIdToken } = await import('../lib/verify-google-token');
    const result = await verifyGoogleIdToken('ios-token');
    expect(result?.sub).toBe('user-ios');
  });

  it('accepts a payload whose aud matches GOOGLE_ANDROID_CLIENT_ID', async () => {
    process.env.GOOGLE_CLIENT_ID = 'web.client.id';
    process.env.GOOGLE_ANDROID_CLIENT_ID = 'android.client.id';

    verifyIdTokenMock.mockResolvedValue({
      getPayload: () => ({ sub: 'user-android', email: 'a@x.com', email_verified: true }),
    });

    const { verifyGoogleIdToken } = await import('../lib/verify-google-token');
    const result = await verifyGoogleIdToken('android-token');
    expect(result?.sub).toBe('user-android');
  });

  it('returns null when the payload has no sub claim', async () => {
    process.env.GOOGLE_CLIENT_ID = 'web.client.id';
    // Missing `sub` — happens if the library returns a malformed payload.
    verifyIdTokenMock.mockResolvedValue({ getPayload: () => ({ email: 'x@y.com' }) });

    const { verifyGoogleIdToken } = await import('../lib/verify-google-token');
    const result = await verifyGoogleIdToken('sub-less-token');
    expect(result).toBeNull();
  });

  it('returns null when email is present but email_verified is false', async () => {
    process.env.GOOGLE_CLIENT_ID = 'web.client.id';
    verifyIdTokenMock.mockResolvedValue({
      getPayload: () => ({ sub: 'user-1', email: 'unverified@x.com', email_verified: false }),
    });

    const { verifyGoogleIdToken } = await import('../lib/verify-google-token');
    const result = await verifyGoogleIdToken('unverified-token');
    expect(result).toBeNull();
  });

  it('accepts a payload with no email claim at all', async () => {
    process.env.GOOGLE_CLIENT_ID = 'web.client.id';
    // Some Google flows return sub without email — that's fine; we only
    // enforce email_verified when email is present.
    verifyIdTokenMock.mockResolvedValue({
      getPayload: () => ({ sub: 'user-noemail' }),
    });

    const { verifyGoogleIdToken } = await import('../lib/verify-google-token');
    const result = await verifyGoogleIdToken('noemail-token');
    expect(result?.sub).toBe('user-noemail');
  });

  it('returns null when getPayload() returns undefined', async () => {
    process.env.GOOGLE_CLIENT_ID = 'web.client.id';
    verifyIdTokenMock.mockResolvedValue({ getPayload: () => undefined });

    const { verifyGoogleIdToken } = await import('../lib/verify-google-token');
    const result = await verifyGoogleIdToken('no-payload-token');
    expect(result).toBeNull();
  });

  it('propagates neither exceptions nor logs when verifyIdToken throws (invalid signature)', async () => {
    process.env.GOOGLE_CLIENT_ID = 'web.client.id';
    verifyIdTokenMock.mockRejectedValue(new Error('Invalid token signature'));

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { verifyGoogleIdToken } = await import('../lib/verify-google-token');
    const result = await verifyGoogleIdToken('tampered-token');

    expect(result).toBeNull();
    // Bad tokens should NOT log FATAL — that's reserved for missing client
    // ID config. Tampered tokens are a normal expected case.
    const fatalCalls = errSpy.mock.calls.filter(([m]) =>
      typeof m === 'string' && m.includes('FATAL'),
    );
    expect(fatalCalls).toHaveLength(0);
    errSpy.mockRestore();
  });
});
