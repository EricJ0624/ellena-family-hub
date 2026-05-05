import type {
  TravelAccommodation,
  TravelAttraction,
  TravelDining,
  TravelItinerary,
  TravelTransport,
} from '@/lib/modules/travel-planner/types';
import { buildTransportItineraryTitle } from '@/lib/modules/travel-planner/short-itinerary-title';

/** ISO YYYY-MM-DD 한 칸씩 (UTC 기준). */
export function addOneCalendarDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + 1));
  return dt.toISOString().slice(0, 10);
}

/** 시작~끝 포함한 날짜 목록 (ISO 문자열 비교 가능). */
export function inclusiveDateRange(from: string, to: string): string[] {
  if (!from || !to || from > to) return [];
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    if (cur === to) break;
    cur = addOneCalendarDay(cur);
  }
  return out;
}

/** 여행 기간 [start_date, end_date] 내이면 1부터, 아니면 null. */
export function tripDayNumber(displayDay: string, tripStart: string, tripEnd: string): number | null {
  if (displayDay < tripStart || displayDay > tripEnd) return null;
  let n = 1;
  let cur = tripStart;
  while (cur < displayDay) {
    cur = addOneCalendarDay(cur);
    n++;
  }
  return n;
}

export function enumerateTripDays(tripStart: string, tripEnd: string): string[] {
  return inclusiveDateRange(tripStart, tripEnd);
}

export type ExpandedPlannerItineraryItem = {
  rowKey: string;
  /** 그룹 헤더 및 정렬 기준 날짜 */
  display_day: string;
  trip_day_number: number | null;
  id: string;
  type: 'accommodation' | 'dining' | 'attraction' | 'transport' | 'other';
  start_time?: string | null;
  end_time?: string | null;
  title: string;
  description?: string | null;
  address?: string | null;
  place_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  category?: string | null;
  departure?: string | null;
  arrival?: string | null;
  distance_km?: number | null;
  transport_type?: 'air' | 'train' | 'car' | 'bike';
};

function sortTimeKey(st: string | null | undefined, en: string | null | undefined): string {
  const s = st && String(st).trim() ? String(st).trim().substring(0, 5) : '';
  const e = en && String(en).trim() ? String(en).trim().substring(0, 5) : '';
  if (s && e) return `${s}-${e}`;
  if (s) return `${s}-zz`;
  if (e) return `00:${e}`;
  return '12:00-mid';
}

function expandTimedRangeItem(params: {
  id: string;
  type: 'attraction' | 'transport' | 'other';
  day_date: string;
  end_day_date: string | null | undefined;
  start_time: string | null | undefined;
  end_time: string | null | undefined;
  title: string;
  description?: string | null;
  address?: string | null;
  place_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  departure?: string | null;
  arrival?: string | null;
  distance_km?: number | null;
  transport_type?: 'air' | 'train' | 'car' | 'bike';
  trip_start: string;
  trip_end: string;
}): ExpandedPlannerItineraryItem[] {
  const end = params.end_day_date && params.end_day_date >= params.day_date ? params.end_day_date : params.day_date;
  const days = inclusiveDateRange(params.day_date, end);
  const span = days.length;

  const out: ExpandedPlannerItineraryItem[] = [];
  for (let i = 0; i < days.length; i++) {
    const display_day = days[i]!;
    const isFirst = i === 0;
    const isLast = i === days.length - 1;
    let st: string | null = null;
    let en: string | null = null;
    if (span === 1) {
      st = params.start_time ?? null;
      en = params.end_time ?? null;
    } else {
      if (isFirst) st = params.start_time ?? null;
      if (isLast) en = params.end_time ?? null;
    }
    out.push({
      rowKey: `${params.type}:${params.id}:${display_day}`,
      display_day,
      trip_day_number: tripDayNumber(display_day, params.trip_start, params.trip_end),
      id: params.id,
      type: params.type === 'other' ? 'other' : params.type,
      start_time: st,
      end_time: en,
      title: params.title,
      description: params.description,
      address: params.address,
      place_id: params.place_id,
      latitude: params.latitude,
      longitude: params.longitude,
      departure: params.departure,
      arrival: params.arrival,
      distance_km: params.distance_km ?? null,
      transport_type: params.transport_type,
    });
  }
  return out;
}

function expandDiningItem(
  d: TravelDining,
  trip_start: string,
  trip_end: string,
): ExpandedPlannerItineraryItem[] {
  const end =
    d.end_day_date && d.end_day_date >= d.day_date ? d.end_day_date : d.day_date;
  const days = inclusiveDateRange(d.day_date, end);
  const span = days.length;
  const out: ExpandedPlannerItineraryItem[] = [];
  for (let i = 0; i < days.length; i++) {
    const display_day = days[i]!;
    const isFirst = i === 0;
    const isLast = i === days.length - 1;
    let st: string | null = null;
    let en: string | null = null;
    if (span === 1) {
      st = d.time_at ?? null;
    } else if (isFirst) {
      st = d.time_at ?? null;
    }
    void isLast;
    out.push({
      rowKey: `dining:${d.id}:${display_day}`,
      display_day,
      trip_day_number: tripDayNumber(display_day, trip_start, trip_end),
      id: d.id,
      type: 'dining',
      start_time: st,
      end_time: en,
      title: d.name,
      description: d.memo,
      address: d.address,
      place_id: d.place_id ?? null,
      latitude: d.latitude,
      longitude: d.longitude,
      category: d.category,
    });
  }
  return out;
}

function expandAccommodationItem(
  a: TravelAccommodation,
  trip_start: string,
  trip_end: string,
): ExpandedPlannerItineraryItem[] {
  const days = inclusiveDateRange(a.check_in_date, a.check_out_date);
  const span = days.length;
  const out: ExpandedPlannerItineraryItem[] = [];
  for (let i = 0; i < days.length; i++) {
    const display_day = days[i]!;
    const isFirst = i === 0;
    const isLast = i === days.length - 1;
    let st: string | null = null;
    let en: string | null = null;
    if (span === 1) {
      st = a.check_in_time ?? null;
      en = a.check_out_time ?? null;
    } else {
      if (isFirst) st = a.check_in_time ?? null;
      if (isLast) en = a.check_out_time ?? null;
    }
    out.push({
      rowKey: `accommodation:${a.id}:${display_day}`,
      display_day,
      trip_day_number: tripDayNumber(display_day, trip_start, trip_end),
      id: a.id,
      type: 'accommodation',
      start_time: st,
      end_time: en,
      title: a.name,
      description: a.memo,
      address: a.address,
      place_id: a.place_id ?? null,
      latitude: a.latitude,
      longitude: a.longitude,
    });
  }
  return out;
}

/**
 * 저장된 원본 레코드를 기준으로, 일별 헤더 아래 펼친 일정 목록을 만든다 (정렬 포함).
 */
export function buildExpandedPlannerItinerary(params: {
  trip_start_date: string;
  trip_end_date: string;
  accommodations: TravelAccommodation[];
  dining: TravelDining[];
  attractions: TravelAttraction[];
  transports: TravelTransport[];
  itineraries: TravelItinerary[];
}): ExpandedPlannerItineraryItem[] {
  const { trip_start_date, trip_end_date } = params;
  const rows: ExpandedPlannerItineraryItem[] = [];

  for (const a of params.accommodations.filter((x) => x.show_in_itinerary)) {
    rows.push(...expandAccommodationItem(a, trip_start_date, trip_end_date));
  }

  for (const d of params.dining.filter((x) => x.show_in_itinerary)) {
    rows.push(...expandDiningItem(d, trip_start_date, trip_end_date));
  }

  for (const a of params.attractions.filter((x) => x.show_in_itinerary)) {
    rows.push(
      ...expandTimedRangeItem({
        id: a.id,
        type: 'attraction',
        day_date: a.day_date,
        end_day_date: a.end_day_date ?? null,
        start_time: a.start_time,
        end_time: a.end_time,
        title: a.name,
        description: a.description,
        address: a.address,
        place_id: a.place_id ?? null,
        latitude: a.latitude,
        longitude: a.longitude,
        trip_start: trip_start_date,
        trip_end: trip_end_date,
      }),
    );
  }

  for (const t of params.transports.filter((x) => x.show_in_itinerary)) {
    const title = buildTransportItineraryTitle(t.departure, t.arrival) || (t.memo?.trim() ? t.memo.trim() : '—');
    rows.push(
      ...expandTimedRangeItem({
        id: t.id,
        type: 'transport',
        day_date: t.day_date,
        end_day_date: t.end_day_date ?? null,
        start_time: t.start_time,
        end_time: t.end_time,
        title,
        description: t.memo,
        departure: t.departure,
        arrival: t.arrival,
        distance_km: t.distance_km,
        transport_type: t.transport_type,
        trip_start: trip_start_date,
        trip_end: trip_end_date,
      }),
    );
  }

  for (const i of params.itineraries) {
    rows.push(
      ...expandTimedRangeItem({
        id: i.id,
        type: 'other',
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
        trip_start: trip_start_date,
        trip_end: trip_end_date,
      }),
    );
  }

  rows.sort((a, b) => {
    if (a.display_day !== b.display_day) return a.display_day.localeCompare(b.display_day);
    const tk = sortTimeKey(a.start_time, a.end_time).localeCompare(sortTimeKey(b.start_time, b.end_time));
    if (tk !== 0) return tk;
    return a.rowKey.localeCompare(b.rowKey);
  });

  return rows;
}

/** 여행 기간 안에 속한 표시 일만 헤더에 쓸 때, 기간 밖 일정 행 목록 분리용 */
export function partitionRowsByTripRange(
  rows: ExpandedPlannerItineraryItem[],
  trip_start: string,
  trip_end: string,
): { inTrip: ExpandedPlannerItineraryItem[]; outsideTrip: ExpandedPlannerItineraryItem[] } {
  const inTrip: ExpandedPlannerItineraryItem[] = [];
  const outsideTrip: ExpandedPlannerItineraryItem[] = [];
  for (const r of rows) {
    if (r.display_day >= trip_start && r.display_day <= trip_end) {
      inTrip.push(r);
    } else outsideTrip.push(r);
  }
  return { inTrip, outsideTrip };
}
