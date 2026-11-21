/**
 * 앱 공통 사용자 AI API 키 (localStorage only — 서버 DB 미저장)
 * key: sfh_ai_key_{userId}_{provider}
 * custom 추가: sfh_ai_base_{userId}_custom, sfh_ai_model_{userId}_custom
 */

export type AiUserProvider = 'openai' | 'anthropic' | 'gemini' | 'custom';

export const AI_USER_PROVIDERS: readonly AiUserProvider[] = [
  'openai',
  'anthropic',
  'gemini',
  'custom',
] as const;

export const aiUserKeyStorageKey = (userId: string, provider: AiUserProvider) =>
  `sfh_ai_key_${userId}_${provider}`;

export const aiUserBaseStorageKey = (userId: string) => `sfh_ai_base_${userId}_custom`;

export const aiUserModelStorageKey = (userId: string) => `sfh_ai_model_${userId}_custom`;

export type StoredAiKey = {
  key: string;
  provider: AiUserProvider;
  /** custom(OpenAI 호환)만 */
  baseUrl?: string;
  /** custom(OpenAI 호환)만 — 미입력 시 프록시 기본 모델 */
  model?: string;
};

export function getStoredCustomMeta(userId: string): { baseUrl: string; model: string } {
  if (typeof window === 'undefined' || !userId) return { baseUrl: '', model: '' };
  return {
    baseUrl: localStorage.getItem(aiUserBaseStorageKey(userId))?.trim() ?? '',
    model: localStorage.getItem(aiUserModelStorageKey(userId))?.trim() ?? '',
  };
}

export function setStoredCustomMeta(
  userId: string,
  meta: { baseUrl: string; model: string },
): void {
  if (typeof window === 'undefined' || !userId) return;
  const base = meta.baseUrl.trim().replace(/\/+$/, '');
  const model = meta.model.trim();
  if (base) localStorage.setItem(aiUserBaseStorageKey(userId), base);
  else localStorage.removeItem(aiUserBaseStorageKey(userId));
  if (model) localStorage.setItem(aiUserModelStorageKey(userId), model);
  else localStorage.removeItem(aiUserModelStorageKey(userId));
}

export function clearStoredCustomMeta(userId: string): void {
  if (typeof window === 'undefined' || !userId) return;
  localStorage.removeItem(aiUserBaseStorageKey(userId));
  localStorage.removeItem(aiUserModelStorageKey(userId));
}

export function getStoredAiKey(userId: string): StoredAiKey | null {
  if (typeof window === 'undefined' || !userId) return null;

  for (const provider of AI_USER_PROVIDERS) {
    const key = localStorage.getItem(aiUserKeyStorageKey(userId, provider))?.trim();
    if (!key) continue;
    if (provider === 'custom') {
      const { baseUrl, model } = getStoredCustomMeta(userId);
      if (!baseUrl) continue;
      return { key, provider, baseUrl, model: model || undefined };
    }
    return { key, provider };
  }
  return null;
}

export function hasStoredAiKey(userId: string): boolean {
  return getStoredAiKey(userId) != null;
}

/** /api/ai/proxy body에 넣을 provider·custom 필드 */
export function storedAiKeyToProxyBody(
  stored: StoredAiKey,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    provider: stored.provider,
    ...(stored.baseUrl ? { baseUrl: stored.baseUrl } : {}),
    ...(stored.model ? { model: stored.model } : {}),
    ...extra,
  };
}
