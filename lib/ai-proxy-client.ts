/**
 * /api/ai/proxy 호출 헬퍼
 * - Authorization: Supabase access_token (세션 인증)
 * - X-AI-Api-Key: 사용자 LLM 키 (서버 DB 미저장, 요청 메모리만)
 */

import { supabase } from '@/lib/supabase';

export async function fetchAiProxy(params: {
  apiKey: string;
  body: Record<string, unknown>;
  /** 삭제/취소 시 스트림·요청 중단용 (선택) */
  signal?: AbortSignal;
}): Promise<Response> {
  const key = params.apiKey.trim();
  if (!key) {
    throw new Error('NO_AI_KEY');
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('NO_SESSION');
  }

  return fetch('/api/ai/proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      'X-AI-Api-Key': key,
    },
    body: JSON.stringify(params.body),
    signal: params.signal,
  });
}
