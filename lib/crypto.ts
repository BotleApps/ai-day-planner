import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
  const k = process.env.ENCRYPTION_KEY;
  if (!k || k.length < 32) {
    throw new Error('ENCRYPTION_KEY env var must be set and at least 32 characters');
  }
  return Buffer.from(k.slice(0, 32), 'utf8');
}

/** Encrypt plaintext → "ivHex:tagHex:ciphertextHex" */
export function encrypt(text: string): string {
  if (!text) return '';
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), enc.toString('hex')].join(':');
}

/** Decrypt "ivHex:tagHex:ciphertextHex" → plaintext */
export function decrypt(encoded: string): string {
  if (!encoded) return '';
  try {
    const parts = encoded.split(':');
    if (parts.length !== 3) return '';
    const [ivHex, tagHex, encHex] = parts;
    const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const dec = decipher.update(Buffer.from(encHex, 'hex'));
    return Buffer.concat([dec, decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}
