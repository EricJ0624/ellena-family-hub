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
