/**
 * AI 키 QR 공유 — 서버 전용 암·복호화 / 토큰 유틸
 * 키 본문은 로그에 남기지 말 것.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import type { AiUserProvider } from '@/lib/ai-user-key';

export {
  AI_KEY_SHARE_TTL_MS,
  buildShareQrPayload,
  parseShareQrPayload,
  resolveShareTokenFromBody,
  resolveShareTokenFromInput,
} from '@/lib/ai-key-share-constants';

function shareSecret(): Buffer {
  const raw =
    process.env.AI_KEY_SHARE_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    'sfh-ai-key-share-dev-only';
  return createHash('sha256').update(raw).digest();
}

/** AES-256-GCM. 반환 문자열은 iv:tag:cipher (base64) */
export function encryptApiKeyForShare(plainKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', shareSecret(), iv);
  const enc = Buffer.concat([cipher.update(plainKey, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptApiKeyFromShare(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('INVALID_CIPHERTEXT');
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', shareSecret(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function createShareToken(): string {
  return randomBytes(32).toString('base64url');
}

export function isShareProvider(v: unknown): v is AiUserProvider {
  return v === 'openai' || v === 'anthropic' || v === 'gemini' || v === 'custom';
}
