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
  /** 키즈 날짜 칸에 직접 고른 이모지. 없으면 제목 단어 스티커. */
  sticker_emoji?: string | null;
  /** 일정 당일 기준 N일 전 알림. 허용: 1,3,7,14,30. 빈 배열=없음. */
  remind_offsets?: number[];
};
