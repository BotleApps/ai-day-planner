import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const HEX_64 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('lib/crypto', () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = HEX_64;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = originalKey;
  });

  it('round-trips text through encrypt/decrypt', async () => {
    const { encrypt, decrypt } = await import('../lib/crypto');
    const plaintext = 'super-secret-api-key-12345';
    const ct = encrypt(plaintext);
    expect(ct).not.toBe(plaintext);
    expect(ct.split(':').length).toBe(3); // iv:tag:ciphertext
    expect(decrypt(ct)).toBe(plaintext);
  });

  it('produces different ciphertext for the same plaintext (random IV)', async () => {
    const { encrypt } = await import('../lib/crypto');
    const a = encrypt('hello');
    const b = encrypt('hello');
    expect(a).not.toBe(b);
  });

  it('returns "" for empty input', async () => {
    const { encrypt, decrypt } = await import('../lib/crypto');
    expect(encrypt('')).toBe('');
    expect(decrypt('')).toBe('');
  });

  it('returns "" for malformed ciphertext (no exception)', async () => {
    const { decrypt } = await import('../lib/crypto');
    expect(decrypt('not-encrypted')).toBe('');
    expect(decrypt('aa:bb')).toBe('');
    expect(decrypt('aa:bb:cc:dd')).toBe('');
  });

  it('returns "" when the auth tag is tampered with', async () => {
    const { encrypt, decrypt } = await import('../lib/crypto');
    const ct = encrypt('hello');
    const parts = ct.split(':');
    const iv = parts[0];
    const body = parts[2];
    const tampered = `${iv}:${'00'.repeat(16)}:${body}`;
    expect(decrypt(tampered)).toBe('');
  });

  it('throws when ENCRYPTION_KEY is unset', async () => {
    delete process.env.ENCRYPTION_KEY;
    const { encrypt } = await import('../lib/crypto');
    expect(() => encrypt('x')).toThrow(/ENCRYPTION_KEY/);
  });

  it('throws when ENCRYPTION_KEY is not 64-hex (too short)', async () => {
    process.env.ENCRYPTION_KEY = 'too-short';
    const { encrypt } = await import('../lib/crypto');
    expect(() => encrypt('x')).toThrow(/ENCRYPTION_KEY/);
  });

  it('throws when ENCRYPTION_KEY is 64 chars but not hex', async () => {
    process.env.ENCRYPTION_KEY = 'z'.repeat(64);
    const { encrypt } = await import('../lib/crypto');
    expect(() => encrypt('x')).toThrow(/ENCRYPTION_KEY/);
  });

  it('decrypts with a different key returns ""', async () => {
    const { encrypt } = await import('../lib/crypto');
    const ct = encrypt('secret');
    // Swap key, re-import (vi cache) — simplest path: use a fresh module
    process.env.ENCRYPTION_KEY = 'f'.repeat(64);
    const { decrypt } = await import('../lib/crypto?key2' as string);
    expect(decrypt(ct)).toBe('');
  });
});
