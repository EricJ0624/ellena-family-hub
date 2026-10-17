import { supabase } from '@/lib/supabase';

const cache = new Map<string, { url: string; exp: number }>();

function readExpiry(url: string): number {
  try {
    return Number(new URL(url, 'http://local').searchParams.get('e'));
  } catch {
    return 0;
  }
}

/** 그룹 확인을 통과한 사진만 짧은 표시 주소로 바꿉니다. 실패하면 원래 주소를 유지합니다. */
export async function signGroupAssetUrls(groupId: string, urls: string[]): Promise<Map<string, string>> {
  const now = Math.floor(Date.now() / 1000);
  const pending: string[] = [];
  const result = new Map<string, string>();

  for (const url of urls) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) continue;
    const hit = cache.get(`${groupId}:${url}`);
    if (hit && hit.exp - 120 > now) {
      result.set(url, hit.url);
      continue;
    }
    pending.push(url);
  }

  if (pending.length === 0) return result;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return result;

  const response = await fetch('/api/media/sign', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ groupId, urls: pending }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.urls || typeof json.urls !== 'object') return result;

  for (const [original, signed] of Object.entries(json.urls as Record<string, string>)) {
    if (typeof signed !== 'string') continue;
    const exp = readExpiry(signed);
    if (!Number.isFinite(exp) || exp <= now) continue;
    cache.set(`${groupId}:${original}`, { url: signed, exp });
    result.set(original, signed);
  }
  return result;
}
