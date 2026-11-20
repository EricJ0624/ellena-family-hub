/**
 * 앱 공통 사용자 AI API 키 (localStorage only — 서버 DB 미저장)
 * key: sfh_ai_key_{userId}_{provider}
 */

export type AiUserProvider = 'openai' | 'anthropic';

export const aiUserKeyStorageKey = (userId: string, provider: AiUserProvider) =>
  `sfh_ai_key_${userId}_${provider}`;

export function getStoredAiKey(
  userId: string,
): { key: string; provider: AiUserProvider } | null {
  if (typeof window === 'undefined' || !userId) return null;
  const openaiKey = localStorage.getItem(aiUserKeyStorageKey(userId, 'openai'))?.trim();
  if (openaiKey) return { key: openaiKey, provider: 'openai' };
  const anthropicKey = localStorage.getItem(aiUserKeyStorageKey(userId, 'anthropic'))?.trim();
  if (anthropicKey) return { key: anthropicKey, provider: 'anthropic' };
  return null;
}

export function hasStoredAiKey(userId: string): boolean {
  return getStoredAiKey(userId) != null;
}
