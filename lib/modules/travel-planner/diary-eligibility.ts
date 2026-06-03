import type { DiaryInviteStatus } from '@/lib/modules/travel-planner/diary-invite';
import { normalizeDiaryInviteStatus } from '@/lib/modules/travel-planner/diary-invite';
import type { TravelTripStatus } from '@/lib/modules/travel-planner/trip-status';
import { normalizeTripStatus } from '@/lib/modules/travel-planner/trip-status';

/**
 * Phase 2 gates (documented):
 * - Dashboard widget visible: widget_configs.travel_diary.is_enabled (+ trip/opt-in rules in phase 2)
 * - Trip write access: diary_enabled === true only
 * - Post-completion modal: shouldOfferDiaryCompletionPrompt
 */

export type DiaryEligibleTrip = {
  diary_enabled?: boolean | null;
  status?: TravelTripStatus | string | null;
  diary_invite_status?: DiaryInviteStatus | string | null;
};

/** Actual diary edit/save — only after explicit trip opt-in. */
export function canWriteDiary(trip: DiaryEligibleTrip): boolean {
  return trip.diary_enabled === true;
}

/** Planner / widget: user can opt in for this trip (any status). */
export function canUserOptInDiaryForTrip(trip: DiaryEligibleTrip): boolean {
  return trip.diary_enabled !== true;
}

/**
 * Phase 2 completion modal candidate: completed trip, not yet opted in, invite pending.
 * Falls back to completed && !diary_enabled when invite column missing (legacy rows = none).
 */
export function shouldOfferDiaryCompletionPrompt(trip: DiaryEligibleTrip): boolean {
  if (trip.diary_enabled === true) return false;
  if (normalizeTripStatus(trip.status ?? undefined) !== 'completed') return false;
  const invite = normalizeDiaryInviteStatus(trip.diary_invite_status);
  return invite === 'pending' || invite === 'none';
}

/** Completed trip, not opted in — planner hint (not shown for active/planning). */
export function showDiaryCompletedInviteHint(trip: DiaryEligibleTrip): boolean {
  return (
    normalizeTripStatus(trip.status ?? undefined) === 'completed' && trip.diary_enabled !== true
  );
}

/** @deprecated Use canUserOptInDiaryForTrip — planning-only start button */
export function canStartDiaryFromPlanning(trip: DiaryEligibleTrip): boolean {
  return (
    normalizeTripStatus(trip.status ?? undefined) === 'planning' && trip.diary_enabled !== true
  );
}

/** @deprecated Use showDiaryCompletedInviteHint */
export function showDiaryAvailableHint(trip: DiaryEligibleTrip): boolean {
  return showDiaryCompletedInviteHint(trip);
}
