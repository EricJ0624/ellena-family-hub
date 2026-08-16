/**
 * 가족 일정(Family Calendar) 타입 정의
 */

export type FamilyEvent = {
  id: number | string;
  month: string;
  day: string;
  title: string;
  desc: string;
  event_date: string;
  end_date?: string;       // 기간 이벤트 종료 날짜 (YYYY-MM-DD, 없으면 단일 날짜)
  created_by?: string;
  created_at?: string;
  supabaseId?: string | number;
  repeat_type?: 'none' | 'monthly' | 'yearly';
};
