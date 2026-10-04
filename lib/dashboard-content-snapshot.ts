/**
 * 대시보드 일정·할 일 마지막 성공 내용.
 * 재방문 시 서버 응답 전에 같은 그룹 내용만 먼저 그린다.
 * 다른 그룹 스냅샷은 키에 groupId가 있어 섞이지 않는다.
 */
import type { FamilyEvent } from '@/app/features/family-calendar/types';
import type { FamilyTask } from '@/app/features/family-tasks/types';
import { CryptoService } from '@/lib/dashboard-storage';

const STORAGE_PREFIX = 'SFH_WIDGET_CONTENT_v1_';

export type DashboardContentSnapshot = {
  todos: FamilyTask[];
  events: FamilyEvent[];
};

const memory = new Map<string, DashboardContentSnapshot>();

function storageKey(userId: string, groupId: string): string {
  return `${STORAGE_PREFIX}${userId}_${groupId}`;
}

function isRepeatType(value: unknown): value is NonNullable<FamilyEvent['repeat_type']> {
  return value === 'none' || value === 'monthly' || value === 'yearly';
}

function sanitizeTasks(raw: unknown): FamilyTask[] {
  if (!Array.isArray(raw)) return [];
  const tasks: FamilyTask[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Partial<FamilyTask>;
    if (row.id == null || typeof row.text !== 'string') continue;
    tasks.push({
      id: row.id,
      text: row.text,
      assignee: typeof row.assignee === 'string' ? row.assignee : '',
      done: row.done === true,
      created_by: typeof row.created_by === 'string' ? row.created_by : undefined,
      assigned_to_user_id:
        typeof row.assigned_to_user_id === 'string' ? row.assigned_to_user_id : undefined,
      supabaseId: row.supabaseId,
    });
  }
  return tasks;
}

function sanitizeEvents(raw: unknown): FamilyEvent[] {
  if (!Array.isArray(raw)) return [];
  const events: FamilyEvent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Partial<FamilyEvent>;
    if (row.id == null || typeof row.title !== 'string' || typeof row.event_date !== 'string') continue;
    events.push({
      id: row.id,
      month: typeof row.month === 'string' ? row.month : '',
      day: typeof row.day === 'string' ? row.day : '',
      title: row.title,
      desc: typeof row.desc === 'string' ? row.desc : '',
      event_date: row.event_date,
      end_date: typeof row.end_date === 'string' ? row.end_date : undefined,
      created_by: typeof row.created_by === 'string' ? row.created_by : undefined,
      created_at: typeof row.created_at === 'string' ? row.created_at : undefined,
      supabaseId: row.supabaseId,
      repeat_type: isRepeatType(row.repeat_type) ? row.repeat_type : 'none',
    });
  }
  return events;
}

export function readDashboardContentSnapshot(
  userId: string,
  groupId: string,
  key: string,
): DashboardContentSnapshot | null {
  if (!userId || !groupId || !key || typeof window === 'undefined') return null;
  const id = storageKey(userId, groupId);
  const remembered = memory.get(id);
  if (remembered) return remembered;
  try {
    const raw = localStorage.getItem(id);
    if (!raw) return null;
    const parsed = CryptoService.decrypt(raw, key) as Partial<DashboardContentSnapshot> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    const snapshot = {
      todos: sanitizeTasks(parsed.todos),
      events: sanitizeEvents(parsed.events),
    };
    memory.set(id, snapshot);
    return snapshot;
  } catch {
    return null;
  }
}

/** 일정 또는 할 일만 갱신해도 다른 쪽 마지막 값을 유지한다. */
export function writeDashboardContentSnapshot(
  userId: string,
  groupId: string,
  key: string,
  patch: Partial<DashboardContentSnapshot>,
): void {
  if (!userId || !groupId || !key || typeof window === 'undefined') return;
  const id = storageKey(userId, groupId);
  const prev = memory.get(id) ?? readDashboardContentSnapshot(userId, groupId, key) ?? {
    todos: [],
    events: [],
  };
  const next: DashboardContentSnapshot = {
    todos: patch.todos ?? prev.todos,
    events: patch.events ?? prev.events,
  };
  memory.set(id, next);
  try {
    localStorage.setItem(id, CryptoService.encrypt(next, key));
  } catch {
    // quota / private mode — 메모리 스냅샷은 유지
  }
}
