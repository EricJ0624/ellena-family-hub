import { supabase } from '@/lib/supabase';
import { waitForSupabaseSession } from '@/lib/supabase-session-ready';
import type { BabyPhoto } from '../types';

export type ListBabyPhotosOptions = {
  groupId: string;
  babyId: string;
  birthDate?: string | null;
  limit?: number;
};

export type BabyWidgetPhotoSource =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'other_years'
  | 'fallback'
  | 'none';

export type BabyWidgetPhotoResult = {
  photos: BabyPhoto[];
  source: BabyWidgetPhotoSource;
};

const WIDGET_SLIDER_LIMIT = 8;

function monthAgeAt(birthDate: string, takenAt: string): number {
  const birth = new Date(birthDate);
  const taken = new Date(takenAt);
  let months = (taken.getFullYear() - birth.getFullYear()) * 12;
  months += taken.getMonth() - birth.getMonth();
  if (taken.getDate() < birth.getDate()) months -= 1;
  return Math.max(0, months);
}

type AttachmentRow = {
  id: string;
  image_url: string | null;
  thumbnail_url: string | null;
  mime_type: string | null;
  feature_type: string | null;
  created_at: string;
  taken_at: string | null;
};

type MappedPhoto = BabyPhoto & { year: number; momentAt: number };

export const BABY_PHOTOS_CHANGED = 'sfh:baby-photos-changed';

export function notifyBabyPhotosChanged(babyId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(BABY_PHOTOS_CHANGED, { detail: { babyId } }));
}

function isBabyImageRow(row: AttachmentRow): boolean {
  if (row.feature_type && row.feature_type !== 'baby_growth') return false;
  if (!row.mime_type?.startsWith('image/')) return false;
  if (!row.image_url || row.image_url === 'expired') return false;
  return true;
}

function mapRow(row: AttachmentRow, birthDate?: string | null): MappedPhoto {
  const shotAt = row.taken_at && !Number.isNaN(new Date(row.taken_at).getTime()) ? row.taken_at : null;
  const yearSource = shotAt ?? row.created_at;
  const yearDate = new Date(yearSource);
  const year = yearDate.getFullYear();
  return {
    id: row.id,
    imageUrl: row.image_url ?? '',
    thumbnailUrl: row.thumbnail_url?.startsWith('/api/media/file') ? row.thumbnail_url : null,
    takenAt: shotAt,
    monthAge: shotAt && birthDate ? monthAgeAt(birthDate, shotAt) : null,
    createdAt: row.created_at,
    year: Number.isFinite(year) ? year : new Date(row.created_at).getFullYear(),
    momentAt: yearDate.getTime(),
  };
}

function stripMeta(photo: MappedPhoto): BabyPhoto {
  return {
    id: photo.id,
    imageUrl: photo.imageUrl,
    thumbnailUrl: photo.thumbnailUrl,
    takenAt: photo.takenAt,
    monthAge: photo.monthAge,
    createdAt: photo.createdAt,
  };
}

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
  return items;
}

function todayBounds(): { start: number; end: number } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start: start.getTime(), end: end.getTime() };
}

/** 로컬 주 시작(월요일 0시) */
function weekStartMs(now = new Date()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=일
  const offset = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - offset);
  return d.getTime();
}

function monthStartMs(now = new Date()): number {
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function pickRandom(photos: MappedPhoto[], limit: number): MappedPhoto[] {
  return shuffleInPlace([...photos]).slice(0, limit);
}

/** 낮은 연도 → 높은 연도 라운드로빈으로 최대 limit장 */
function pickOtherYearsAscending(photos: MappedPhoto[], currentYear: number, limit: number): MappedPhoto[] {
  const byYear = new Map<number, MappedPhoto[]>();
  for (const photo of photos) {
    if (photo.year >= currentYear) continue;
    const list = byYear.get(photo.year) ?? [];
    list.push(photo);
    byYear.set(photo.year, list);
  }
  const years = [...byYear.keys()].sort((a, b) => a - b);
  if (years.length === 0) return [];

  for (const year of years) {
    shuffleInPlace(byYear.get(year)!);
  }

  const picked: MappedPhoto[] = [];
  let guard = 0;
  while (picked.length < limit && guard < limit * years.length + 8) {
    let added = false;
    for (const year of years) {
      const bucket = byYear.get(year);
      if (!bucket || bucket.length === 0) continue;
      picked.push(bucket.shift()!);
      added = true;
      if (picked.length >= limit) break;
    }
    if (!added) break;
    guard += 1;
  }
  return picked;
}

async function fetchBabyAttachmentRows(opts: {
  groupId: string;
  babyId: string;
}): Promise<AttachmentRow[]> {
  const session = await waitForSupabaseSession(supabase);
  if (!session?.access_token) return [];

  const params = new URLSearchParams({
    groupId: opts.groupId,
    entityType: 'baby_profile',
    entityId: opts.babyId,
  });
  const response = await fetch(`/api/attachments?${params}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) return [];
  const json = (await response.json().catch(() => ({}))) as { data?: AttachmentRow[] };
  return Array.isArray(json.data) ? json.data : [];
}

/** baby_growth 첨부 사진 목록. 표시 주소는 첨부 API가 발급한 짧은 주소를 쓴다. */
export async function listBabyPhotos(opts: ListBabyPhotosOptions): Promise<BabyPhoto[]> {
  const rows = await fetchBabyAttachmentRows(opts);
  const photos = rows
    .filter(isBabyImageRow)
    .map((row) => mapRow(row, opts.birthDate))
    .reverse()
    .map(stripMeta);

  return photos.slice(0, opts.limit ?? 200);
}

/**
 * 아기 위젯 전용 슬라이더 목록.
 * 최근성(오늘/주/달)은 업로드일(created_at) 기준 — 자정 지나면 오늘→이번 주로 자연스럽게 넘어감.
 * 다른 해는 촬영일(taken_at) 연도 기준 추억 폴백.
 */
export async function listBabyWidgetSliderPhotos(opts: {
  groupId: string;
  babyId: string;
  birthDate?: string | null;
  limit?: number;
}): Promise<BabyWidgetPhotoResult> {
  const limit = opts.limit ?? WIDGET_SLIDER_LIMIT;
  const rows = await fetchBabyAttachmentRows(opts);
  const mapped = rows.filter(isBabyImageRow).map((row) => mapRow(row, opts.birthDate));
  const { start: todayStart, end: todayEnd } = todayBounds();
  const weekStart = weekStartMs();
  const monthStart = monthStartMs();
  const currentYear = new Date().getFullYear();

  const uploadedAtMs = (p: MappedPhoto) => new Date(p.createdAt).getTime();

  const isTodayUpload = (p: MappedPhoto) => {
    const uploadedAt = uploadedAtMs(p);
    return uploadedAt >= todayStart && uploadedAt <= todayEnd;
  };

  const today = mapped.filter(isTodayUpload);
  if (today.length > 0) {
    return {
      photos: today.slice(0, limit).map(stripMeta),
      source: 'today',
    };
  }

  const notTodayUpload = mapped.filter((p) => !isTodayUpload(p));

  // 이번 주/달도 업로드일 기준 (촬영 EXIF가 예전 연도여도 어제 올렸으면 이번 주)
  const thisWeek = notTodayUpload.filter((p) => {
    const at = uploadedAtMs(p);
    return at >= weekStart && at <= todayEnd;
  });
  if (thisWeek.length > 0) {
    return {
      photos: pickRandom(thisWeek, limit).map(stripMeta),
      source: 'this_week',
    };
  }

  const thisMonth = notTodayUpload.filter((p) => {
    const at = uploadedAtMs(p);
    return at >= monthStart && at <= todayEnd;
  });
  if (thisMonth.length > 0) {
    return {
      photos: pickRandom(thisMonth, limit).map(stripMeta),
      source: 'this_month',
    };
  }

  const otherYears = pickOtherYearsAscending(mapped, currentYear, limit);
  if (otherYears.length > 0) {
    return {
      photos: otherYears.map(stripMeta),
      source: 'other_years',
    };
  }

  const fallback = pickRandom(notTodayUpload, limit);
  if (fallback.length === 0) {
    return { photos: [], source: 'none' };
  }
  return {
    photos: fallback.map(stripMeta),
    source: 'fallback',
  };
}
