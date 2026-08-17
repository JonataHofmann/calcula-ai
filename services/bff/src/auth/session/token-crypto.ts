import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { SessionTokens } from './session.store';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

export function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

export function encryptTokens(tokens: SessionTokens, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = JSON.stringify(tokens);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptTokens(payload: string, key: Buffer): SessionTokens {
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Invalid encrypted token payload');
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8')) as SessionTokens;
}
