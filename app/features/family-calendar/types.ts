/**
 * 가족 일정(Family Calendar) 타입 정의
 */

export type FamilyEvent = {
  id: number | string; // 로컬 임시 id(숫자) 또는 Supabase UUID(문자열)
  month: string; // 'JAN', 'FEB', ... (3글자 대문자)
  day: string; // '1', '2', ...
  title: string;
  desc: string;
  event_date: string; // ISO 날짜 문자열
  created_by?: string;
  created_at?: string;
  supabaseId?: string | number;
  repeat_type?: 'none' | 'monthly' | 'yearly';
};

export type FamilyEventPayload = {
  id: number;
  month: string;
  day: string;
  title: string;
  desc: string;
  event_date: string;
  repeat_type?: 'none' | 'monthly' | 'yearly';
};
