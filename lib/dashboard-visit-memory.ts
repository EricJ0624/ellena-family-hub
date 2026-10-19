/**
 * 같은 탭에서 대시보드를 떠났다가 돌아올 때, 인증 확인이 끝나기 전 빈 화면을 막는다.
 * 마지막으로 대시보드를 그린 사용자만 기억한다. 로그아웃·세션 저장이 없으면 쓰지 않는다.
 */
import { AUTH_STORAGE_KEY } from '@/lib/supabase';

export type DashboardVisitMemory = {
  groupId: string;
  userId: string;
  userName: string;
  familyId: string;
  isSystemAdmin: boolean;
};

let visit: DashboardVisitMemory | null = null;

function hasAuthStorageHint(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(
      localStorage.getItem(AUTH_STORAGE_KEY) || sessionStorage.getItem(AUTH_STORAGE_KEY),
    );
  } catch {
    return false;
  }
}

export function readDashboardVisitMemory(groupId: string | null): DashboardVisitMemory | null {
  if (!groupId || !visit || visit.groupId !== groupId) return null;
  if (!hasAuthStorageHint()) return null;
  return visit;
}

export function writeDashboardVisitMemory(next: DashboardVisitMemory): void {
  if (
    visit &&
    visit.groupId === next.groupId &&
    visit.userId === next.userId &&
    visit.userName === next.userName &&
    visit.familyId === next.familyId &&
    visit.isSystemAdmin === next.isSystemAdmin
  ) {
    return;
  }
  visit = next;
}

export function clearDashboardVisitMemory(): void {
  visit = null;
}

export function subscribeDashboardVisitMemory(): () => void {
  return () => undefined;
}

export function getDashboardVisitServerSnapshot(): null {
  return null;
}
