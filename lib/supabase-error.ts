/**
 * HMR·이펙트 재실행·fetch abort 등으로 생기는 취소성 오류인지 판별.
 * 권한 판정 결과는 바꾸지 않고, console.error 노이즈만 줄일 때 사용한다.
 */
export function isAbortLikeError(error: unknown): boolean {
  if (error == null) return false;
  if (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }
  if (error instanceof Error && error.name === 'AbortError') return true;

  const e = error as { name?: string; message?: string; code?: string };
  if (e.name === 'AbortError') return true;

  const msg = String(e.message ?? error ?? '').toLowerCase();
  return (
    msg.includes('aborterror') ||
    msg.includes('the user aborted') ||
    msg.includes('signal is aborted') ||
    msg.includes('request was aborted')
  );
}

/** PostgrestError / Error / 빈 객체가 오버레이에 `{}`로만 보이지 않게 메시지 추출 */
export function formatUnknownError(error: unknown): string {
  if (error == null) return '';
  if (typeof error === 'string') return error;

  const e = error as {
    name?: string;
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
  };
  const parts = [e.name, e.code, e.message, e.details, e.hint]
    .map((v) => (v == null ? '' : String(v).trim()))
    .filter(Boolean);
  if (parts.length > 0) return parts.join(' | ');

  try {
    const s = String(error);
    return s && s !== '[object Object]' ? s : 'unknown error';
  } catch {
    return 'unknown error';
  }
}
