import { createHmac, timingSafeEqual } from 'crypto';

const TTL_SECONDS = 60 * 60 * 2;

/** 같은 파일은 한동안 같은 주소를 쓰게 만료 시각을 맞춘다. */
export function mediaUrlExpiry(nowSeconds = Math.floor(Date.now() / 1000)): number {
  const windowEnd = Math.floor(nowSeconds / TTL_SECONDS) * TTL_SECONDS + TTL_SECONDS;
  if (windowEnd - nowSeconds < 10 * 60) return windowEnd + TTL_SECONDS;
  return windowEnd;
}

function mediaSecret(): string {
  const value = process.env.MEDIA_URL_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error('미디어 주소 서명이 설정되지 않았습니다.');
  return value;
}

function signPayload(payload: string): string {
  return createHmac('sha256', mediaSecret()).update(payload).digest('base64url');
}

export function issueMediaFileUrl(s3Key: string): string {
  const exp = mediaUrlExpiry();
  const key = Buffer.from(s3Key, 'utf8').toString('base64url');
  const payload = `${key}.${exp}`;
  const sig = signPayload(payload);
  return `/api/media/file?k=${encodeURIComponent(key)}&e=${exp}&s=${encodeURIComponent(sig)}`;
}

export function verifyMediaFileToken(key: string, expRaw: string, sig: string): string | null {
  const exp = Number(expRaw);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(exp) || exp < now) return null;
  const payload = `${key}.${expRaw}`;
  const expected = signPayload(payload);
  const actualBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) return null;
  try {
    const s3Key = Buffer.from(key, 'base64url').toString('utf8');
    if (!s3Key || s3Key.includes('..') || s3Key.startsWith('/') || s3Key.includes('\\') || s3Key.includes('\0')) {
      return null;
    }
    return s3Key;
  } catch {
    return null;
  }
}

export function s3KeyFromPublicUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const path = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
    if (!path || path.includes('..') || path.includes('\\') || path.includes('\0')) return null;
    return path;
  } catch {
    return null;
  }
}

export function keyMatchesGroup(s3Key: string, groupId: string): boolean {
  return s3Key.includes(`/groups/${groupId}/`);
}

type AttachmentUrls = {
  s3_key?: string | null;
  thumbnail_s3_key?: string | null;
  image_url?: string | null;
  thumbnail_url?: string | null;
};

/** 저장된 공개 주소 대신, 그룹 확인 뒤에만 발급한 짧은 주소를 응답에 넣는다. */
export function withMediaFileUrls<T extends AttachmentUrls>(row: T): T {
  try {
    const next = { ...row };
    if (row.s3_key === 'expired') {
      next.image_url = 'expired';
    } else if (row.s3_key) {
      next.image_url = issueMediaFileUrl(row.s3_key);
      if (row.thumbnail_s3_key) next.thumbnail_url = issueMediaFileUrl(row.thumbnail_s3_key);
    }
    return next;
  } catch (error) {
    console.error('첨부 표시 주소 발급 오류:', error);
    return row;
  }
}
