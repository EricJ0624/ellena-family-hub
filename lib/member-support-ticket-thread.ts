/**
 * member_support_tickets.message_thread JSON 항목
 * 첫 답변(answer) 이후 이어지는 추가 문의(멤버) / 재답변(그룹 관리자)
 */

export type MemberSupportTicketThreadEntry = {
  /** 첨부 entity_id로 사용. 구 데이터는 없을 수 있음. */
  id?: string;
  role: 'member' | 'group_admin';
  user_id: string;
  body: string;
  created_at: string;
};

const UUID_ANY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
      const id = typeof o.id === 'string' && UUID_ANY.test(o.id) ? o.id : undefined;
      out.push(id ? { id, role, user_id, body, created_at } : { role, user_id, body, created_at });
    }
  }
  return out;
}
