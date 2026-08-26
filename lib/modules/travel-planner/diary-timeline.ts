import type { TravelDiaryEntry } from '@/lib/modules/travel-planner/diary-types';
import type { UnifiedItineraryItem } from '@/lib/modules/travel-planner/unified-itinerary';
import { isDiaryPurgedEntry } from '@/lib/modules/travel-planner/diary-purge';

export type DiaryTimelineSlot = {
  key: string;
  day_date: string;
  title: string;
  source_kind: UnifiedItineraryItem['kind'] | null;
  source_id: string | null;
  address?: string | null;
  place_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  entry: TravelDiaryEntry | null;
};

function entryKey(e: TravelDiaryEntry): string {
  if (e.source_kind && e.source_id) return `${e.source_kind}:${e.source_id}`;
  return `entry:${e.id}`;
}

function sourceKey(kind: string | null | undefined, id: string | null | undefined): string | null {
  if (!kind || !id) return null;
  return `${kind}:${id}`;
}

export function buildDiaryTimelineSlots(
  unified: UnifiedItineraryItem[],
  entries: TravelDiaryEntry[],
  hiddenEntries: TravelDiaryEntry[] = [],
): DiaryTimelineSlot[] {
  const hiddenKeys = new Set(
    hiddenEntries
      .map((e) => sourceKey(e.source_kind, e.source_id))
      .filter((k): k is string => Boolean(k)),
  );
  const entryBySource = new Map<string, TravelDiaryEntry>();
  const orphanEntries: TravelDiaryEntry[] = [];

  for (const e of entries) {
    if (e.deleted_at) continue;
    if (e.source_kind && e.source_id) {
      entryBySource.set(`${e.source_kind}:${e.source_id}`, e);
    } else {
      orphanEntries.push(e);
    }
  }

  const slots: DiaryTimelineSlot[] = unified
    .filter((u) => !hiddenKeys.has(`${u.kind}:${u.id}`))
    .map((u) => {
    const k = `${u.kind}:${u.id}`;
    return {
      key: k,
      day_date: u.day_date,
      title: u.title,
      source_kind: u.kind,
      source_id: u.id,
      address: u.address ?? null,
      place_id: u.place_id ?? null,
      latitude: u.latitude ?? null,
      longitude: u.longitude ?? null,
      entry: entryBySource.get(k) ?? null,
    };
  });

  for (const e of orphanEntries) {
    slots.push({
      key: entryKey(e),
      day_date: e.day_date,
      title: e.note?.trim() || '—',
      source_kind: null,
      source_id: null,
      address: null,
      place_id: null,
      latitude: null,
      longitude: null,
      entry: e,
    });
  }

  slots.sort((a, b) => {
    if (a.day_date !== b.day_date) return a.day_date.localeCompare(b.day_date);
    return a.key.localeCompare(b.key);
  });

  return slots;
}

/** Hidden diary cards for restore list (planner place title preferred).
 * 전체삭제(purge)된 항목은 복구 목록에서 제외 — 타임라인 제외용 hiddenKeys에는 그대로 쓰임.
 */
export function buildHiddenDiarySlots(
  unified: UnifiedItineraryItem[],
  hiddenEntries: TravelDiaryEntry[],
): DiaryTimelineSlot[] {
  const unifiedBySource = new Map<string, UnifiedItineraryItem>();
  for (const u of unified) {
    unifiedBySource.set(`${u.kind}:${u.id}`, u);
  }

  const slots: DiaryTimelineSlot[] = [];
  const seen = new Set<string>();

  for (const e of hiddenEntries) {
    if (!e.deleted_at) continue;
    if (isDiaryPurgedEntry(e)) continue;
    const k = sourceKey(e.source_kind, e.source_id) ?? `entry:${e.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const u = e.source_kind && e.source_id ? unifiedBySource.get(`${e.source_kind}:${e.source_id}`) : undefined;
    slots.push({
      key: `hidden:${e.id}`,
      day_date: u?.day_date ?? e.day_date,
      title: (u?.title ?? e.note?.trim()) || '—',
      source_kind: (u?.kind ?? e.source_kind) as DiaryTimelineSlot['source_kind'],
      source_id: u?.id ?? e.source_id,
      address: u?.address ?? null,
      place_id: u?.place_id ?? null,
      latitude: u?.latitude ?? null,
      longitude: u?.longitude ?? null,
      entry: e,
    });
  }

  slots.sort((a, b) => {
    if (a.day_date !== b.day_date) return a.day_date.localeCompare(b.day_date);
    return a.key.localeCompare(b.key);
  });

  return slots;
}
