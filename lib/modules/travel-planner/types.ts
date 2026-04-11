/**
 * 가족 여행 플래너 모듈 타입 (Tenant = group_id)
 * 기존 DB 타입 수정 없이 전용 모듈에서만 사용.
 */

export interface TravelTrip {
  id: string;
  group_id: string;
  title: string;
  destination: string | null;
  start_date: string;
  end_date: string;
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

export interface TravelItinerary {
  id: string;
  trip_id: string;
  group_id: string;
  day_date: string;
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
  address: string | null;
  memo: string | null;
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
  time_at: string | null;
  category: string | null;
  memo: string | null;
  address: string | null;
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
  start_time: string | null;
  end_time: string | null;
  address: string | null;
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
  start_time: string | null;
  end_time: string | null;
  departure: string | null;
  arrival: string | null;
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
