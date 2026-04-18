/**
 * Supabase GoTrue 회원가입·인증 메일 발송 등에서의 **진짜 rate limit**만 판별한다.
 * `message` 안의 `exceeded` 단독 매칭은 다른 오류(쿼터·DB 등)를 잘못 분류할 수 있어 쓰지 않는다.
 */
export function isSupabaseAuthRateLimitError(error: unknown): boolean {
  const e = error as {
    status?: number;
    code?: string;
    message?: string;
  };

  if (typeof e?.status === 'number' && e.status === 429) return true;

  const code = String(e?.code ?? '')
    .toLowerCase()
    .trim();
  if (
    code.includes('over_email_send') ||
    code.includes('too_many_requests') ||
    code.includes('rate_limit') ||
    (code.includes('email_send') && code.includes('rate'))
  ) {
    return true;
  }

  const msg = String(e?.message ?? '').toLowerCase();
  // GoTrue: "For security purposes, you can only request this after …"
  if (msg.includes('can only request this after')) return true;
  if (msg.includes('too many requests')) return true;
  if (msg.includes('rate limit')) return true;
  if (msg.includes('email rate limit')) return true;
  if (msg.includes('over_email_send_rate')) return true;
  if (msg.includes('sms sending rate limit')) return true;
  if (msg.includes('throttle') || msg.includes('throttl')) return true;
  // HTTP 상태가 본문에만 있는 경우(일부 클라이언트)
  if (/\b429\b/.test(msg) && (msg.includes('request') || msg.includes('limit'))) return true;

  return false;
}

/** 지원·로그용(이메일 주소는 호출부에서 넣지 말 것) */
export function formatSupabaseAuthErrorForLog(error: unknown): string {
  const e = error as { status?: number; code?: string; message?: string };
  try {
    return JSON.stringify({
      status: e?.status,
      code: e?.code,
      message: typeof e?.message === 'string' ? e.message.slice(0, 400) : undefined,
    });
  } catch {
    return String(error);
  }
}
