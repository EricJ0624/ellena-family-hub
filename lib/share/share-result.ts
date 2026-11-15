/**
 * 기기 공유 시트. 클릭 핸들러에서만 호출한다.
 * 공개 링크는 만들지 않고, 글에서 URL·API 경로는 뺀다.
 */

import type { LangCode } from '@/lib/language-fonts';

const SHARE_LABEL: Record<LangCode, string> = {
  ko: '공유',
  en: 'Share',
  ja: '共有',
  'zh-CN': '分享',
  'zh-TW': '分享',
  es: 'Compartir',
  fr: 'Partager',
  de: 'Teilen',
  it: 'Condividi',
  pt: 'Partilhar',
};

export function shareButtonLabel(lang: LangCode): string {
  return SHARE_LABEL[lang];
}

const MAX_FILES = 8;
const MAX_IMAGE_BYTES = 18 * 1024 * 1024;

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

function safeTitle(raw: string): string {
  const cleaned = raw
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, 80);
  return cleaned || 'Ellena';
}

function safeText(raw: string): string {
  return raw
    .split('\n')
    .map((line) => line.replace(/https?:\/\/\S+/gi, '').replace(/\/api\/\S+/g, '').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 3500);
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function shareResult(opts: {
  title: string;
  text?: string;
  files?: File[];
}): Promise<'shared' | 'copied' | 'downloaded' | 'cancelled'> {
  const title = safeTitle(opts.title);
  const text = safeText(opts.text ?? '');
  const files = (opts.files ?? []).filter((file) => file.size > 0).slice(0, MAX_FILES);

  if (files.length > 0 && typeof navigator.share === 'function') {
    let count = files.length;
    while (count >= 1) {
      const batch = files.slice(0, count);
      const payload: ShareData = { title, files: batch };
      if (text) payload.text = text;
      const canTry =
        typeof navigator.canShare !== 'function' ? count === files.length : navigator.canShare(payload);
      if (!canTry) {
        count = Math.floor(count / 2);
        continue;
      }
      try {
        await navigator.share(payload);
        return 'shared';
      } catch (err) {
        if (isAbort(err)) return 'cancelled';
        break;
      }
    }
  }

  if (files.length > 0) {
    for (const file of files) downloadFile(file);
    return 'downloaded';
  }

  if (text && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch (err) {
      if (isAbort(err)) return 'cancelled';
    }
  }

  if (text && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      /* 클립보드를 쓸 수 없으면 조용히 끝낸다 */
    }
  }
  return 'cancelled';
}

/** 이미 로그인한 화면의 사진을 파일로만 만든다. 주소는 공유 글에 넣지 않는다. */
export async function imageFilesFromUrls(urls: string[]): Promise<File[]> {
  const files: File[] = [];
  let total = 0;
  const seen = new Set<string>();
  for (const raw of urls) {
    if (files.length >= MAX_FILES) break;
    const url = raw.trim();
    if (!url || url === 'expired' || seen.has(url)) continue;
    seen.add(url);
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) continue;
      const blob = await res.blob();
      if (!blob.type.startsWith('image/') || blob.size <= 0) continue;
      if (total + blob.size > MAX_IMAGE_BYTES) continue;
      total += blob.size;
      const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
      files.push(new File([blob], `photo-${files.length + 1}.${ext}`, { type: blob.type }));
    } catch {
      /* 한 장이 실패해도 나머지는 공유한다 */
    }
  }
  return files;
}
