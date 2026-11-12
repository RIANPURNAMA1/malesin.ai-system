import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const RAW_KEY = process.env.ENCRYPTION_KEY || '';

// ENCRYPTION_KEY idealnya berupa 64 karakter hex (32 byte).
// Kalau nilainya bukan hex valid (mis. placeholder), turunkan 32-byte key
// memakai scrypt supaya enkripsi tetap berfungsi dan tidak error saat runtime.
function resolveKey(): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(RAW_KEY)) return Buffer.from(RAW_KEY, 'hex');
  return crypto.scryptSync(RAW_KEY || 'malesin-ai-default-key', 'malesin-ai-encryption-salt', 32);
}

const KEY = resolveKey();

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encryptedHex] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
