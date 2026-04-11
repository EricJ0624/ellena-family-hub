/**
 * 가족 임무(Family Tasks) 타입 정의
 */

export type FamilyTask = {
  id: number | string; // 로컬 임시 id(숫자) 또는 Supabase UUID(문자열)
  text: string;
  assignee: string;
  done: boolean;
  created_by?: string;
  assigned_to_user_id?: string;
  supabaseId?: string | number;
};

export type FamilyTaskPayload = {
  id: number;
  text: string;
  assignee: string;
  done: boolean;
};
