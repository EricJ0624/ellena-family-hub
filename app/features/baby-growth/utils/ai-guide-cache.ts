/** 아이별 AI guide 배너 캐시 (localStorage, 주 1회 갱신 판정용) */

const AI_GUIDE_CACHE_KEY = 'sfh_baby_ai_guide';

export const AI_GUIDE_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

export type AiGuideCacheEntry = {
  text: string;
  fetchedAt: number;
};

export type AiGuideCacheMap = Record<string, AiGuideCacheEntry>;

function storageKey(groupId: string): string {
  return `${AI_GUIDE_CACHE_KEY}:${groupId}`;
}

function parseMap(raw: string | null): AiGuideCacheMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: AiGuideCacheMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string' && v.length > 0) {
        // 구 sessionStorage: babyId → text
        out[k] = { text: v, fetchedAt: Date.now() };
        continue;
      }
      if (
        v &&
        typeof v === 'object' &&
        typeof (v as AiGuideCacheEntry).text === 'string' &&
        (v as AiGuideCacheEntry).text.length > 0
      ) {
        const fetchedAt = Number((v as AiGuideCacheEntry).fetchedAt);
        out[k] = {
          text: (v as AiGuideCacheEntry).text,
          fetchedAt: Number.isFinite(fetchedAt) ? fetchedAt : 0,
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** sessionStorage 구버전 → localStorage 1회 이전 */
function migrateSessionLegacy(groupId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const lsKey = storageKey(groupId);
    if (localStorage.getItem(lsKey)) return;
    const raw = sessionStorage.getItem(`${AI_GUIDE_CACHE_KEY}:${groupId}`);
    if (!raw) return;
    const map = parseMap(raw);
    if (Object.keys(map).length === 0) return;
    localStorage.setItem(lsKey, JSON.stringify(map));
    sessionStorage.removeItem(`${AI_GUIDE_CACHE_KEY}:${groupId}`);
  } catch {
    /* ignore */
  }
}

export function readAiGuideCache(groupId: string | null): AiGuideCacheMap {
  if (!groupId || typeof window === 'undefined') return {};
  try {
    migrateSessionLegacy(groupId);
    return parseMap(localStorage.getItem(storageKey(groupId)));
  } catch {
    return {};
  }
}

export function writeAiGuideCache(groupId: string | null, map: AiGuideCacheMap): void {
  if (!groupId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(groupId), JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function textsFromCache(map: AiGuideCacheMap): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, entry] of Object.entries(map)) {
    if (entry.text) out[id] = entry.text;
  }
  return out;
}

export function isAiGuideStale(fetchedAt: number | undefined, now = Date.now()): boolean {
  if (fetchedAt == null || !Number.isFinite(fetchedAt)) return true;
  return now - fetchedAt >= AI_GUIDE_REFRESH_MS;
}
