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
  const countries = Array.isArray(value?.countries)
    ? value!.countries!
        .map((c) => {
          const code = String(c?.code ?? '').trim();
          const local = String(c?.local ?? '').trim();
          const embassy = String(c?.embassy ?? '').trim();
          if (!code || (!local && !embassy)) return null;
          return {
            code,
            nameKo: String(c?.nameKo ?? '').trim() || code,
            local: local || '—',
            embassy: embassy || '—',
          };
        })
        .filter(Boolean)
    : [];
  return {
    local: value?.local?.trim() || null,
    consular: value?.consular?.trim() || null,
    embassy: value?.embassy?.trim() || null,
    countries: countries.length ? (countries as TravelEmergencyContacts['countries']) : [],
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
    start_time?: string | null;
    end_time?: string | null;
    memo?: string | null;
  }>
): string | null {
  const airs = transports.filter((t) => t.transport_type === 'air');
  if (airs.length === 0) return null;
  const parts = airs.map((t) => {
    const from = (t.departure ?? '').trim() || '?';
    const to = (t.arrival ?? '').trim() || '?';
    const timeBits = [t.start_time, t.end_time].filter(Boolean).join('–');
    const memo = (t.memo ?? '').trim();
    const core = `${from} → ${to}`;
    if (timeBits && memo) return `${core} (${timeBits}, ${memo})`;
    if (timeBits) return `${core} (${timeBits})`;
    if (memo) return `${core} (${memo})`;
    return core;
  });
  if (airs.length === 1) return parts[0] ?? null;
  if (airs.length === 2) return `가는 편 ${parts[0]} / 오는 편 ${parts[1]}`;
  return parts.join(' · ');
}

/** 그룹 멤버 표시명 → 일정표 TRAVELERS 한 줄 */
export function formatTravelersFromNames(names: string[]): string {
  const cleaned = names.map((n) => n.trim()).filter(Boolean);
  return cleaned.join(', ');
}
