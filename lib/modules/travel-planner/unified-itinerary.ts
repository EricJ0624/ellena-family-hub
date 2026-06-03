import type {
  TravelAccommodation,
  TravelAttraction,
  TravelDining,
  TravelItinerary,
  TravelTransport,
} from '@/lib/modules/travel-planner/types';
import { buildTransportItineraryTitle } from '@/lib/modules/travel-planner/short-itinerary-title';

/** DB/API source_kind for place feedback & expense linkage */
export type TravelPlaceSourceKind =
  | 'attraction'
  | 'dining'
  | 'accommodation'
  | 'transport'
  | 'itinerary';

export type UnifiedItineraryKind = TravelPlaceSourceKind;

export type UnifiedItineraryItem = {
  id: string;
  kind: UnifiedItineraryKind;
  day_date: string;
  end_day_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  title: string;
  description?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  transport_type?: 'air' | 'train' | 'car' | 'bike';
  show_in_itinerary: boolean;
};

function sortUnifiedItems(a: UnifiedItineraryItem, b: UnifiedItineraryItem): number {
  if (a.day_date !== b.day_date) return a.day_date.localeCompare(b.day_date);
  const st = (t: string | null | undefined) => (t && String(t).trim() ? String(t).trim().substring(0, 5) : '12:00');
  const ta = st(a.start_time);
  const tb = st(b.start_time);
  if (ta !== tb) return ta.localeCompare(tb);
  return `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`);
}

/**
 * One row per planner entity (not per expanded calendar day).
 * Diary scaffolding & place-feedback use source_kind + source_id from this list.
 */
export function buildUnifiedItineraries(params: {
  accommodations: TravelAccommodation[];
  dining: TravelDining[];
  attractions: TravelAttraction[];
  transports: TravelTransport[];
  itineraries: TravelItinerary[];
  /** If true, only show_in_itinerary rows (default). Set false for diary to include all places. */
  itineraryVisibleOnly?: boolean;
}): UnifiedItineraryItem[] {
  const visibleOnly = params.itineraryVisibleOnly !== false;
  const rows: UnifiedItineraryItem[] = [];

  const accFilter = visibleOnly
    ? params.accommodations.filter((x) => x.show_in_itinerary)
    : params.accommodations;
  for (const a of accFilter) {
    rows.push({
      id: a.id,
      kind: 'accommodation',
      day_date: a.check_in_date,
      end_day_date: a.check_out_date,
      start_time: a.check_in_time ?? null,
      end_time: a.check_out_time ?? null,
      title: a.name,
      description: a.memo,
      address: a.address,
      latitude: a.latitude,
      longitude: a.longitude,
      show_in_itinerary: a.show_in_itinerary,
    });
  }

  const diningFilter = visibleOnly ? params.dining.filter((x) => x.show_in_itinerary) : params.dining;
  for (const d of diningFilter) {
    rows.push({
      id: d.id,
      kind: 'dining',
      day_date: d.day_date,
      end_day_date: d.end_day_date ?? null,
      start_time: d.time_at,
      end_time: null,
      title: d.name,
      description: d.memo,
      address: d.address,
      latitude: d.latitude,
      longitude: d.longitude,
      show_in_itinerary: d.show_in_itinerary,
    });
  }

  const attrFilter = visibleOnly
    ? params.attractions.filter((x) => x.show_in_itinerary)
    : params.attractions;
  for (const a of attrFilter) {
    rows.push({
      id: a.id,
      kind: 'attraction',
      day_date: a.day_date,
      end_day_date: a.end_day_date ?? null,
      start_time: a.start_time,
      end_time: a.end_time,
      title: a.name,
      description: a.description,
      address: a.address,
      latitude: a.latitude,
      longitude: a.longitude,
      show_in_itinerary: a.show_in_itinerary,
    });
  }

  const transportFilter = visibleOnly
    ? params.transports.filter((x) => x.show_in_itinerary)
    : params.transports;
  for (const t of transportFilter) {
    const title = buildTransportItineraryTitle(t.departure, t.arrival) || (t.memo?.trim() ? t.memo.trim() : '—');
    rows.push({
      id: t.id,
      kind: 'transport',
      day_date: t.day_date,
      end_day_date: t.end_day_date ?? null,
      start_time: t.start_time,
      end_time: t.end_time,
      title,
      description: t.memo,
      address: null,
      latitude: null,
      longitude: null,
      transport_type: t.transport_type,
      show_in_itinerary: t.show_in_itinerary,
    });
  }

  for (const i of params.itineraries) {
    rows.push({
      id: i.id,
      kind: 'itinerary',
      day_date: i.day_date,
      end_day_date: i.end_day_date ?? null,
      start_time: i.start_time,
      end_time: i.end_time,
      title: i.title,
      description: i.description,
      address: i.address,
      latitude: i.latitude,
      longitude: i.longitude,
      show_in_itinerary: true,
    });
  }

  rows.sort(sortUnifiedItems);
  return rows;
}

export function defaultExpenseCategoryForKind(kind: TravelPlaceSourceKind): string {
  switch (kind) {
    case 'dining':
      return '식사';
    case 'accommodation':
      return '숙소';
    case 'attraction':
      return '관광';
    case 'transport':
      return '교통';
    case 'itinerary':
    default:
      return '기타';
  }
}

export function findUnifiedPlace(
  items: UnifiedItineraryItem[],
  sourceKind: TravelPlaceSourceKind,
  sourceId: string,
): UnifiedItineraryItem | undefined {
  return items.find((x) => x.kind === sourceKind && x.id === sourceId);
}
