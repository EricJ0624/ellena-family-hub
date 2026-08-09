import type { TravelEmergencyContacts, TravelPackingItem, TravelTrip } from './types';

export function defaultCoverBadge(startDate: string | null | undefined): string {
  const y = (startDate ?? '').slice(0, 4);
  return y ? `FAMILY VOYAGE ${y}` : 'FAMILY VOYAGE';
}

export function resolveCoverBadge(trip: Pick<TravelTrip, 'cover_badge' | 'start_date'>): string {
  const custom = trip.cover_badge?.trim();
  return custom || defaultCoverBadge(trip.start_date);
}

/** start/end inclusive → N박 (N+1)일 */
export function formatTripDurationKo(startDate: string, endDate: string): string {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startDate} ~ ${endDate}`;
  }
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const nights = Math.max(0, days - 1);
  const y = start.getFullYear();
  const m = start.getMonth() + 1;
  if (nights === 0) return `${y}년 ${m}월 (${days}일)`;
  return `${y}년 ${m}월 (${nights}박 ${days}일)`;
}

export function normalizeEmergencyContacts(
  value: TravelEmergencyContacts | null | undefined
): TravelEmergencyContacts {
  return {
    local: value?.local?.trim() || null,
    consular: value?.consular?.trim() || null,
    embassy: value?.embassy?.trim() || null,
  };
}

export function normalizePackingChecklist(
  value: TravelPackingItem[] | null | undefined
): TravelPackingItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, idx) => {
      const text = String(item?.text ?? '').trim();
      if (!text) return null;
      return {
        id: String(item?.id ?? `pack-${idx}`),
        category: String(item?.category ?? '').trim() || '기타',
        text,
        checked: Boolean(item?.checked),
      };
    })
    .filter(Boolean) as TravelPackingItem[];
}

export function buildAutoFlightSummary(
  transports: Array<{
    transport_type: string;
    departure?: string | null;
    arrival?: string | null;
    day_date?: string;
    end_day_date?: string | null;
  }>
): string | null {
  const airs = transports.filter((t) => t.transport_type === 'air');
  if (airs.length === 0) return null;
  const parts = airs.map((t) => {
    const from = (t.departure ?? '').trim() || '?';
    const to = (t.arrival ?? '').trim() || '?';
    return `${from} → ${to}`;
  });
  if (airs.length === 1) return parts[0] ?? null;
  if (airs.length === 2) return `가는 편 ${parts[0]} / 오는 편 ${parts[1]}`;
  return parts.join(' · ');
}
