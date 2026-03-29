/** 멤버 문의 답변 확인 여부 (티켓 id 목록, 사용자별 localStorage) */
export const memberSupportSeenStorageKey = (userId: string) =>
  `member_support_seen:${userId}`;

export interface MemberSupportTicketRow {
  id: string;
  group_id: string;
  title: string;
  content: string;
  status: string;
  answer: string | null;
  answered_at: string | null;
  message_thread?: unknown;
  created_at: string;
}

export function readSeenMemberTicketIds(userId: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(memberSupportSeenStorageKey(userId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

export function markMemberTicketsSeen(userId: string, ticketIds: string[]) {
  if (typeof window === 'undefined' || !ticketIds.length) return;
  const s = readSeenMemberTicketIds(userId);
  ticketIds.forEach((id) => s.add(id));
  localStorage.setItem(
    memberSupportSeenStorageKey(userId),
    JSON.stringify([...s])
  );
}

/** 삭제된 티켓 id를 읽음 목록에서 제거 */
export function removeMemberTicketFromSeen(userId: string, ticketId: string) {
  if (typeof window === 'undefined' || !ticketId) return;
  const s = readSeenMemberTicketIds(userId);
  if (!s.delete(ticketId)) return;
  localStorage.setItem(
    memberSupportSeenStorageKey(userId),
    JSON.stringify([...s])
  );
}
