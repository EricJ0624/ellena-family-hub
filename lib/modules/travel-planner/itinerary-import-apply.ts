import type { ParsedImportItem } from '@/lib/modules/travel-planner/itinerary-import-types';

const API_BASE = '/api/v1/travel';

type AuthHeaders = Record<string, string>;

export async function applyImportedItinerary(params: {
  groupId: string;
  tripId: string;
  items: ParsedImportItem[];
  headers: AuthHeaders;
}): Promise<void> {
  const { groupId, tripId, items, headers } = params;

  for (const item of items) {
    if (item.kind === 'accommodation') {
      const checkIn = item.check_in_date ?? item.day_date;
      if (!checkIn || !item.title.trim()) continue;
      const checkOut = item.check_out_date ?? checkIn;

      const res = await fetch(`${API_BASE}/trips/${tripId}/accommodations`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          groupId,
          name: item.title.trim(),
          check_in_date: checkIn,
          check_out_date: checkOut,
          address: item.address?.trim() || undefined,
          memo: item.description?.trim() || undefined,
          show_in_itinerary: true,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error || 'accommodation');
      }
      continue;
    }

    const dayDate = item.day_date;
    if (!dayDate || !item.title.trim()) continue;

    if (item.kind === 'dining') {
      const res = await fetch(`${API_BASE}/trips/${tripId}/dining`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          groupId,
          name: item.title.trim(),
          day_date: dayDate,
          end_day_date: item.end_day_date || undefined,
          time_at: item.start_time || undefined,
          memo: item.description?.trim() || undefined,
          address: item.address?.trim() || undefined,
          show_in_itinerary: true,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error || 'dining');
      }
      continue;
    }

    if (item.kind === 'attraction') {
      const res = await fetch(`${API_BASE}/trips/${tripId}/attractions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          groupId,
          name: item.title.trim(),
          day_date: dayDate,
          end_day_date: item.end_day_date || undefined,
          start_time: item.start_time || undefined,
          end_time: item.end_time || undefined,
          description: item.description?.trim() || undefined,
          address: item.address?.trim() || undefined,
          show_in_itinerary: true,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error || 'attraction');
      }
      continue;
    }

    if (item.kind === 'transport') {
      const res = await fetch(`${API_BASE}/trips/${tripId}/transports`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          groupId,
          transport_type: item.transport_type || 'car',
          day_date: dayDate,
          end_day_date: item.end_day_date || undefined,
          start_time: item.start_time || undefined,
          end_time: item.end_time || undefined,
          departure: item.departure?.trim() || undefined,
          arrival: item.arrival?.trim() || undefined,
          memo: item.description?.trim() || item.title.trim(),
          show_in_itinerary: true,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error || 'transport');
      }
      continue;
    }

    // other → travel_itineraries
    const res = await fetch(`${API_BASE}/trips/${tripId}/itineraries`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        groupId,
        day_date: dayDate,
        end_day_date: item.end_day_date || undefined,
        title: item.title.trim(),
        description: item.description?.trim() || undefined,
        start_time: item.start_time || undefined,
        end_time: item.end_time || undefined,
        address: item.address?.trim() || undefined,
      }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error((json as { error?: string }).error || 'itinerary');
    }
  }
}

export async function createTripFromImport(params: {
  groupId: string;
  title: string;
  destination?: string;
  start_date: string;
  end_date: string;
  budget?: number | null;
  currency?: string;
  headers: AuthHeaders;
}): Promise<string> {
  const { groupId, title, destination, start_date, end_date, budget, currency, headers } = params;
  const body: Record<string, unknown> = {
    groupId,
    title: title.trim(),
    destination: destination?.trim() || undefined,
    start_date,
    end_date,
  };
  if (currency) body.currency = currency.trim().toUpperCase();

  const res = await fetch(`${API_BASE}/trips`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as { error?: string }).error || 'trip create failed');
  }
  const id = (json as { data?: { id?: string } }).data?.id;
  if (!id) throw new Error('trip id missing');

  if (budget != null && !Number.isNaN(budget)) {
    await fetch(`${API_BASE}/trips/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        groupId,
        budget,
      }),
    });
  }

  return id;
}

export const IMPORT_PROMPT_TEMPLATE = `방콕 3박4일 4인 가족 일정 짜줘.
각 날짜별로 시간, 장소, 식사, 이동을 bullet로 써줘.
숙소는 날짜와 함께 따로 적어줘.`;
