/**
 * member_support_tickets.message_thread JSON 항목
 * 첫 답변(answer) 이후 이어지는 추가 문의(멤버) / 재답변(그룹 관리자)
 */

export type MemberSupportTicketThreadEntry = {
  role: 'member' | 'group_admin';
  user_id: string;
  body: string;
  created_at: string;
};

export function parseMemberSupportMessageThread(raw: unknown): MemberSupportTicketThreadEntry[] {
  if (!raw || !Array.isArray(raw)) return [];
  const out: MemberSupportTicketThreadEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const role = o.role;
    const user_id = o.user_id;
    const body = o.body;
    const created_at = o.created_at;
    if (
      (role === 'member' || role === 'group_admin') &&
      typeof user_id === 'string' &&
      typeof body === 'string' &&
      typeof created_at === 'string'
    ) {
      out.push({ role, user_id, body, created_at });
    }
  }
  return out;
}
