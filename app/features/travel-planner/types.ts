/**
 * Travel Planner 타입 정의 (대시보드·훅용 경량 타입)
 */

import type {
  DiaryInviteStatus,
  TravelTripStatus,
  TravelTripStatusSource,
} from '@/lib/modules/travel-planner/types';

export type { DiaryInviteStatus, TravelTripStatus, TravelTripStatusSource };

export interface TravelTrip {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  destination?: string | null;
  status?: TravelTripStatus;
  status_source?: TravelTripStatusSource;
  diary_enabled?: boolean;
  diary_invite_status?: DiaryInviteStatus;
  currency?: string;
  budget?: number | null;
}
