/**
 * Trip status: planning | active | completed
 * Uses local calendar date (YYYY-MM-DD) to match HTML date inputs on travel forms.
 */

export type TravelTripStatus = 'planning' | 'active' | 'completed';
export type TravelTripStatusSource = 'auto' | 'manual';

export type TripStatusFields = {
  start_date: string;
  end_date: string;
  status?: TravelTripStatus | string | null;
  status_source?: TravelTripStatusSource | string | null;
};

/** Local calendar today as ISO date (not UTC). */
export function localTodayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function computeAutoTripStatus(
  startDate: string,
  endDate: string,
  todayYmd: string = localTodayYmd(),
): TravelTripStatus {
  const start = String(startDate).slice(0, 10);
  const end = String(endDate).slice(0, 10);
  if (todayYmd < start) return 'planning';
  if (todayYmd > end) return 'completed';
  return 'active';
}

export function normalizeTripStatus(raw: string | null | undefined): TravelTripStatus {
  if (raw === 'active' || raw === 'completed') return raw;
  return 'planning';
}

export function normalizeStatusSource(raw: string | null | undefined): TravelTripStatusSource {
  return raw === 'manual' ? 'manual' : 'auto';
}

/**
 * If status_source is auto, returns the status that should be stored.
 * Does not mutate manual trips.
 */
export function resolveAutoStatusForTrip(trip: TripStatusFields): TravelTripStatus {
  if (normalizeStatusSource(trip.status_source) === 'manual') {
    return normalizeTripStatus(trip.status);
  }
  return computeAutoTripStatus(trip.start_date, trip.end_date);
}

export function tripNeedsStatusPersist(
  trip: TripStatusFields & { status?: TravelTripStatus | string | null },
  resolved: TravelTripStatus,
): boolean {
  return normalizeStatusSource(trip.status_source) === 'auto' && normalizeTripStatus(trip.status) !== resolved;
}
