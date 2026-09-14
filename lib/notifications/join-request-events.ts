/** 대시보드 가입 승인 팝업 ↔ 알림 종 동기화 */
export const GROUP_JOIN_RESOLVED_EVENT = 'ellena:group-join-resolved';

export type GroupJoinResolvedDetail = {
  groupId: string;
  requestId: string;
  status: 'approved' | 'rejected';
};

/** 요청자가 4자리 코드로 가입 요청을 보낸 직후 (대기 구독 시작) */
export const JOIN_REQUEST_PENDING_EVENT = 'ellena:join-request-pending';

export type JoinRequestPendingDetail = {
  requestId: string;
  groupId: string;
  groupName?: string | null;
};
