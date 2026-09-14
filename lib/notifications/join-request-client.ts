import {
  GROUP_JOIN_RESOLVED_EVENT,
  type GroupJoinResolvedDetail,
} from '@/lib/notifications/join-request-events';

/** 관리자가 가입 요청을 처리한 뒤, 관련 인앱 알림 읽음 + UI 동기화 이벤트 */
export async function syncAfterAdminJoinResolve(options: {
  accessToken: string;
  groupId: string;
  requestId: string;
  status: 'approved' | 'rejected';
}): Promise<void> {
  const { accessToken, groupId, requestId, status } = options;
  try {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        groupId,
        entityIds: [requestId],
        eventType: 'GROUP_JOIN_REQUEST',
      }),
    });
  } catch (err) {
    console.warn('mark GROUP_JOIN_REQUEST read:', err);
  }

  if (typeof window !== 'undefined') {
    const detail: GroupJoinResolvedDetail = { groupId, requestId, status };
    window.dispatchEvent(new CustomEvent(GROUP_JOIN_RESOLVED_EVENT, { detail }));
  }
}

export function parseJoinResolvedStatus(
  payload: { status?: unknown } | null | undefined,
): 'approved' | 'rejected' | null {
  if (payload?.status === 'approved' || payload?.status === 'rejected') {
    return payload.status;
  }
  return null;
}
