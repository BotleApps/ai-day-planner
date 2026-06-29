import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
  const k = process.env.ENCRYPTION_KEY ?? '';
  if (!/^[0-9a-fA-F]{64}$/.test(k)) {
    throw new Error(
      'ENCRYPTION_KEY must be a 64-character hex string (32 random bytes). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(k, 'hex');
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
