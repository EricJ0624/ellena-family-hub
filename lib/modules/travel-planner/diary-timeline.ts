import type { TravelDiaryEntry } from '@/lib/modules/travel-planner/diary-types';
import type { UnifiedItineraryItem } from '@/lib/modules/travel-planner/unified-itinerary';

export type DiaryTimelineSlot = {
  key: string;
  day_date: string;
  title: string;
  source_kind: UnifiedItineraryItem['kind'] | null;
  source_id: string | null;
  entry: TravelDiaryEntry | null;
};

function entryKey(e: TravelDiaryEntry): string {
  if (e.source_kind && e.source_id) return `${e.source_kind}:${e.source_id}`;
  return `entry:${e.id}`;
}

export function buildDiaryTimelineSlots(
  unified: UnifiedItineraryItem[],
  entries: TravelDiaryEntry[],
): DiaryTimelineSlot[] {
  const entryBySource = new Map<string, TravelDiaryEntry>();
  const orphanEntries: TravelDiaryEntry[] = [];

  for (const e of entries) {
    if (e.source_kind && e.source_id) {
      entryBySource.set(`${e.source_kind}:${e.source_id}`, e);
    } else {
      orphanEntries.push(e);
    }
  }

  const slots: DiaryTimelineSlot[] = unified.map((u) => {
    const k = `${u.kind}:${u.id}`;
    return {
      key: k,
      day_date: u.day_date,
      title: u.title,
      source_kind: u.kind,
      source_id: u.id,
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
      entry: e,
    });
  }

  slots.sort((a, b) => {
    if (a.day_date !== b.day_date) return a.day_date.localeCompare(b.day_date);
    return a.key.localeCompare(b.key);
  });

  return slots;
}
