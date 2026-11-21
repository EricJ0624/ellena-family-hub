/**
 * 가족 채팅 — 사용자 로컬 AI 키로 문장 번역
 * 여행/육아 AI와 동일: localStorage 키 + /api/ai/proxy (서버 DB에 키 저장 안 함)
 */

import { fetchAiProxy } from '@/lib/ai-proxy-client';
import { getStoredAiKey, hasStoredAiKey, storedAiKeyToProxyBody } from '@/lib/ai-user-key';
import { getLangLabel, isValidLang } from '@/lib/language-fonts';

export { hasStoredAiKey as hasStoredChatAiKey };

function languageLabel(code: string): string {
  return isValidLang(code) ? getLangLabel(code) : code;
}

/**
 * 사용자 API 키로 텍스트 번역. 실패 시 Error throw.
 * max 500자(채팅 sanitize 상한)만 전달.
 */
export async function translateChatText(params: {
  userId: string;
  text: string;
  targetLang: string;
}): Promise<string> {
  const trimmed = params.text.trim().slice(0, 500);
  if (!trimmed) throw new Error('EMPTY');

  const stored = getStoredAiKey(params.userId);
  if (!stored) throw new Error('NO_AI_KEY');

  const target = languageLabel(params.targetLang);
  const systemPrompt =
    'You are a translation engine. Translate the user message into the target language. ' +
    'Return only the translated text with no quotes, labels, or explanations.';
  const userPrompt = `Target language: ${target}\n\nText:\n${trimmed}`;

  const res = await fetchAiProxy({
    apiKey: stored.key,
    body: storedAiKeyToProxyBody(stored, {
      systemPrompt,
      userPrompt,
      stream: false,
      maxTokens: 800,
    }),
  });

  if (!res.ok) {
    const errJson = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errJson?.error ?? `HTTP ${res.status}`);
  }

  const json = (await res.json()) as Record<string, unknown>;
  const text =
    (json.choices as Array<{ message: { content: string } }>)?.[0]?.message?.content?.trim() ??
    (json.content as Array<{ text: string }>)?.[0]?.text?.trim() ??
    '';

  if (!text) throw new Error('EMPTY_RESPONSE');
  return text.slice(0, 500);
}
