/**
 * 가족 여행 플래너 모듈 타입 (Tenant = group_id)
 * 기존 DB 타입 수정 없이 전용 모듈에서만 사용.
 */

export type TravelTripStatus = 'planning' | 'active' | 'completed';
export type TravelTripStatusSource = 'auto' | 'manual';
export type DiaryInviteStatus = 'none' | 'pending' | 'accepted' | 'dismissed';

export interface TravelTrip {
  id: string;
  group_id: string;
  title: string;
  destination: string | null;
  start_date: string;
  end_date: string;
  /** planning | active | completed */
  status?: TravelTripStatus;
  /** auto: date-driven; manual: user override */
  status_source?: TravelTripStatusSource;
  /** User opted in to diary while still planning */
  diary_enabled?: boolean;
  /** Post-completion diary modal: none | pending | accepted | dismissed */
  diary_invite_status?: DiaryInviteStatus;
  /** 여행 기준 통화 (ISO 4217). 경비·예산 표시에 사용 */
  currency?: string;
  /** 여행 총 예산 (기준 통화). 잔액 = budget + 추가합계 - 지출합계 */
  budget?: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  updated_by?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
}

export type TravelPlaceSourceKind =
  | 'attraction'
  | 'dining'
  | 'accommodation'
  | 'transport'
  | 'itinerary';

export interface TravelPlaceFeedback {
  id: string;
  group_id: string;
  trip_id: string;
  source_kind: TravelPlaceSourceKind;
  source_id: string;
  rating: number | null;
  is_revisit: boolean | null;
  feedback_note: string | null;
  travel_expense_id: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
}

export interface TravelItinerary {
  id: string;
  trip_id: string;
  group_id: string;
  day_date: string;
  /** 며칠에 걸친 일정의 종료일(포함). 없으면 day_date 하루 */
  end_day_date?: string | null;
  title: string;
  description: string | null;
  sort_order: number;
  /** 시작 시간 'HH:mm' (선택) */
  start_time?: string | null;
  /** 종료 시간 'HH:mm' (선택) */
  end_time?: string | null;
  /** @deprecated 더 이상 사용 안 함 (레거시 호환용) */
  source_type?: string | null;
  /** @deprecated 더 이상 사용 안 함 (레거시 호환용) */
  source_id?: string | null;
  /** 항상 'other' 또는 null. 이제 기타 일정 전용 테이블 */
  place_type?: 'other' | null;
  /** 주소 (지도 표시용) */
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
}

export interface TravelExpense {
  id: string;
  trip_id: string;
  group_id: string;
  /** addition: 추가(입금), expense: 지출 */
  entry_type?: 'addition' | 'expense' | null;
  category: string | null;
  amount: number;
  currency: string;
  paid_by: string | null;
  memo: string | null;
  expense_date: string;
  source_kind?: TravelPlaceSourceKind | null;
  source_id?: string | null;
  diary_origin?: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
}

export type TravelTripInsert = Omit<TravelTrip, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type TravelItineraryInsert = Omit<TravelItinerary, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export interface TravelAccommodation {
  id: string;
  trip_id: string;
  group_id: string;
  name: string;
  check_in_date: string;
  check_out_date: string;
  /** 체크인 시각 HH:mm (선택) */
  check_in_time?: string | null;
  /** 체크아웃 시각 HH:mm (선택) */
  check_out_time?: string | null;
  address: string | null;
  memo: string | null;
  place_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** 일정 뷰에 표시 여부 */
  show_in_itinerary: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
}

export interface TravelDining {
  id: string;
  trip_id: string;
  group_id: string;
  name: string;
  day_date: string;
  /** 며칠에 걸친 경우 종료일(포함) */
  end_day_date?: string | null;
  time_at: string | null;
  category: string | null;
  memo: string | null;
  address: string | null;
  place_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** 일정 뷰에 표시 여부 */
  show_in_itinerary: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
}

export type TravelExpenseInsert = Omit<TravelExpense, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export interface TravelAttraction {
  id: string;
  trip_id: string;
  group_id: string;
  name: string;
  day_date: string;
  /** 며칠에 걸친 경우 종료일(포함) */
  end_day_date?: string | null;
  start_time: string | null;
  end_time: string | null;
  address: string | null;
  place_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  description: string | null;
  /** 일정 뷰에 표시 여부 */
  show_in_itinerary: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
}

export interface TravelTransport {
  id: string;
  trip_id: string;
  group_id: string;
  /** air(비행기), train(기차), car(자동차), bike(바이크) */
  transport_type: 'air' | 'train' | 'car' | 'bike';
  day_date: string;
  /** 며칠에 걸친 경우 종료일(포함) */
  end_day_date?: string | null;
  start_time: string | null;
  end_time: string | null;
  departure: string | null;
  arrival: string | null;
  /** 출발지 Place ID (자동완성 선택 시) */
  departure_place_id?: string | null;
  /** 도착지 Place ID (자동완성 선택 시) */
  arrival_place_id?: string | null;
  /** 이동 거리(km) */
  distance_km: number | null;
  memo: string | null;
  /** 일정 뷰에 표시 여부 */
  show_in_itinerary: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
}
