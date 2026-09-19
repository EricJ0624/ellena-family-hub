import type { TravelTrip } from '@/lib/modules/travel-planner/types';

/** 플래너 목록·위젯에 보일 여행 (다이어리 전용 보관본 제외) */
export function isTripVisibleInPlanner(
  trip: Pick<TravelTrip, 'deleted_at' | 'planner_hidden_at'> | {
    deleted_at?: string | null;
    planner_hidden_at?: string | null;
  },
): boolean {
  return !trip.deleted_at && !trip.planner_hidden_at;
}
