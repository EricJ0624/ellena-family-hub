/**
 * 앱 공통 사용자 AI API 키 (localStorage only — 서버 DB 미저장)
 * key: sfh_ai_key_{userId}_{provider}  (at-rest 암호문, 접두사 sfh-ai-enc:v1:)
 * custom 추가: sfh_ai_base_{userId}_custom, sfh_ai_model_{userId}_custom
 */

import CryptoJS from 'crypto-js';

export type AiUserProvider = 'openai' | 'anthropic' | 'gemini' | 'custom';

export const AI_USER_PROVIDERS: readonly AiUserProvider[] = [
  'openai',
  'anthropic',
  'gemini',
  'custom',
] as const;

const ENC_PREFIX = 'sfh-ai-enc:v1:';

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

function vaultPassphrase(userId: string): string {
  return `SFH_AI_VAULT_V1_${userId}`;
}

/** 캐주얼 도용 완화용 at-rest 암호화 (사용 시 복호화) */
export function encryptAiKeyForLocal(userId: string, plainKey: string): string {
  const trimmed = plainKey.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith(ENC_PREFIX)) return trimmed;
  const cipher = CryptoJS.AES.encrypt(trimmed, vaultPassphrase(userId)).toString();
  return `${ENC_PREFIX}${cipher}`;
}

export function decryptAiKeyFromLocal(userId: string, stored: string): string | null {
  const raw = stored?.trim() ?? '';
  if (!raw) return null;
  if (!raw.startsWith(ENC_PREFIX)) {
    // 구버전 평문 — 읽기 허용, 호출측에서 재암호화 가능
    return raw;
  }
  try {
    const bytes = CryptoJS.AES.decrypt(raw.slice(ENC_PREFIX.length), vaultPassphrase(userId));
    const plain = bytes.toString(CryptoJS.enc.Utf8);
    return plain?.trim() ? plain.trim() : null;
  } catch {
    return null;
  }
}

export function writeStoredAiKey(
  userId: string,
  provider: AiUserProvider,
  plainKey: string,
): void {
  if (typeof window === 'undefined' || !userId) return;
  const encrypted = encryptAiKeyForLocal(userId, plainKey);
  if (!encrypted) return;
  localStorage.setItem(aiUserKeyStorageKey(userId, provider), encrypted);
}

export function readStoredAiKeyPlain(
  userId: string,
  provider: AiUserProvider,
): string | null {
  if (typeof window === 'undefined' || !userId) return null;
  const stored = localStorage.getItem(aiUserKeyStorageKey(userId, provider));
  if (!stored) return null;
  const plain = decryptAiKeyFromLocal(userId, stored);
  // 평문 레거시 → 암호문으로 승격
  if (plain && !stored.trim().startsWith(ENC_PREFIX)) {
    writeStoredAiKey(userId, provider, plain);
  }
  return plain;
}

export function removeStoredAiKey(userId: string, provider: AiUserProvider): void {
  if (typeof window === 'undefined' || !userId) return;
  localStorage.removeItem(aiUserKeyStorageKey(userId, provider));
}

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

function storedAiKeyForProvider(
  userId: string,
  provider: AiUserProvider,
): StoredAiKey | null {
  const key = readStoredAiKeyPlain(userId, provider);
  if (!key) return null;
  if (provider === 'custom') {
    const { baseUrl, model } = getStoredCustomMeta(userId);
    if (!baseUrl) return null;
    return { key, provider, baseUrl, model: model || undefined };
  }
  return { key, provider };
}

const lastProviderStorageKey = (userId: string) => `sfh_ai_last_provider_${userId}`;

function readLastPreferredProvider(userId: string): AiUserProvider | null {
  if (typeof window === 'undefined' || !userId) return null;
  const lastRaw = localStorage.getItem(lastProviderStorageKey(userId));
  if (!lastRaw || !(AI_USER_PROVIDERS as readonly string[]).includes(lastRaw)) return null;
  return lastRaw as AiUserProvider;
}

/**
 * 사용할 AI 키: 최근 저장·선택 제공자 우선 → 없으면 openai→…→custom 순
 */
export function getStoredAiKey(userId: string): StoredAiKey | null {
  if (typeof window === 'undefined' || !userId) return null;

  const preferred = readLastPreferredProvider(userId);
  if (preferred) {
    const preferredStored = storedAiKeyForProvider(userId, preferred);
    if (preferredStored) return preferredStored;
  }

  for (const provider of AI_USER_PROVIDERS) {
    const stored = storedAiKeyForProvider(userId, provider);
    if (stored) return stored;
  }
  return null;
}

export function hasStoredAiKey(userId: string): boolean {
  return getStoredAiKey(userId) != null;
}

/** 계정 모달 등에서 마지막으로 저장·선택한 제공자 기억 */
export function setPreferredAiProvider(userId: string, provider: AiUserProvider): void {
  if (typeof window === 'undefined' || !userId) return;
  localStorage.setItem(lastProviderStorageKey(userId), provider);
}

/**
 * 모달 진입 시 기본 탭: getStoredAiKey와 동일 우선순위 → 없으면 openai
 */
export function getPreferredAiProvider(userId: string): AiUserProvider {
  return getStoredAiKey(userId)?.provider ?? 'openai';
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

export function maskAiKeyPreview(plainKey: string): string {
  const k = plainKey.trim();
  if (k.length <= 8) return `${k.slice(0, 2)}…`;
  return `${k.slice(0, 8)}…`;
}
