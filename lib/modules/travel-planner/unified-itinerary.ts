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
  place_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  field_record_kind?: 'checkin' | 'route' | null;
  field_track_id?: string | null;
  transport_type?: 'air' | 'train' | 'car' | 'bike';
  show_in_itinerary: boolean;
};

/** Same-day order when start_time is missing — arrival/이동이 숙소·식사보다 앞에 오도록 */
const KIND_ORDER: Record<UnifiedItineraryKind, number> = {
  transport: 0,
  attraction: 1,
  itinerary: 2,
  dining: 3,
  accommodation: 4,
};

function effectiveSortTime(item: Pick<UnifiedItineraryItem, 'start_time' | 'title' | 'kind'>): string {
  const raw = item.start_time && String(item.start_time).trim();
  if (raw) return raw.substring(0, 5);
  const title = item.title || '';
  if (item.kind === 'transport' && /공항|airport/i.test(title) && /도착|arrival/i.test(title)) {
    return '06:00';
  }
  if (item.kind === 'transport' && /공항|airport/i.test(title) && /출발|departure|체크아웃/i.test(title)) {
    return '21:00';
  }
  return '12:00';
}

export function compareUnifiedItineraryOrder(
  a: Pick<UnifiedItineraryItem, 'day_date' | 'start_time' | 'title' | 'kind' | 'id'>,
  b: Pick<UnifiedItineraryItem, 'day_date' | 'start_time' | 'title' | 'kind' | 'id'>,
): number {
  if (a.day_date !== b.day_date) return a.day_date.localeCompare(b.day_date);
  const ta = effectiveSortTime(a);
  const tb = effectiveSortTime(b);
  if (ta !== tb) return ta.localeCompare(tb);
  const ka = KIND_ORDER[a.kind] ?? 9;
  const kb = KIND_ORDER[b.kind] ?? 9;
  if (ka !== kb) return ka - kb;
  return String(a.id).localeCompare(String(b.id));
}

function sortUnifiedItems(a: UnifiedItineraryItem, b: UnifiedItineraryItem): number {
  return compareUnifiedItineraryOrder(a, b);
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
      place_id: a.place_id,
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
      place_id: d.place_id,
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
      place_id: a.place_id,
      latitude: a.latitude,
      longitude: a.longitude,
      show_in_itinerary: a.show_in_itinerary,
    });
  }

  const transportFilter = visibleOnly
    ? params.transports.filter((x) => x.show_in_itinerary)
    : params.transports;
  for (const t of transportFilter) {
    const title =
      buildTransportItineraryTitle(t.departure, t.arrival) ||
      (t.memo?.trim() ? t.memo.trim() : '—');
    const arrivalLabel = typeof t.arrival === 'string' ? t.arrival.trim() : '';
    const departureLabel = typeof t.departure === 'string' ? t.departure.trim() : '';
    rows.push({
      id: t.id,
      kind: 'transport',
      day_date: t.day_date,
      end_day_date: t.end_day_date ?? null,
      start_time: t.start_time,
      end_time: t.end_time,
      title,
      description: t.memo,
      address: arrivalLabel || departureLabel || null,
      place_id: t.arrival_place_id || t.departure_place_id || null,
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
      place_id: null,
      latitude: i.latitude,
      longitude: i.longitude,
      field_record_kind: i.field_record_kind ?? null,
      field_track_id: i.field_track_id ?? null,
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
