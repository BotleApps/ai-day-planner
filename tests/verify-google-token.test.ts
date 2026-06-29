import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('lib/verify-google-token', () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = {
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_IOS_CLIENT_ID: process.env.GOOGLE_IOS_CLIENT_ID,
      GOOGLE_ANDROID_CLIENT_ID: process.env.GOOGLE_ANDROID_CLIENT_ID,
    };
    vi.resetModules();
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

    errSpy.mockRestore();
  });

  it('returns null on an invalid token when client IDs ARE configured', async () => {
    process.env.GOOGLE_CLIENT_ID = '650060721357-web.apps.googleusercontent.com';

    const { verifyGoogleIdToken } = await import('../lib/verify-google-token');
    // Garbage input — google-auth-library will reject it (no fatal log expected)
    const result = await verifyGoogleIdToken('not.a.real.token');

    expect(result).toBeNull();
  });
});
