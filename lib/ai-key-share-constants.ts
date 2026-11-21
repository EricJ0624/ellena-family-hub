/** 클라이언트·서버 공용 상수 (Node crypto 의존 없음) */

export const AI_KEY_SHARE_TTL_MS = 3 * 60 * 1000;
export const AI_KEY_SHARE_QR_PREFIX = 'sfh-ai-share:v1:';

export function buildShareQrPayload(token: string): string {
  return `${AI_KEY_SHARE_QR_PREFIX}${token}`;
}

export function parseShareQrPayload(raw: string): string | null {
  const text = raw.trim();
  if (!text.startsWith(AI_KEY_SHARE_QR_PREFIX)) return null;
  const token = text.slice(AI_KEY_SHARE_QR_PREFIX.length).trim();
  return token.length >= 16 ? token : null;
}

/** QR 페이로드 또는 bare token → 토큰 문자열 */
export function resolveShareTokenFromInput(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const text = raw.trim();
  if (text.startsWith(AI_KEY_SHARE_QR_PREFIX)) {
    return parseShareQrPayload(text);
  }
  return text.length >= 16 ? text : null;
}

export function resolveShareTokenFromBody(body: {
  token?: unknown;
  qrPayload?: unknown;
}): string | null {
  if (typeof body.qrPayload === 'string') {
    return resolveShareTokenFromInput(body.qrPayload);
  }
  if (typeof body.token === 'string') {
    return resolveShareTokenFromInput(body.token);
  }
  return null;
}
