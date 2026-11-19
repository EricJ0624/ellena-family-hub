/**
 * 서브태스크 창: 사용자가 닫기 전까지 유지.
 * 로그아웃(세션 없음) 후에는 복원하지 않도록 userId 키에 묶는다.
 */

const PREFIX = 'family-task-desk:v1';

function storageKey(userId: string, groupId: string): string {
  return `${PREFIX}:${userId}:${groupId}`;
}

export function readOpenTaskDesk(userId: string, groupId: string | null): string | null {
  if (!userId || !groupId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(userId, groupId));
    if (!raw) return null;
    const taskId = String(raw).trim();
    return taskId && !/^\d+$/.test(taskId) ? taskId : null;
  } catch {
    return null;
  }
}

export function writeOpenTaskDesk(userId: string, groupId: string | null, taskId: string): void {
  if (!userId || !groupId || typeof window === 'undefined') return;
  if (!taskId || /^\d+$/.test(taskId)) return;
  try {
    window.localStorage.setItem(storageKey(userId, groupId), taskId);
  } catch {
    /* ignore quota */
  }
}

export function clearOpenTaskDesk(userId: string, groupId: string | null): void {
  if (!userId || !groupId || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKey(userId, groupId));
  } catch {
    /* ignore */
  }
}
