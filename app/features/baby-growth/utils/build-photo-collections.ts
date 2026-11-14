import type { BabyPhoto } from '../types';

export type PhotoCollectionKind = 'day' | 'week' | 'month';

export type PhotoCollection = {
  id: string;
  kind: PhotoCollectionKind;
  /** 제목용 파라미터 (UI에서 번역 템플릿에 삽입) */
  titleParams: {
    date?: string;
    year?: number;
    month?: number;
    week?: number;
    monthAge?: number;
  };
  photos: BabyPhoto[];
  coverUrl: string;
  /** 최신 순간(ms) — 목록 정렬용 */
  newestAt: number;
};

const DAY_MIN = 2;
const WEEK_MIN = 3;
const MONTH_MIN = 2;

function momentDate(photo: BabyPhoto): Date {
  const raw = photo.takenAt ?? photo.createdAt;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date(photo.createdAt) : d;
}

function momentMs(photo: BabyPhoto): number {
  return momentDate(photo).getTime();
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** ISO 주차 (월요일 시작), 연도는 그 주의 목요일 기준 */
function isoWeekParts(d: Date): { year: number; week: number; month: number } {
  const tmp = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (tmp.getDay() + 6) % 7;
  tmp.setDate(tmp.getDate() - day + 3);
  const year = tmp.getFullYear();
  const week1 = new Date(year, 0, 4);
  const week1Day = (week1.getDay() + 6) % 7;
  week1.setDate(week1.getDate() - week1Day);
  const week = 1 + Math.round((tmp.getTime() - week1.getTime()) / 604800000);
  return { year, week, month: tmp.getMonth() + 1 };
}

function formatDisplayDate(d: Date): string {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/** dayKey `YYYY-MM-DD` → 표시용 날짜 */
function displayDateFromDayKey(dayKey: string): string {
  const [ys, ms, ds] = dayKey.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const day = Number(ds);
  if (!y || !m || !day) return dayKey;
  return formatDisplayDate(new Date(y, m - 1, day));
}

function sortHighlight(photos: BabyPhoto[]): BabyPhoto[] {
  return [...photos].sort((a, b) => momentMs(a) - momentMs(b));
}

function coverOf(sorted: BabyPhoto[]): string {
  const newest = sorted[sorted.length - 1]!;
  return newest.thumbnailUrl ?? newest.imageUrl;
}

export function shufflePhotos(photos: BabyPhoto[]): BabyPhoto[] {
  const items = [...photos];
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

export function orderCollectionPhotos(
  photos: BabyPhoto[],
  mode: 'highlight' | 'random',
): BabyPhoto[] {
  return mode === 'random' ? shufflePhotos(photos) : sortHighlight(photos);
}

/**
 * 연관 사진 모음집 자동 생성 (클라이언트 전용).
 * - 같은 날 2장+
 * - 같은 ISO 주 3장+
 * - 같은 월령 2장+
 */
export function buildPhotoCollections(photos: BabyPhoto[]): PhotoCollection[] {
  if (photos.length < DAY_MIN) return [];

  const byDay = new Map<string, BabyPhoto[]>();
  const byWeek = new Map<string, BabyPhoto[]>();
  const byMonth = new Map<number, BabyPhoto[]>();

  for (const photo of photos) {
    const d = momentDate(photo);
    const dayKey = ymd(d);
    const dayList = byDay.get(dayKey) ?? [];
    dayList.push(photo);
    byDay.set(dayKey, dayList);

    const { year, week } = isoWeekParts(d);
    const weekKey = `${year}-W${String(week).padStart(2, '0')}`;
    const weekList = byWeek.get(weekKey) ?? [];
    weekList.push(photo);
    byWeek.set(weekKey, weekList);

    if (photo.monthAge != null) {
      const monthList = byMonth.get(photo.monthAge) ?? [];
      monthList.push(photo);
      byMonth.set(photo.monthAge, monthList);
    }
  }

  const collections: PhotoCollection[] = [];

  for (const [dayKey, list] of byDay) {
    if (list.length < DAY_MIN) continue;
    const sorted = sortHighlight(list);
    collections.push({
      id: `day:${dayKey}`,
      kind: 'day',
      titleParams: { date: displayDateFromDayKey(dayKey) },
      photos: sorted,
      coverUrl: coverOf(sorted),
      newestAt: momentMs(sorted[sorted.length - 1]!),
    });
  }

  for (const [weekKey, list] of byWeek) {
    if (list.length < WEEK_MIN) continue;
    const sorted = sortHighlight(list);
    const { year, week, month } = isoWeekParts(momentDate(sorted[Math.floor(sorted.length / 2)]!));
    collections.push({
      id: `week:${weekKey}`,
      kind: 'week',
      titleParams: { year, month, week },
      photos: sorted,
      coverUrl: coverOf(sorted),
      newestAt: momentMs(sorted[sorted.length - 1]!),
    });
  }

  for (const [monthAge, list] of byMonth) {
    if (list.length < MONTH_MIN) continue;
    const sorted = sortHighlight(list);
    collections.push({
      id: `month:${monthAge}`,
      kind: 'month',
      titleParams: { monthAge },
      photos: sorted,
      coverUrl: coverOf(sorted),
      newestAt: momentMs(sorted[sorted.length - 1]!),
    });
  }

  return collections.sort((a, b) => b.newestAt - a.newestAt);
}

export function collectionTitle(
  collection: PhotoCollection,
  templates: {
    day: string;
    week: string;
    month: string;
  },
): string {
  const p = collection.titleParams;
  if (collection.kind === 'day') {
    return templates.day.replace('{date}', p.date ?? '');
  }
  if (collection.kind === 'week') {
    return templates.week
      .replace('{year}', String(p.year ?? ''))
      .replace('{month}', String(p.month ?? ''))
      .replace('{week}', String(p.week ?? ''));
  }
  return templates.month.replace('{n}', String(p.monthAge ?? ''));
}
