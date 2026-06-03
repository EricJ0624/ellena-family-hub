import type { SupabaseClient } from '@supabase/supabase-js';
import { diaryInviteStatusOnCompletedTransition } from '@/lib/modules/travel-planner/diary-invite';
import {
  resolveAutoStatusForTrip,
  tripNeedsStatusPersist,
  normalizeTripStatus,
  type TripStatusFields,
  type TravelTripStatus,
} from '@/lib/modules/travel-planner/trip-status';

export type TravelTripRow = TripStatusFields & {
  id: string;
  group_id: string;
  diary_invite_status?: string | null;
  diary_enabled?: boolean | null;
  [key: string]: unknown;
};

/**
 * For auto trips: persist computed status when dates imply a change.
 * When transitioning to completed, set diary_invite_status=pending unless already accepted/dismissed.
 */
export async function enrichTripWithAutoStatus<T extends TravelTripRow>(
  supabase: SupabaseClient,
  trip: T,
): Promise<T> {
  const resolved = resolveAutoStatusForTrip(trip);
  const prevStatus = normalizeTripStatus(trip.status ?? undefined);
  const statusChanging = tripNeedsStatusPersist(trip, resolved);
  const inviteOnComplete =
    resolved === 'completed' && prevStatus !== 'completed'
      ? diaryInviteStatusOnCompletedTransition(trip.diary_invite_status)
      : null;

  if (!statusChanging && !inviteOnComplete) {
    return { ...trip, status: resolved };
  }

  const now = new Date().toISOString();
  const updatePayload: Record<string, unknown> = { updated_at: now };
  if (statusChanging) updatePayload.status = resolved;
  if (inviteOnComplete) updatePayload.diary_invite_status = inviteOnComplete;

  const { data, error } = await supabase
    .from('travel_trips')
    .update(updatePayload)
    .eq('id', trip.id)
    .eq('group_id', trip.group_id)
    .select('*')
    .single();

  if (error || !data) {
    return {
      ...trip,
      status: resolved as TravelTripStatus,
      ...(inviteOnComplete ? { diary_invite_status: inviteOnComplete } : {}),
    };
  }
  return data as T;
}

export async function enrichTripsWithAutoStatus<T extends TravelTripRow>(
  supabase: SupabaseClient,
  trips: T[],
): Promise<T[]> {
  return Promise.all(trips.map((t) => enrichTripWithAutoStatus(supabase, t)));
}
