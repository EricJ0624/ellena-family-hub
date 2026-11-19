/**
 * 가족 임무(Family Tasks) 타입 정의
 */

/** 허용 마감 알림: 1시간 전(60) */
export type TaskRemindOffsetMinutes = 60;

export type FamilyTask = {
  id: number | string; // 로컬 임시 id(숫자) 또는 Supabase UUID(문자열)
  text: string;
  assignee: string;
  done: boolean;
  created_by?: string;
  assigned_to_user_id?: string;
  supabaseId?: string | number;
  /** ISO timestamptz. null/undefined면 마감 없음 */
  due_at?: string | null;
  /** 마감 몇 분 전 알림. 빈 배열이면 알림 없음 */
  remind_offsets_minutes?: TaskRemindOffsetMinutes[];
};

export type FamilyTaskPayload = {
  id: number;
  text: string;
  assignee: string;
  done: boolean;
};

/** 가족 임무 담당자 선택용(그룹 멤버, 본인 포함) */
export type FamilyTaskMemberOption = {
  userId: string;
  nickname: string;
};

export type FamilyTaskSubtask = {
  id: string;
  task_id: string;
  text: string;
  done: boolean;
  sort_order: number;
};

export type FamilyTaskSubtaskProgress = {
  done: number;
  total: number;
};

export type FamilyTaskListTemplate = {
  id: string;
  name: string;
  created_at: string;
  item_count: number;
};
